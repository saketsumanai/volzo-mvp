/**
 * Rate Limiting Middleware
 * Enterprise DDoS, brute-force, and credential-stuffing defense
 */

const rateLimit = require('express-rate-limit');

// General API Rate Limiter
const rateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? (parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 150) : 100000,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again after 15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Strict Rate Limiter for Authentication & OTP Endpoints (Brute force protection)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 10 : 1000,
  message: {
    success: false,
    message: 'Too many login / authentication attempts. Please try again after 15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Payment Rate Limiter (Prevents transaction spam & race conditions)
const paymentLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: process.env.NODE_ENV === 'production' ? 20 : 1000,
  message: {
    success: false,
    message: 'Payment request limit exceeded. Please wait a few minutes before trying again'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Strict limiter for sensitive ops
const strictRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    message: 'Too many attempts, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false
});

module.exports = {
  rateLimiter,
  authLimiter,
  paymentLimiter,
  strictRateLimiter
};

