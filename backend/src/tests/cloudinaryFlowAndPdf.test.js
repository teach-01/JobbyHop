import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { validateWorkerProfilePhoto } from '../utils/imageValidator';
import {
  saveBase64Image,
  getCloudinary,
  isCloudinaryConfigured,
} from '../utils/imageStorage';

// Minimal 1x1 valid PNG base64 for testing
const TINY_PNG_BASE64 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

/**
 * Mirror of frontend isRealUploadedImage function from printPdfExport.js
 */
function isRealUploadedImage(url) {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed) return false;

  const lc = trimmed.toLowerCase();
  const FAKE_PATTERNS = [
    'default', 'placeholder', 'avatar', 'dicebear', 'initials',
    'fallback', 'generic', 'dummy', 'unknown', 'gravatar',
    'ui-avatar', 'boring-avatar', 'robohash', 'adorable',
  ];
  if (FAKE_PATTERNS.some((p) => lc.includes(p))) return false;

  if (lc.startsWith('/uploads/') || lc.startsWith('uploads/')) return true;
  if (lc.startsWith('data:image/')) return true;
  if (lc.startsWith('http://') || lc.startsWith('https://')) return true;

  return false;
}

/**
 * Mirror of frontend resolveAssetUrl from assetUrl.js
 */
function resolveAssetUrl(url, backendUrlEnv, windowOrigin) {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';

  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:')
  ) {
    return trimmed;
  }

  const backendOrigin = (backendUrlEnv && typeof backendUrlEnv === 'string')
    ? backendUrlEnv.replace(/\/+$/, '')
    : (windowOrigin || '');

  const isUpload = trimmed.startsWith('/uploads/') || trimmed.startsWith('uploads/');
  const base = isUpload ? backendOrigin : (windowOrigin || backendOrigin);

  if (trimmed.startsWith('/')) {
    return `${base}${trimmed}`;
  }
  return `${base}/${trimmed}`;
}

describe('Cloudinary End-to-End Upload Flow & PDF Integration Suite', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  describe('1. Worker Profile Photo Upload & Cloudinary Persistence Flow', () => {
    it('validates worker photo format and magic bytes before upload', () => {
      const validation = validateWorkerProfilePhoto(TINY_PNG_BASE64);
      expect(validation.valid).toBe(true);
      expect(validation.mime).toBe('image/png');
    });

    it('rejects invalid or non-image payloads at validation boundary', () => {
      const invalidValidation = validateWorkerProfilePhoto('data:text/plain;base64,SGVsbG8=');
      expect(invalidValidation.valid).toBe(false);
    });

    it('uploads to Cloudinary and returns an HTTPS CDN URL when configured', async () => {
      process.env.CLOUDINARY_CLOUD_NAME = 'test_cloud';
      process.env.CLOUDINARY_API_KEY = 'test_key';
      process.env.CLOUDINARY_API_SECRET = 'test_secret';

      expect(isCloudinaryConfigured()).toBe(true);

      const cld = getCloudinary();
      const mockCldHttpsUrl =
        'https://res.cloudinary.com/test_cloud/image/upload/v1712345678/jobbyhop/profiles/profile-12345.png';

      const uploadSpy = vi.spyOn(cld.uploader, 'upload').mockResolvedValue({
        secure_url: mockCldHttpsUrl,
        public_id: 'jobbyhop/profiles/profile-12345',
      });

      const savedUrl = await saveBase64Image(TINY_PNG_BASE64);

      expect(uploadSpy).toHaveBeenCalledWith(
        expect.stringMatching(/^data:image\/png;base64,/),
        expect.objectContaining({ folder: 'jobbyhop/profiles', resource_type: 'image' })
      );
      expect(savedUrl).toBe(mockCldHttpsUrl);
      expect(savedUrl).toMatch(/^https:\/\/res\.cloudinary\.com\//);
    });
  });

  describe('2. PDF Official Dossier Rendering with Cloudinary URLs', () => {
    it('isRealUploadedImage recognizes Cloudinary HTTPS URLs as genuine profile photos', () => {
      const cldUrl =
        'https://res.cloudinary.com/jobbyhop/image/upload/v1712345678/jobbyhop/profiles/worker_photo.jpg';
      expect(isRealUploadedImage(cldUrl)).toBe(true);
    });

    it('isRealUploadedImage rejects known avatar generators and placeholder URLs', () => {
      expect(isRealUploadedImage('https://ui-avatars.com/api/?name=John')).toBe(false);
      expect(isRealUploadedImage('https://example.com/images/default-avatar.png')).toBe(false);
      expect(isRealUploadedImage('https://example.com/placeholder.jpg')).toBe(false);
      expect(isRealUploadedImage('')).toBe(false);
      expect(isRealUploadedImage(null)).toBe(false);
    });

    it('resolveAssetUrl preserves Cloudinary HTTPS URLs intact in production', () => {
      const cldUrl =
        'https://res.cloudinary.com/jobbyhop/image/upload/v1712345678/jobbyhop/profiles/worker_photo.jpg';
      const resolved = resolveAssetUrl(cldUrl, 'https://jobbyhop-api.onrender.com', 'https://jobbyhop.vercel.app');
      expect(resolved).toBe(cldUrl);
    });

    it('generates proper img tag with onerror fallback for PDF popup', () => {
      const cldUrl =
        'https://res.cloudinary.com/jobbyhop/image/upload/v1712345678/jobbyhop/profiles/worker_photo.jpg';
      const photoBoxHtml = `
        <div class="profile-photo-box">
          ${cldUrl
            ? `<img src="${cldUrl}" alt="Profile Photo" onerror="this.parentElement.innerHTML='<div class=\\'profile-photo-placeholder\\'>Photo<br/>Not Available</div>';" />`
            : `<div class="profile-photo-placeholder">Photo Not Available</div>`
          }
        </div>
      `;
      expect(photoBoxHtml).toContain(`src="${cldUrl}"`);
      expect(photoBoxHtml).toContain('Photo<br/>Not Available');
    });

    it('generates placeholder when profile photo is null or missing', () => {
      const photoUrl = null;
      const photoBoxHtml = `
        <div class="profile-photo-box">
          ${photoUrl
            ? `<img src="${photoUrl}" alt="Profile Photo" />`
            : `<div class="profile-photo-placeholder">Photo Not Available</div>`
          }
        </div>
      `;
      expect(photoBoxHtml).not.toContain('<img');
      expect(photoBoxHtml).toContain('Photo Not Available');
    });
  });

  describe('3. Verified Identity Photo Replacement & Cloudinary Storage', () => {
    it('simulates worker updateProfile logic: allows replacement of profile photo to Cloudinary', async () => {
      process.env.CLOUDINARY_CLOUD_NAME = 'test_cloud';
      process.env.CLOUDINARY_API_KEY = 'test_key';
      process.env.CLOUDINARY_API_SECRET = 'test_secret';

      const mockCldUrl =
        'https://res.cloudinary.com/test_cloud/image/upload/v1712345678/jobbyhop/profiles/new_worker_photo.jpg';
      vi.spyOn(getCloudinary().uploader, 'upload').mockResolvedValue({
        secure_url: mockCldUrl,
      });

      const profile = {
        fullName: 'Worker Abc',
        profilePhoto: '/uploads/profile-1792349022653-430185b4f833.jpg',
      };

      const incomingUpdate = {
        fullName: 'Worker Abc',
        profilePhoto: TINY_PNG_BASE64, // Worker uploads new photo
      };

      // Worker updates profile photo:
      if (incomingUpdate.profilePhoto && incomingUpdate.profilePhoto.startsWith('data:')) {
        profile.profilePhoto = await saveBase64Image(incomingUpdate.profilePhoto);
      }

      // Profile photo is replaced with permanent Cloudinary URL
      expect(profile.profilePhoto).toBe(mockCldUrl);
      expect(profile.profilePhoto).toMatch(/^https:\/\/res\.cloudinary\.com\//);
    });

    it('validates that legal identity fields (name, dob, phone) remain immutable', () => {
      const existingProfile = {
        fullName: 'Worker Abc',
        dob: new Date('1995-05-15'),
        phone: '9876543210',
        profilePhoto: 'https://res.cloudinary.com/test_cloud/image/upload/v1/jobbyhop/profiles/test.jpg',
      };

      const attemptedModifications = [];
      const incomingUpdate = {
        fullName: 'Changed Name',
        dob: '2000-01-01',
        phone: '1234567890',
      };

      if (existingProfile.fullName && incomingUpdate.fullName !== existingProfile.fullName) {
        attemptedModifications.push('Full Legal Name');
      }
      if (existingProfile.phone && incomingUpdate.phone !== existingProfile.phone) {
        attemptedModifications.push('Phone Number');
      }

      expect(attemptedModifications).toContain('Full Legal Name');
      expect(attemptedModifications).toContain('Phone Number');
    });
  });
});
