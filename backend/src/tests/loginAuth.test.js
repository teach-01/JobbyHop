const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../app');
const User = require('../models/User');
const { connectDB, closeDB } = require('../config/db');
const { ROLES } = require('../config/constants');

describe('Login Authentication & Portal Access Rules', () => {
  beforeAll(async () => {
    await connectDB();

    // Create test accounts
    const passwordHash = await bcrypt.hash('password123', 10);

    // 1. Worker account
    await User.create({
      email: 'testworker@jobbyhop.com',
      passwordHash,
      role: ROLES.WORKER,
      status: 'ACTIVE',
      phone: '+919999000001',
    });

    // 2. Recruiter account
    await User.create({
      email: 'testrecruiter@jobbyhop.com',
      passwordHash,
      role: ROLES.RECRUITER,
      status: 'ACTIVE',
      phone: '+919999000002',
    });

    // 3. Admin account
    await User.create({
      email: 'testadmin@jobbyhop.com',
      passwordHash,
      role: ROLES.ADMIN,
      status: 'ACTIVE',
      phone: '+919999000003',
    });

    // 4. Suspended worker account
    await User.create({
      email: 'suspendedworker@jobbyhop.com',
      passwordHash,
      role: ROLES.WORKER,
      status: 'SUSPENDED',
      phone: '+919999000004',
    });

    // 5. Blocked recruiter account
    await User.create({
      email: 'blockedrecruiter@jobbyhop.com',
      passwordHash,
      role: ROLES.RECRUITER,
      status: 'BLOCKED',
      phone: '+919999000005',
    });

    // 6. Deactivated worker account
    await User.create({
      email: 'deactivatedworker@jobbyhop.com',
      passwordHash,
      role: ROLES.WORKER,
      status: 'DEACTIVATED',
      phone: '+919999000006',
    });
  });

  afterAll(async () => {
    await closeDB();
  });

  it('1. Worker account + correct password -> Worker Login = PASS', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'testworker@jobbyhop.com', password: 'password123', expectedRole: 'WORKER' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.role).toBe(ROLES.WORKER);
  });

  it('2. Worker account + correct password -> Recruiter Login = FAIL', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'testworker@jobbyhop.com', password: 'password123', expectedRole: 'RECRUITER' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Invalid recruiter credentials.');
    expect(res.body.token).toBeUndefined();
  });

  it('3. Recruiter account + correct password -> Recruiter Login = PASS', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'testrecruiter@jobbyhop.com', password: 'password123', expectedRole: 'RECRUITER' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.role).toBe(ROLES.RECRUITER);
  });

  it('4. Recruiter account + correct password -> Worker Login = FAIL', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'testrecruiter@jobbyhop.com', password: 'password123', expectedRole: 'WORKER' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Invalid worker credentials.');
    expect(res.body.token).toBeUndefined();
  });

  it('5. Admin account + correct password -> Worker Login = PASS (role remains ADMIN)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'testadmin@jobbyhop.com', password: 'password123', expectedRole: 'WORKER' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.role).toBe(ROLES.ADMIN);
  });

  it('6. Admin account + correct password -> Recruiter Login = PASS (role remains ADMIN)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'testadmin@jobbyhop.com', password: 'password123', expectedRole: 'RECRUITER' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.role).toBe(ROLES.ADMIN);
  });

  it('7 & 8. Admin role is ADMIN, never WORKER or RECRUITER', async () => {
    const workerLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'testadmin@jobbyhop.com', password: 'password123', expectedRole: 'WORKER' });
    expect(workerLoginRes.body.user.role).toBe('ADMIN');
    expect(workerLoginRes.body.user.role).not.toBe('WORKER');

    const recruiterLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'testadmin@jobbyhop.com', password: 'password123', expectedRole: 'RECRUITER' });
    expect(recruiterLoginRes.body.user.role).toBe('ADMIN');
    expect(recruiterLoginRes.body.user.role).not.toBe('RECRUITER');
  });

  it('9. Wrong password -> Login fails normally', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'testworker@jobbyhop.com', password: 'wrongpassword', expectedRole: 'WORKER' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Invalid credentials');
  });

  it('10. Non-existing email -> Login fails normally', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nonexistent@jobbyhop.com', password: 'password123', expectedRole: 'WORKER' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Invalid credentials');
  });

  it('11. Suspended/Blocked/Deactivated accounts -> restrictions work', async () => {
    const suspendedRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'suspendedworker@jobbyhop.com', password: 'password123', expectedRole: 'WORKER' });
    expect(suspendedRes.status).toBe(403);
    expect(suspendedRes.body.message).toContain('suspended');

    const blockedRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'blockedrecruiter@jobbyhop.com', password: 'password123', expectedRole: 'RECRUITER' });
    expect(blockedRes.status).toBe(403);
    expect(blockedRes.body.message).toContain('blocked');

    const deactivatedRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'deactivatedworker@jobbyhop.com', password: 'password123', expectedRole: 'WORKER' });
    expect(deactivatedRes.status).toBe(403);
    expect(deactivatedRes.body.message).toContain('deactivated');
  });
});
