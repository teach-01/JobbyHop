const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { detectImageMimeFromBuffer } = require('./imageValidator');

const UPLOADS_DIR = path.join(__dirname, '../../uploads');

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

/**
 * Saves a base64 image string to the local filesystem and returns the URL.
 * If the input is already a URL, returns it as is.
 * @param {string} photoString - The base64 data URL or HTTP URL.
 * @returns {string} The public URL for the saved image.
 */
async function saveBase64Image(photoString) {
  if (!photoString || typeof photoString !== 'string') return '';

  const trimmed = photoString.trim();

  // If it's already an external URL or an internal uploads URL, return it
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('/uploads/')) {
    return trimmed;
  }

  let base64Data = trimmed;
  if (trimmed.startsWith('data:')) {
    const prefixMatch = trimmed.match(/^data:([^;]+);base64,/i);
    if (!prefixMatch) {
      throw new Error('Invalid base64 image format.');
    }
    base64Data = trimmed.slice(prefixMatch[0].length);
  }

  const buffer = Buffer.from(base64Data, 'base64');
  if (!buffer || buffer.length === 0) {
    throw new Error('Empty image buffer.');
  }

  const mime = detectImageMimeFromBuffer(buffer);
  let ext = '.jpg';
  if (mime === 'image/png') ext = '.png';
  if (mime === 'image/webp') ext = '.webp';
  if (mime === 'image/jpeg') ext = '.jpg';

  const uniqueSuffix = Date.now() + '-' + crypto.randomBytes(6).toString('hex');
  const filename = `profile-${uniqueSuffix}${ext}`;
  const filepath = path.join(UPLOADS_DIR, filename);

  await fs.promises.writeFile(filepath, buffer);

  return `/uploads/${filename}`;
}

/**
 * Deletes a saved image from the filesystem.
 * @param {string} photoUrl - The URL of the image to delete (e.g. /uploads/profile-123.jpg)
 */
async function deleteSavedImage(photoUrl) {
  if (!photoUrl || typeof photoUrl !== 'string') return;
  if (!photoUrl.startsWith('/uploads/')) return; // Don't delete external URLs or base64

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

/**
 * Creates a duplicate of an existing local image, ensuring historical snapshots don't break.
 * @param {string} photoUrl - The URL of the image to duplicate.
 * @returns {string} The public URL for the duplicated image.
 */
async function duplicateSavedImage(photoUrl) {
  if (!photoUrl || typeof photoUrl !== 'string') return photoUrl || '';
  if (!photoUrl.startsWith('/uploads/')) return photoUrl;

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
  return photoUrl;
}

module.exports = {
  saveBase64Image,
  deleteSavedImage,
  duplicateSavedImage,
};
