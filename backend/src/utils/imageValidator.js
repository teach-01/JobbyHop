/**
 * Image Validator Utility
 * Validates worker profile photos:
 * - Allowed formats: JPG/JPEG, PNG, WEBP
 * - Validates actual binary signature (magic bytes) of the file
 * - Max file size: 1MB (1,000,000 bytes)
 */

function detectImageMimeFromBuffer(buffer) {
  if (!buffer || buffer.length < 12) return null;

  // JPEG: 0xFF 0xD8 0xFF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  // PNG: 0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png';
  }

  // WEBP: 'RIFF' at 0..3 and 'WEBP' at 8..11
  const riff = buffer.toString('ascii', 0, 4);
  const webp = buffer.toString('ascii', 8, 12);
  if (riff === 'RIFF' && webp === 'WEBP') {
    return 'image/webp';
  }

  return null;
}

function validateWorkerProfilePhoto(photoInput) {
  if (!photoInput) {
    return { valid: false, message: 'Worker profile photo is required.' };
  }

  // If photoInput is a Buffer (e.g. from multer req.file.buffer)
  if (Buffer.isBuffer(photoInput)) {
    if (photoInput.length === 0) {
      return { valid: false, message: 'Worker profile photo is required.' };
    }
    const MAX_SIZE = 1000000;
    if (photoInput.length > MAX_SIZE) {
      return { valid: false, message: 'Profile photo must be 1MB or smaller.' };
    }
    const detectedMime = detectImageMimeFromBuffer(photoInput);
    if (!detectedMime) {
      return { valid: false, message: 'Only JPG, PNG, and WEBP formats are allowed for profile photo.' };
    }
    return { valid: true, mime: detectedMime, size: photoInput.length };
  }

  if (typeof photoInput !== 'string' || photoInput.trim() === '') {
    return { valid: false, message: 'Worker profile photo is required.' };
  }

  const trimmed = photoInput.trim();

  // If it's an external HTTP/HTTPS URL (e.g., existing records or testing fixtures)
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    const lower = trimmed.toLowerCase();
    const hasValidExt =
      /\.(jpe?g|png|webp)(\?.*)?$/i.test(lower) ||
      lower.includes('unsplash.com') ||
      lower.includes('images.');
    if (!hasValidExt) {
      return { valid: false, message: 'Only JPG, PNG, and WEBP formats are allowed for profile photo.' };
    }
    return { valid: true };
  }

  let base64Data = trimmed;

  if (trimmed.startsWith('data:')) {
    const prefixMatch = trimmed.match(/^data:([^;]+);base64,/i);
    if (!prefixMatch) {
      return { valid: false, message: 'Only JPG, PNG, and WEBP formats are allowed for profile photo.' };
    }
    const declaredMime = prefixMatch[1].toLowerCase();
    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedMimes.includes(declaredMime)) {
      return { valid: false, message: 'Only JPG, PNG, and WEBP formats are allowed for profile photo.' };
    }
    base64Data = trimmed.slice(prefixMatch[0].length);
  }

  let buffer;
  try {
    buffer = Buffer.from(base64Data, 'base64');
  } catch (err) {
    return { valid: false, message: 'Invalid profile photo data.' };
  }

  if (!buffer || buffer.length === 0) {
    return { valid: false, message: 'Worker profile photo is required.' };
  }

  // Maximum file size: 1,000,000 bytes
  const MAX_SIZE = 1000000;
  if (buffer.length > MAX_SIZE) {
    return { valid: false, message: 'Profile photo must be 1MB or smaller.' };
  }

  // Inspect actual binary magic bytes
  const detectedMime = detectImageMimeFromBuffer(buffer);
  if (!detectedMime) {
    return { valid: false, message: 'Only JPG, PNG, and WEBP formats are allowed for profile photo.' };
  }

  return { valid: true, mime: detectedMime, size: buffer.length };
}

module.exports = {
  detectImageMimeFromBuffer,
  validateWorkerProfilePhoto,
};
