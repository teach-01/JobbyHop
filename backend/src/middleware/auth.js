const User = require('../models/User');
const { verifyToken } = require('../utils/jwt');
const { ROLES } = require('../config/constants');

const protect = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication token missing. Please log in.',
      });
    }

    const decoded = verifyToken(token);
    const user = await User.findById(decoded.id).select('-passwordHash');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid user session. User no longer exists.',
      });
    }

    if (user.isDeleted || user.status === 'DELETED') {
      return res.status(401).json({
        success: false,
        message: 'Your account has been deleted.',
      });
    }

    if (user.status === 'SUSPENDED') {
      return res.status(403).json({
        success: false,
        message: 'Your account has been suspended by Admin.',
      });
    }
    
    if (user.status === 'BLOCKED' || user.status === 'DEACTIVATED') {
      return res.status(403).json({
        success: false,
        message: `Your account has been ${user.status.toLowerCase()}.`,
      });
    }

    if (user.mustChangePassword && !req.originalUrl.includes('/force-change-password')) {
      return res.status(403).json({
        success: false,
        message: 'Password change required.',
        requirePasswordChange: true,
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: Invalid or expired token',
    });
  }
};

const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    // Admin can access any role-protected resource if needed, unless strictly restricted
    if (req.user.role === ROLES.ADMIN || allowedRoles.includes(req.user.role)) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: `Access denied. Role '${req.user.role}' is not authorized to access this resource.`,
    });
  };
};

module.exports = {
  protect,
  requireRole,
};
