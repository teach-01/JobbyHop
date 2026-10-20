const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cloudinary = require('cloudinary').v2;
const { detectImageMimeFromBuffer } = require('./imageValidator');

const UPLOADS_DIR = path.join(__dirname, '../../uploads');

// Ensure local uploads directory exists for fallback and local storage
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

/**
 * Checks if Cloudinary is configured via environment variables.
 * Read strictly from backend environment variables.
 * @returns {boolean}
 */
function isCloudinaryConfigured() {
  const name = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const key = process.env.CLOUDINARY_API_KEY?.trim();
  const secret = process.env.CLOUDINARY_API_SECRET?.trim();
  const url = process.env.CLOUDINARY_URL?.trim();
  return Boolean((name && key && secret) || url);
}

/**
 * Configures and returns the Cloudinary v2 instance.
 */
function getCloudinary() {
  const url = process.env.CLOUDINARY_URL?.trim();
  const name = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const key = process.env.CLOUDINARY_API_KEY?.trim();
  const secret = process.env.CLOUDINARY_API_SECRET?.trim();

  if (url) {
    cloudinary.config();
  } else if (name && key && secret) {
    cloudinary.config({
      cloud_name: name,
      api_key: key,
      api_secret: secret,
      secure: true,
    });
  }
  return cloudinary;
}

/**
 * Extracts the Cloudinary public_id from a secure/insecure Cloudinary URL.
 * Example: https://res.cloudinary.com/demo/image/upload/v1234/jobbyhop/profiles/sample.jpg
 * returns: "jobbyhop/profiles/sample"
 * @param {string} url
 * @returns {string|null}
 */
function extractCloudinaryPublicId(url) {
  if (!url || typeof url !== 'string') return null;
  if (!url.includes('res.cloudinary.com')) return null;
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split('/');
    const uploadIdx = parts.indexOf('upload');
    if (uploadIdx === -1) return null;
    let pathAfterUpload = parts.slice(uploadIdx + 1);
    // Remove version segment if present (e.g. v1712345678)
    if (pathAfterUpload[0] && /^v\d+$/.test(pathAfterUpload[0])) {
      pathAfterUpload = pathAfterUpload.slice(1);
    }
    const fullPathWithExt = pathAfterUpload.join('/');
    const lastDot = fullPathWithExt.lastIndexOf('.');
    return lastDot !== -1 ? fullPathWithExt.substring(0, lastDot) : fullPathWithExt;
  } catch {
    return null;
  }
}

/**
 * Saves a base64 image string.
 * If Cloudinary is configured, uploads to Cloudinary and returns the secure HTTPS URL.
 * Otherwise, falls back to the local filesystem (backend/uploads/) and returns /uploads/<filename>.
 * If the input is already a URL or local path, returns it as-is.
 * 
 * @param {string} photoString - The base64 data URL or HTTP URL.
 * @param {object} [options] - Optional settings (folder, prefix).
 * @returns {Promise<string>} The public URL or path for the saved image.
 */
async function saveBase64Image(photoString, options = {}) {
  if (!photoString || typeof photoString !== 'string') return '';

  const trimmed = photoString.trim();

  // If it's already an external URL or an internal uploads URL, return it
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('/uploads/')) {
    return trimmed;
  }

  let base64Data = trimmed;
  let mimePrefix = null;
  if (trimmed.startsWith('data:')) {
    const prefixMatch = trimmed.match(/^data:([^;]+);base64,/i);
    if (!prefixMatch) {
      throw new Error('Invalid base64 image format.');
    }
    mimePrefix = prefixMatch[1];
    base64Data = trimmed.slice(prefixMatch[0].length);
  }

  const buffer = Buffer.from(base64Data, 'base64');
  if (!buffer || buffer.length === 0) {
    throw new Error('Empty image buffer.');
  }

  const detectedMime = detectImageMimeFromBuffer(buffer);
  const mime = detectedMime || mimePrefix || 'image/jpeg';
  let ext = '.jpg';
  if (mime === 'image/png') ext = '.png';
  if (mime === 'image/webp') ext = '.webp';
  if (mime === 'image/jpeg') ext = '.jpg';

  // 1. If Cloudinary is configured, upload to Cloudinary
  if (isCloudinaryConfigured()) {
    try {
      const cld = getCloudinary();
      const folder = options.folder || 'jobbyhop/profiles';
      const dataUri = `data:${mime};base64,${base64Data}`;
      const result = await cld.uploader.upload(dataUri, {
        folder,
        resource_type: 'image',
      });
      if (result && result.secure_url) {
        console.log(`[ImageStorage] Uploaded image to Cloudinary folder "${folder}": ${result.secure_url}`);
        return result.secure_url;
      }
      throw new Error('Cloudinary response missing secure_url.');
    } catch (cldErr) {
      console.error('[ImageStorage] Cloudinary upload failed:', cldErr?.message || 'Unknown error');
      // In production, NEVER fall back to local ephemeral disk storage
      if (process.env.NODE_ENV === 'production' || options.throwOnError) {
        throw new Error('Cloudinary upload failed: ' + (cldErr?.message || 'Unknown error'));
      }
      // In test/local-dev mode only, fall through to local disk storage if configured
    }
  } else {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Cloudinary credentials are not configured in production environment.');
    }
    console.log('[ImageStorage] Cloudinary not configured in environment. Using local storage fallback.');
  }

  // 2. Fallback: Save to local filesystem (local dev / test mode only)
  const uniqueSuffix = Date.now() + '-' + crypto.randomBytes(6).toString('hex');
  const filename = `${options.prefix || 'profile-'}${uniqueSuffix}${ext}`;
  const filepath = path.join(UPLOADS_DIR, filename);

  await fs.promises.writeFile(filepath, buffer);

  return `/uploads/${filename}`;
}

/**
 * Saves a binary image Buffer directly to Cloudinary or local storage.
 * @param {Buffer} buffer - Binary image buffer.
 * @param {string} [mimeType] - Mime type of the image.
 * @param {object} [options] - Optional settings (folder, prefix).
 * @returns {Promise<string>} The public URL or path for the saved image.
 */
async function saveImageBuffer(buffer, mimeType, options = {}) {
  if (!buffer || buffer.length === 0) {
    throw new Error('Empty image buffer.');
  }
  const detectedMime = detectImageMimeFromBuffer(buffer);
  const mime = detectedMime || mimeType || 'image/jpeg';
  const base64Data = buffer.toString('base64');
  return saveBase64Image(`data:${mime};base64,${base64Data}`, options);
}

/**
 * Deletes a saved image from Cloudinary or local filesystem.
 * @param {string} photoUrl - The URL or path of the image to delete.
 */
async function deleteSavedImage(photoUrl) {
  if (!photoUrl || typeof photoUrl !== 'string') return;

  // Handle Cloudinary URL
  if (photoUrl.includes('res.cloudinary.com')) {
    try {
      const publicId = extractCloudinaryPublicId(photoUrl);
      if (publicId && isCloudinaryConfigured()) {
        const cld = getCloudinary();
        await cld.uploader.destroy(publicId);
      }
    } catch (err) {
      console.error(`Failed to delete Cloudinary image ${photoUrl}:`, err);
    }
    return;
  }

  // Handle local filesystem
  if (photoUrl.startsWith('/uploads/')) {
    try {
      const filename = photoUrl.replace('/uploads/', '');
      const filepath = path.join(UPLOADS_DIR, filename);
      if (fs.existsSync(filepath)) {
        await fs.promises.unlink(filepath);
      }
    } catch (err) {
      console.error(`Failed to delete old image ${photoUrl}:`, err);
    }
  }
}

/**
 * Creates a duplicate of an existing image for audit history preservation.
 * @param {string} photoUrl - The URL of the image to duplicate.
 * @returns {Promise<string>} The public URL for the duplicated image.
 */
async function duplicateSavedImage(photoUrl) {
  if (!photoUrl || typeof photoUrl !== 'string') return photoUrl || '';

  // Cloudinary duplication for audit
  if (photoUrl.includes('res.cloudinary.com')) {
    if (isCloudinaryConfigured()) {
      try {
        const cld = getCloudinary();
        const result = await cld.uploader.upload(photoUrl, {
          folder: 'jobbyhop/audit',
          resource_type: 'image',
        });
        if (result && result.secure_url) {
          return result.secure_url;
        }
      } catch (err) {
        console.error(`Failed to duplicate Cloudinary image ${photoUrl}:`, err);
      }
    }
    return photoUrl;
  }

  // Local filesystem duplication
  if (photoUrl.startsWith('/uploads/')) {
    try {
      const filename = photoUrl.replace('/uploads/', '');
      const filepath = path.join(UPLOADS_DIR, filename);

      if (fs.existsSync(filepath)) {
        const ext = path.extname(filename);
        const uniqueSuffix = Date.now() + '-' + crypto.randomBytes(6).toString('hex');
        const newFilename = `audit-${uniqueSuffix}${ext}`;
        const newFilepath = path.join(UPLOADS_DIR, newFilename);

        await fs.promises.copyFile(filepath, newFilepath);
        return `/uploads/${newFilename}`;
      }
    } catch (err) {
      console.error(`Failed to duplicate image ${photoUrl}:`, err);
    }
  }

  return photoUrl;
}

module.exports = {
  UPLOADS_DIR,
  isCloudinaryConfigured,
  getCloudinary,
  extractCloudinaryPublicId,
  saveBase64Image,
  saveImageBuffer,
  deleteSavedImage,
  duplicateSavedImage,
};
