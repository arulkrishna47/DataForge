// server/src/middleware/security.js
// Free security middleware implementing rate limiting, headers, sanitization, CORS, etc.

const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const helmet = require('helmet');
const xss = require('xss');
const hpp = require('hpp');
const mongoSanitize = require('express-mongo-sanitize');
const cors = require('cors');
const compression = require('compression');

// ---------- Rate Limiters ----------
// General API limiter: 100 req per 15 min per IP
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests from this IP.', retryAfter: '15 minutes' },
  skip: (req) => req.path === '/api/health',
});

// Auth routes limiter: 10 attempts per 15 min
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts.', retryAfter: '15 minutes' },
});

// Annotation heavy endpoint limiter: 20 jobs per hour
const annotationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: { error: 'Annotation limit reached.', retryAfter: '1 hour' },
});

// Dataset search limiter: 60 searches per 15 min
const searchLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: { error: 'Search rate limit reached.', retryAfter: '15 minutes' },
});

// Slow down after many requests
const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000,
  delayAfter: 50,
  delayMs: (used) => (used - 50) * 500,
});

// ---------- Security Headers ----------
const securityHeaders = helmet({
  frameguard: { action: 'deny' },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  noSniff: true,
  xssFilter: true,
  hidePoweredBy: true,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://js.stripe.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      connectSrc: ["'self'", process.env.CLIENT_URL || 'http://localhost:5173', "https://api.stripe.com"],
      frameSrc: ["https://js.stripe.com"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
    },
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
});

// ---------- Input Sanitization ----------
const sanitizeInput = (req, res, next) => {
  const sanitize = (value) => {
    if (typeof value === 'string') return xss(value.trim());
    if (Array.isArray(value)) return value.map(sanitize);
    if (value && typeof value === 'object') {
      const clean = {};
      for (const k of Object.keys(value)) {
        if (['__proto__', 'constructor', 'prototype'].includes(k)) continue;
        clean[k] = sanitize(value[k]);
      }
      return clean;
    }
    return value;
  };
  if (req.body) req.body = sanitize(req.body);
  if (req.query) req.query = sanitize(req.query);
  if (req.params) req.params = sanitize(req.params);
  next();
};

// ---------- Parameter Pollution ----------
const preventParamPollution = (req, res, next) => {
  for (const key of Object.keys(req.query)) {
    if (Array.isArray(req.query[key])) {
      req.query[key] = req.query[key].slice(-1)[0];
    }
  }
  next();
};

// ---------- Request Size Limiter ----------
const requestSizeLimiter = (maxMB = 10) => (req, res, next) => {
  const contentLength = parseInt(req.headers['content-length'] || '0');
  if (contentLength > maxMB * 1024 * 1024) {
    return res.status(413).json({ error: `Request too large. Max ${maxMB}MB` });
  }
  next();
};

// ---------- Suspicious Request Detector ----------
const BLOCKED_PATTERNS = [
  /\.\.\//g,
  /<script/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,
  /union\s+select/gi,
  /drop\s+table/gi,
  /exec\s*\(/gi,
  /eval\s*\(/gi,
  /base64_decode/gi,
  /\x00/g,
];

const detectSuspiciousRequests = (req, res, next) => {
  const check = (val) => {
    if (typeof val === 'string') return BLOCKED_PATTERNS.some(p => p.test(val));
    if (val && typeof val === 'object') return Object.values(val).some(check);
    return false;
  };
  if (check(req.body) || check(req.query) || check(req.params)) {
    console.warn(`[SECURITY] Suspicious request blocked from ${req.ip}`);
    return res.status(400).json({ error: 'Invalid request content' });
  }
  next();
};

// ---------- Simple IP Blocker ----------
const blockedIPs = new Set();
const failedAttempts = new Map();
const trackFailedAttempts = (ip) => {
  const now = Date.now();
  const record = failedAttempts.get(ip);
  if (record) {
    if (now - record.lastAttempt > 3600000) {
      failedAttempts.set(ip, { count: 1, lastAttempt: now });
      return false;
    }
    record.count++;
    record.lastAttempt = now;
    if (record.count >= 20) {
      blockedIPs.add(ip);
      console.warn(`[SECURITY] IP blocked after ${record.count} failed attempts: ${ip}`);
      return true;
    }
  } else {
    failedAttempts.set(ip, { count: 1, lastAttempt: now });
  }
  return false;
};

const ipBlocker = (req, res, next) => {
  const ip = req.ip || req.connection?.remoteAddress || '';
  if (blockedIPs.has(ip)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  next();
};

// ---------- CORS Hardening ----------
const corsOptions = {
  origin: (origin, callback) => {
    const allowed = [
      process.env.CLIENT_URL || 'http://localhost:5173',
      'http://localhost:3000',
      'http://localhost:5174',
      process.env.PRODUCTION_URL || '',
    ].filter(Boolean);
    if (!origin || allowed.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`[SECURITY] CORS blocked: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  maxAge: 86400,
};

// ---------- File Upload Validation ----------
const ALLOWED_TYPES = [
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/bmp', 'image/tiff',
  'video/mp4', 'video/avi', 'video/quicktime', 'video/x-msvideo', 'video/webm', 'video/x-matroska',
  'application/zip', 'application/x-zip-compressed',
];

const validateFileUpload = (req, res, next) => {
  if (!req.files || !Array.isArray(req.files) || req.files.length === 0) return next();
  const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB
  const MAX_FILES = 100;
  if (req.files.length > MAX_FILES) {
    return res.status(400).json({ error: `Max ${MAX_FILES} files allowed` });
  }
  for (const file of req.files) {
    if (file.size > MAX_FILE_SIZE) {
      return res.status(400).json({ error: `File ${file.originalname} exceeds 500MB` });
    }
    if (!ALLOWED_TYPES.includes(file.mimetype)) {
      return res.status(400).json({ error: `File type ${file.mimetype} not allowed` });
    }
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    if (safeName !== file.originalname) file.originalname = safeName;
    const ext = safeName.split('.').pop()?.toLowerCase();
    const validExts = ['jpg','jpeg','png','webp','bmp','tiff','mp4','avi','mov','webm','mkv','zip'];
    if (!ext || !validExts.includes(ext)) {
      return res.status(400).json({ error: `Invalid file extension: ${ext}` });
    }
  }
  next();
};

// ---------- Security Logger ----------
const securityLogger = (req, res, next) => {
  const ip = req.ip || req.connection?.remoteAddress;
  const ua = req.headers['user-agent'] || '';
  const suspiciousUA = ['sqlmap','nikto','masscan','nmap','zgrab','curl/7'];
  if (suspiciousUA.some(s => ua.toLowerCase().includes(s))) {
    console.warn(`[SECURITY] Suspicious UA: ${ua} from ${ip} -> ${req.method} ${req.path}`);
  }
  if (req.path.includes('/api/auth')) {
    console.log(`[AUTH] ${req.method} ${req.path} from ${ip}`);
  }
  next();
};

module.exports = {
  generalLimiter,
  authLimiter,
  annotationLimiter,
  searchLimiter,
  speedLimiter,
  securityHeaders,
  sanitizeInput,
  preventParamPollution,
  requestSizeLimiter,
  detectSuspiciousRequests,
  ipBlocker,
  corsOptions,
  validateFileUpload,
  securityLogger,
  trackFailedAttempts,
};
