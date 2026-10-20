import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * Mirror / import test of the resolveAssetUrl logic deployed in frontend/src/utils/assetUrl.js
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

describe('Frontend Asset URL Resolution Suite', () => {
  it('returns empty string for null, undefined, or empty values', () => {
    expect(resolveAssetUrl(null)).toBe('');
    expect(resolveAssetUrl(undefined)).toBe('');
    expect(resolveAssetUrl('')).toBe('');
    expect(resolveAssetUrl('   ')).toBe('');
  });

  it('preserves Cloudinary HTTPS URLs without alteration', () => {
    const cldUrl = 'https://res.cloudinary.com/jobbyhop/image/upload/v12345/jobbyhop/profiles/worker_1.png';
    expect(resolveAssetUrl(cldUrl, 'http://localhost:5000', 'https://jobbyhop.vercel.app')).toBe(cldUrl);
  });

  it('preserves external HTTP and HTTPS URLs', () => {
    const unsplash = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150';
    expect(resolveAssetUrl(unsplash)).toBe(unsplash);
  });

  it('preserves data: URIs and blob: URIs', () => {
    const dataUri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const blobUri = 'blob:http://localhost:5173/1234-5678';
    expect(resolveAssetUrl(dataUri)).toBe(dataUri);
    expect(resolveAssetUrl(blobUri)).toBe(blobUri);
  });

  it('resolves relative /uploads/ URLs to VITE_BACKEND_URL in production (Vercel)', () => {
    const localUpload = '/uploads/profile-1792343235398-bf324975ee42.png';
    const backendEnv = 'https://jobbyhop-api.onrender.com';
    const vercelOrigin = 'https://jobbyhop.vercel.app';

    const resolved = resolveAssetUrl(localUpload, backendEnv, vercelOrigin);
    expect(resolved).toBe('https://jobbyhop-api.onrender.com/uploads/profile-1792343235398-bf324975ee42.png');
  });

  it('resolves relative uploads without leading slash correctly', () => {
    const localUpload = 'uploads/profile-123.jpg';
    const backendEnv = 'https://jobbyhop-api.onrender.com';
    const vercelOrigin = 'https://jobbyhop.vercel.app';

    const resolved = resolveAssetUrl(localUpload, backendEnv, vercelOrigin);
    expect(resolved).toBe('https://jobbyhop-api.onrender.com/uploads/profile-123.jpg');
  });

  it('falls back to window.location.origin in local dev if VITE_BACKEND_URL is not set', () => {
    const localUpload = '/uploads/profile-123.jpg';
    const resolved = resolveAssetUrl(localUpload, '', 'http://localhost:5173');
    expect(resolved).toBe('http://localhost:5173/uploads/profile-123.jpg');
  });
});
