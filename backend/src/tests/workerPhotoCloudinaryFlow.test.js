import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

import WorkerProfile from '../models/WorkerProfile';
import User from '../models/User';
import workerRoutes from '../routes/workerRoutes';
import { getCloudinary } from '../utils/imageStorage';
import { generateToken } from '../utils/jwt';

// Minimal 1x1 valid PNG base64
const VALID_PNG_BASE64 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

describe('Worker Profile Photo Cloudinary Flow & Persistence Integration Suite', () => {
  let mongoServer;
  let app;
  let authToken;
  let testUser;
  const originalEnv = { ...process.env };

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    app = express();
    app.use(express.json({ limit: '2mb' }));
    app.use(express.urlencoded({ extended: true, limit: '2mb' }));
    app.use('/api/worker', workerRoutes);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
  });

  beforeEach(async () => {
    process.env = { ...originalEnv };
    process.env.CLOUDINARY_CLOUD_NAME = 'test_cloud';
    process.env.CLOUDINARY_API_KEY = 'test_key';
    process.env.CLOUDINARY_API_SECRET = 'test_secret';

    await WorkerProfile.deleteMany({});
    await User.deleteMany({});

    testUser = await User.create({
      email: 'worker@test.com',
      phone: '9876543210',
      passwordHash: 'hashed123',
      role: 'WORKER',
      status: 'ACTIVE',
      isDeleted: false,
    });
    authToken = generateToken(testUser);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it('1. uploads a valid new worker photo via PUT /api/worker/profile and stores Cloudinary HTTPS URL in MongoDB', async () => {
    await WorkerProfile.create({
      userId: testUser._id,
      fullName: 'Aadish Test',
      profilePhoto: '/uploads/profile-legacy-123.png', // Legacy path
      location: 'Mumbai',
      dob: new Date('1998-04-12'),
      phone: '9876543210',
      email: 'worker@test.com',
    });

    const mockCloudinaryUrl =
      'https://res.cloudinary.com/test_cloud/image/upload/v1792514604/jobbyhop/profiles/worker_aadish_new.png';

    const uploadSpy = vi.spyOn(getCloudinary().uploader, 'upload').mockResolvedValue({
      secure_url: mockCloudinaryUrl,
      public_id: 'jobbyhop/profiles/worker_aadish_new',
    });

    const res = await request(app)
      .put('/api/worker/profile')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        profilePhoto: VALID_PNG_BASE64,
        bio: 'Updated bio information',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.profile.profilePhoto).toBe(mockCloudinaryUrl);

    // Verify directly in MongoDB
    const updated = await WorkerProfile.findOne({ userId: testUser._id });
    expect(updated.profilePhoto).toBe(mockCloudinaryUrl);
    expect(updated.profilePhoto).toMatch(/^https:\/\/res\.cloudinary\.com\//);
    expect(uploadSpy).toHaveBeenCalled();
  });

  it('2. uploads a photo via dedicated PUT /api/worker/photo multipart endpoint and updates MongoDB', async () => {
    await WorkerProfile.create({
      userId: testUser._id,
      fullName: 'Worker Abc',
      profilePhoto: '/uploads/profile-1792349022653-430185b4f833.jpg',
      location: 'Delhi',
      dob: new Date('1995-02-10'),
      phone: '9876543210',
      email: 'worker@test.com',
    });

    const mockCloudinaryUrl =
      'https://res.cloudinary.com/test_cloud/image/upload/v1792514604/jobbyhop/profiles/abc_new_photo.png';

    vi.spyOn(getCloudinary().uploader, 'upload').mockResolvedValue({
      secure_url: mockCloudinaryUrl,
      public_id: 'jobbyhop/profiles/abc_new_photo',
    });

    const pngBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );

    const res = await request(app)
      .put('/api/worker/photo')
      .set('Authorization', `Bearer ${authToken}`)
      .attach('photo', pngBuffer, { filename: 'test.png', contentType: 'image/png' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.profilePhoto).toBe(mockCloudinaryUrl);

    const inDb = await WorkerProfile.findOne({ userId: testUser._id });
    expect(inDb.profilePhoto).toBe(mockCloudinaryUrl);
  });

  it('3. rejects invalid image types (e.g. text/html) with 400 and does NOT corrupt MongoDB profile', async () => {
    await WorkerProfile.create({
      userId: testUser._id,
      fullName: 'Aadish Test',
      profilePhoto: '/uploads/profile-legacy-preserved.png',
      location: 'Mumbai',
      dob: new Date('1998-04-12'),
      phone: '9876543210',
      email: 'worker@test.com',
    });

    const res = await request(app)
      .put('/api/worker/profile')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        profilePhoto: 'data:text/plain;base64,SGVsbG8gV29ybGQ=',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);

    // Verify existing profilePhoto in DB was NOT corrupted
    const inDb = await WorkerProfile.findOne({ userId: testUser._id });
    expect(inDb.profilePhoto).toBe('/uploads/profile-legacy-preserved.png');
  });

  it('4. handles failed Cloudinary upload gracefully with 400 and preserves existing profile in MongoDB', async () => {
    await WorkerProfile.create({
      userId: testUser._id,
      fullName: 'Aadish Test',
      profilePhoto: '/uploads/profile-legacy-preserved.png',
      location: 'Mumbai',
      dob: new Date('1998-04-12'),
      phone: '9876543210',
      email: 'worker@test.com',
    });

    // Cloudinary returns error (e.g. invalid API key or timeout)
    vi.spyOn(getCloudinary().uploader, 'upload').mockRejectedValue(
      new Error('Invalid Cloudinary credentials')
    );

    const res = await request(app)
      .put('/api/worker/profile')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        profilePhoto: VALID_PNG_BASE64,
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);

    // Profile in DB is unharmed
    const inDb = await WorkerProfile.findOne({ userId: testUser._id });
    expect(inDb.profilePhoto).toBe('/uploads/profile-legacy-preserved.png');
  });

  it('5. preserves legal name, dob, and phone immutability during profile update', async () => {
    await WorkerProfile.create({
      userId: testUser._id,
      fullName: 'Original Name',
      profilePhoto: 'https://res.cloudinary.com/test_cloud/image/upload/v1/test.jpg',
      location: 'Mumbai',
      dob: new Date('1998-04-12'),
      phone: '9876543210',
      email: 'worker@test.com',
    });

    const res = await request(app)
      .put('/api/worker/profile')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        fullName: 'Changed Legal Name',
        phone: '1111111111',
      });

    expect(res.status).toBe(403);
    expect(res.body.message).toContain('cannot be changed after verification');

    const inDb = await WorkerProfile.findOne({ userId: testUser._id });
    expect(inDb.fullName).toBe('Original Name');
    expect(inDb.phone).toBe('9876543210');
  });
});
