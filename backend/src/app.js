const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/authRoutes');
const recruiterRoutes = require('./routes/recruiterRoutes');
const workerRoutes = require('./routes/workerRoutes');
const adminRoutes = require('./routes/adminRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const operationsRoutes = require('./routes/operationsRoutes');
const contactRoutes = require('./routes/contactRoutes');
const recruiterPaymentRoutes = require('./routes/recruiterPaymentRoutes');
const recruiterCollectionRoutes = require('./routes/recruiterCollectionRoutes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Trust the first proxy hop in front of the app (Render's load balancer / TLS terminator).
// Render, like Heroku/Railway, forwards the real client IP via X-Forwarded-For.
// Setting this to 1 (not `true`) means only the immediate upstream proxy is trusted —
// express-rate-limit v7 requires this to be set, or it throws ERR_ERL_UNEXPECTED_X_FORWARDED_FOR.
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({ crossOriginResourcePolicy: false }));

// CORS configuration
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://jobbyhop.vercel.app',
];

if (process.env.FRONTEND_URL) {
  const normalized = process.env.FRONTEND_URL.replace(/\/+$/, '');
  if (!allowedOrigins.includes(normalized)) {
    allowedOrigins.push(normalized);
  }
}

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. curl, mobile apps, server-to-server)
      if (!origin) return callback(null, true);
      const cleanOrigin = origin.replace(/\/+$/, '');
      if (allowedOrigins.includes(cleanOrigin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS origin not allowed: ${origin}`));
    },
    credentials: true,
  })
);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500, // 500 requests per 15 minutes
  message: { success: false, message: 'Too many requests, please try again later.' },
});
app.use('/api', limiter);

// Body parsing — limit allows 1MB image as base64 (+~37% base64 overhead = ~1.37MB), plus JSON overhead.
// Anything above 2MB is rejected immediately at the transport layer.
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Static uploads folder
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'JOBBYHOP API Platform',
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/recruiter', recruiterRoutes);
app.use('/api/worker', workerRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/operations', operationsRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/recruiter-payments', recruiterPaymentRoutes);
app.use('/api/admin/recruiter-payments', recruiterPaymentRoutes);
app.use('/api/admin/recruiter-collections', recruiterCollectionRoutes);
app.use('/api/recruiter-collections', recruiterCollectionRoutes);

// Centralized error handler
app.use(errorHandler);

module.exports = app;
