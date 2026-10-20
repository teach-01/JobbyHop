/**
 * Shared asset URL resolver for JobbyHop.
 *
 * Ensures all profile photos and logos resolve properly across environments:
 * 1. Absolute URLs (e.g. Cloudinary HTTPS URLs, external mocks, data URIs, blob URIs)
 *    are returned as-is.
 * 2. Relative `/uploads/` paths are prefixed with `VITE_BACKEND_URL` if configured,
 *    or fallback to window.location.origin (which works in local dev via Vite proxy).
 */
export function resolveAssetUrl(url) {
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

  const backendOrigin = (() => {
    try {
      const env =
        import.meta.env.VITE_BACKEND_URL ||
        (import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '') : '');
      if (env && typeof env === 'string') return env.replace(/\/+$/, '');
    } catch {
      // import.meta.env not available in test runners
    }
    return (typeof window !== 'undefined' && window.location?.origin)
      ? window.location.origin
      : '';
  })();

  const isUpload = trimmed.startsWith('/uploads/') || trimmed.startsWith('uploads/');
  const base = isUpload
    ? backendOrigin
    : ((typeof window !== 'undefined' && window.location?.origin) ? window.location.origin : backendOrigin);

  if (trimmed.startsWith('/')) {
    return `${base}${trimmed}`;
  }
  return `${base}/${trimmed}`;
}

export default resolveAssetUrl;
