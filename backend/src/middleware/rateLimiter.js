/**
 * Rate Limiting Middleware
 * Prevents API abuse
 */

const rateLimit = require('express-rate-limit');

const rateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? (parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100) : 100000,
  message: {
    success: false,
    message: 'Too many requests, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false
});

const strictRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    message: 'Too many attempts, please try again later'
  }
});

module.exports = { rateLimiter, strictRateLimiter };
