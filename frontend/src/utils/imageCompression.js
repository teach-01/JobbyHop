/**
 * Image validation utility for profile photos.
 *
 * STRICT POLICY — no compression, no resizing:
 *   - Allowed formats : JPG / JPEG / PNG / WEBP
 *   - Maximum size    : 1,000,000 bytes (checked via file.size BEFORE any FileReader)
 *   - Oversized files : rejected immediately — no preview, no state update, no upload
 */

export const MAX_PHOTO_SIZE_BYTES = 1_000_000; // exactly 1,000,000 bytes

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
export const ALLOWED_EXTENSIONS = /\.(jpe?g|png|webp)$/i;

/**
 * Validates a File object and, if valid, reads it as a base64 data URL.
 *
 * IMPORTANT — validation order:
 *   1. Presence check
 *   2. MIME / extension check   ← before any I/O
 *   3. file.size check           ← before any I/O (this is the critical gate)
 *   4. FileReader (only reached when the file passes all checks above)
 *
 * @param {File} file
 * @returns {Promise<{ dataUrl: string, sizeInBytes: number }>}
 */
export const validateAndProcessImageFile = (file) => {
  return new Promise((resolve, reject) => {
    // ── 1. Presence ──────────────────────────────────────────────────────────
    if (!file) {
      return reject(new Error('No image file selected.'));
    }

    // ── 2. Format (MIME + extension) ─────────────────────────────────────────
    const fileType = file.type ? file.type.toLowerCase() : '';
    const fileName = file.name || '';
    const isMimeValid = ALLOWED_IMAGE_TYPES.includes(fileType);
    const isExtValid = ALLOWED_EXTENSIONS.test(fileName);

    if (!isMimeValid && !isExtValid) {
      return reject(new Error('Only JPG, JPEG, PNG, and WEBP images are allowed.'));
    }

    // ── 3. Size — checked against file.size BEFORE any FileReader ────────────
    //
    //  file.size is the exact binary byte count reported by the OS / browser.
    //  This check runs synchronously, before any I/O, so an oversized file
    //  can never reach the preview, state, FormData, or API call.
    //
    if (file.size > MAX_PHOTO_SIZE_BYTES) {
      return reject(
        new Error(`Profile photo must be 1 MB or smaller. Selected file is ${(file.size / 1_000_000).toFixed(2)} MB.`)
      );
    }

    // ── 4. Read as data URL (only reached for valid, correctly-sized files) ──
    const reader = new FileReader();

    reader.onerror = () => reject(new Error('Failed to read image file.'));

    reader.onload = (e) => {
      const dataUrl = e.target.result;
      // dataUrl is the base64 representation; file.size is already validated.
      resolve({ dataUrl, sizeInBytes: file.size });
    };

    reader.readAsDataURL(file);
  });
};
