const errorHandler = (err, req, res, next) => {
  // ── PayloadTooLargeError — Body exceeds 2MB transport limit ───────────────
  // This triggers when express.json({ limit: '2mb' }) is exceeded.
  // A correctly compressed image should never reach this point; this is a
  // backend safety net against bypass attempts.
  if (err.type === 'entity.too.large' || err.status === 413) {
    return res.status(413).json({
      success: false,
      message: 'Profile photo must be 1MB or smaller. Please compress and try again.',
    });
  }

  // ── Mongoose Validation Error ─────────────────────────────────────────────
  if (err.name === 'ValidationError') {
    const formattedErrors = Object.values(err.errors || {}).map((e) => ({
      field: e.path,
      message: e.message,
    }));
    return res.status(400).json({
      success: false,
      message: err.message || 'Validation failed',
      errors: formattedErrors,
    });
  }

  // ── Mongoose CastError (e.g. invalid ObjectId) ────────────────────────────
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: `Invalid format for field '${err.path}': ${err.value}`,
    });
  }

  console.error('API Error Stack:', err.stack || err);

  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal Server Error',
    errors: err.errors || null,
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
};

module.exports = errorHandler;

