import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  UPLOADS_DIR,
  isCloudinaryConfigured,
  extractCloudinaryPublicId,
  saveBase64Image,
  deleteSavedImage,
  duplicateSavedImage,
  getCloudinary,
} from '../utils/imageStorage';

// Minimal 1x1 valid PNG base64 for testing
const TINY_PNG_BASE64 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

describe('Image Storage & Cloudinary Integration Suite', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.CLOUDINARY_CLOUD_NAME;
    delete process.env.CLOUDINARY_API_KEY;
    delete process.env.CLOUDINARY_API_SECRET;
    delete process.env.CLOUDINARY_URL;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  describe('1. Configuration & Cloudinary Public ID Extraction', () => {
    it('isCloudinaryConfigured returns false when no credentials are present', () => {
      expect(isCloudinaryConfigured()).toBe(false);
    });

    it('isCloudinaryConfigured returns true when triplet credentials are set', () => {
      process.env.CLOUDINARY_CLOUD_NAME = 'test_cloud';
      process.env.CLOUDINARY_API_KEY = 'test_key';
      process.env.CLOUDINARY_API_SECRET = 'test_secret';
      expect(isCloudinaryConfigured()).toBe(true);
    });

    it('isCloudinaryConfigured returns true when CLOUDINARY_URL is set', () => {
      process.env.CLOUDINARY_URL = 'cloudinary://test_key:test_secret@test_cloud';
      expect(isCloudinaryConfigured()).toBe(true);
    });

    it('extractCloudinaryPublicId correctly parses versioned and folder paths', () => {
      const url1 = 'https://res.cloudinary.com/jobbyhop/image/upload/v1712345678/jobbyhop/profiles/worker_123.jpg';
      expect(extractCloudinaryPublicId(url1)).toBe('jobbyhop/profiles/worker_123');

      const url2 = 'https://res.cloudinary.com/jobbyhop/image/upload/jobbyhop/profiles/avatar_abc.png';
      expect(extractCloudinaryPublicId(url2)).toBe('jobbyhop/profiles/avatar_abc');

      const url3 = 'https://res.cloudinary.com/demo/image/upload/sample.webp';
      expect(extractCloudinaryPublicId(url3)).toBe('sample');

      expect(extractCloudinaryPublicId('/uploads/profile-123.jpg')).toBe(null);
      expect(extractCloudinaryPublicId('')).toBe(null);
      expect(extractCloudinaryPublicId(null)).toBe(null);
    });
  });

  describe('2. Local Storage Fallback (Offline / Dev / Test Mode)', () => {
    it('saves a base64 image to local disk when Cloudinary is not configured', async () => {
      const savedUrl = await saveBase64Image(TINY_PNG_BASE64);
      expect(savedUrl).toMatch(/^\/uploads\/profile-.*\.png$/);

      const filename = savedUrl.replace('/uploads/', '');
      const fullPath = path.join(UPLOADS_DIR, filename);
      expect(fs.existsSync(fullPath)).toBe(true);

      // Clean up the created test file
      await deleteSavedImage(savedUrl);
      expect(fs.existsSync(fullPath)).toBe(false);
    });

    it('returns existing URLs and paths unchanged without re-saving', async () => {
      expect(await saveBase64Image('/uploads/already-saved.png')).toBe('/uploads/already-saved.png');
      expect(await saveBase64Image('https://res.cloudinary.com/demo/image/upload/sample.jpg')).toBe(
        'https://res.cloudinary.com/demo/image/upload/sample.jpg'
      );
      expect(await saveBase64Image('http://example.com/photo.jpg')).toBe('http://example.com/photo.jpg');
      expect(await saveBase64Image('')).toBe('');
      expect(await saveBase64Image(null)).toBe('');
    });

    it('rejects invalid base64 format or empty image buffers', async () => {
      await expect(saveBase64Image('data:image/png;invalid')).rejects.toThrow('Invalid base64 image format.');
      await expect(saveBase64Image('data:image/png;base64,')).rejects.toThrow('Empty image buffer.');
    });


    it('duplicates local files correctly for audit preservation', async () => {
      const savedUrl = await saveBase64Image(TINY_PNG_BASE64);
      const duplicatedUrl = await duplicateSavedImage(savedUrl);

      expect(duplicatedUrl).toMatch(/^\/uploads\/audit-.*\.png$/);
      expect(duplicatedUrl).not.toBe(savedUrl);

      const origFile = path.join(UPLOADS_DIR, savedUrl.replace('/uploads/', ''));
      const dupFile = path.join(UPLOADS_DIR, duplicatedUrl.replace('/uploads/', ''));

      expect(fs.existsSync(origFile)).toBe(true);
      expect(fs.existsSync(dupFile)).toBe(true);

      // Clean up
      await deleteSavedImage(savedUrl);
      await deleteSavedImage(duplicatedUrl);
    });
  });

  describe('3. Cloudinary Upload, Duplication & Deletion (Configured Mode)', () => {
    it('uploads to Cloudinary and returns secure_url when configured', async () => {
      process.env.CLOUDINARY_CLOUD_NAME = 'mock_cloud';
      process.env.CLOUDINARY_API_KEY = 'mock_key';
      process.env.CLOUDINARY_API_SECRET = 'mock_secret';

      const cld = getCloudinary();
      const mockSecureUrl = 'https://res.cloudinary.com/mock_cloud/image/upload/v12345/jobbyhop/profiles/test_worker.png';
      const uploadSpy = vi.spyOn(cld.uploader, 'upload').mockResolvedValue({
        secure_url: mockSecureUrl,
        public_id: 'jobbyhop/profiles/test_worker',
      });

      const result = await saveBase64Image(TINY_PNG_BASE64);

      expect(uploadSpy).toHaveBeenCalledWith(
        expect.stringMatching(/^data:image\/png;base64,/),
        expect.objectContaining({ folder: 'jobbyhop/profiles', resource_type: 'image' })
      );
      expect(result).toBe(mockSecureUrl);
    });

    it('gracefully falls back to local storage if Cloudinary upload throws', async () => {
      process.env.CLOUDINARY_CLOUD_NAME = 'mock_cloud';
      process.env.CLOUDINARY_API_KEY = 'mock_key';
      process.env.CLOUDINARY_API_SECRET = 'mock_secret';

      const cld = getCloudinary();
      vi.spyOn(cld.uploader, 'upload').mockRejectedValue(new Error('Cloudinary network timeout'));

      const savedUrl = await saveBase64Image(TINY_PNG_BASE64);
      expect(savedUrl).toMatch(/^\/uploads\/profile-.*\.png$/);

      // Cleanup
      await deleteSavedImage(savedUrl);
    });

    it('deletes from Cloudinary using destroy() when given a Cloudinary URL', async () => {
      process.env.CLOUDINARY_CLOUD_NAME = 'mock_cloud';
      process.env.CLOUDINARY_API_KEY = 'mock_key';
      process.env.CLOUDINARY_API_SECRET = 'mock_secret';

      const cld = getCloudinary();
      const destroySpy = vi.spyOn(cld.uploader, 'destroy').mockResolvedValue({ result: 'ok' });

      const cldUrl = 'https://res.cloudinary.com/mock_cloud/image/upload/v12345/jobbyhop/profiles/to_delete.jpg';
      await deleteSavedImage(cldUrl);

      expect(destroySpy).toHaveBeenCalledWith('jobbyhop/profiles/to_delete');
    });

    it('duplicates Cloudinary image to jobbyhop/audit folder for audit snapshots', async () => {
      process.env.CLOUDINARY_CLOUD_NAME = 'mock_cloud';
      process.env.CLOUDINARY_API_KEY = 'mock_key';
      process.env.CLOUDINARY_API_SECRET = 'mock_secret';

      const cld = getCloudinary();
      const mockAuditUrl = 'https://res.cloudinary.com/mock_cloud/image/upload/v9999/jobbyhop/audit/audit_copy.jpg';
      const uploadSpy = vi.spyOn(cld.uploader, 'upload').mockResolvedValue({
        secure_url: mockAuditUrl,
      });

      const originalCldUrl = 'https://res.cloudinary.com/mock_cloud/image/upload/v12345/jobbyhop/profiles/orig.jpg';
      const duplicated = await duplicateSavedImage(originalCldUrl);

      expect(uploadSpy).toHaveBeenCalledWith(
        originalCldUrl,
        expect.objectContaining({ folder: 'jobbyhop/audit' })
      );
      expect(duplicated).toBe(mockAuditUrl);
    });
  });
});
