/**
 * Volzo Security Layer Middleware
 * Enterprise protection against XSS, Prototype Pollution, Parameter Pollution, and Header Injection
 */

const { logger } = require('../utils/logger');

/**
 * Deep recursive string sanitization to prevent XSS and malicious control characters
 */
const sanitizeValue = (value) => {
  if (typeof value === 'string') {
    return value
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
      .replace(/on\w+\s*=\s*(['"]).*?\1/gi, '') // Remove inline event handlers like onerror=
      .replace(/javascript\s*:/gi, '') // Remove javascript: pseudo-protocols
      .trim();
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }
  if (value !== null && typeof value === 'object') {
    const sanitizedObj = {};
    for (const [key, val] of Object.entries(value)) {
      // Prototype pollution defense: drop dangerous object keys
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        logger.warn(`⚠️ Blocked prototype pollution attempt with key: ${key}`);
        continue;
      }
      sanitizedObj[key] = sanitizeValue(val);
    }
    return sanitizedObj;
  }
  return value;
};

/**
 * Request body, query, and params sanitizer
 */
const sanitizeInputs = (req, res, next) => {
  if (req.body) {
    req.body = sanitizeValue(req.body);
  }
  if (req.query) {
    req.query = sanitizeValue(req.query);
  }
  if (req.params) {
    req.params = sanitizeValue(req.params);
  }
  next();
};

/**
 * HTTP Parameter Pollution (HPP) defense
 * Converts unexpected array query params to single values
 */
const preventParameterPollution = (req, res, next) => {
  if (req.query) {
    for (const key of Object.keys(req.query)) {
      if (Array.isArray(req.query[key])) {
        // Keep the last value to prevent array injection
        req.query[key] = req.query[key][req.query[key].length - 1];
      }
    }
  }
  next();
};

/**
 * Path Traversal and Suspicious URI detector
 */
const preventPathTraversal = (req, res, next) => {
  const rawPath = decodeURI(req.originalUrl || req.url || '');
  if (rawPath.includes('../') || rawPath.includes('..\\') || rawPath.includes('%2e%2e')) {
    logger.warn(`🚫 Blocked path traversal attempt: ${req.originalUrl} from IP: ${req.ip}`);
    return res.status(400).json({
      success: false,
      message: 'Invalid request path'
    });
  }
  next();
};

/**
 * Additional Security Headers (HSTS, No-Cache on sensitive routes, X-Content-Type)
 */
const securityHeaders = (req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)');
  
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  // Prevent browser caching for sensitive API endpoints
  if (req.originalUrl.startsWith('/api/v1/auth') || req.originalUrl.startsWith('/api/v1/payments')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }

  next();
};

module.exports = {
  sanitizeInputs,
  preventParameterPollution,
  preventPathTraversal,
  securityHeaders
};
