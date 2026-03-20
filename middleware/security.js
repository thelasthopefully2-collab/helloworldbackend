const crypto = require('crypto');

// Generate a secure API key
const generateApiKey = () => {
    return crypto.randomBytes(32).toString('hex');
};

// API Key validation middleware
const validateApiKey = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    const validApiKey = process.env.API_KEY;

    // Skip validation if no API_KEY is set in env (development mode)
    if (!validApiKey) {
        return next();
    }

    if (!apiKey) {
        return res.status(401).json({
            error: 'Unauthorized',
            message: 'API key is required'
        });
    }

    if (apiKey !== validApiKey) {
        return res.status(403).json({
            error: 'Forbidden',
            message: 'Invalid API key'
        });
    }

    next();
};

const validateSession = (req, res, next) => {
    const sessionId = req.body.sessionId || req.params.sessionId;

    if (!sessionId) {
        return res.status(400).json({
            error: 'Bad Request',
            message: 'Session ID is required'
        });
    }

    const sessionPattern = /^session_\d+_[a-z0-9]+$/;
    if (!sessionPattern.test(sessionId)) {
        return res.status(400).json({
            error: 'Bad Request',
            message: 'Invalid session ID format'
        });
    }

    next();
};


const requestCounts = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS = 100; // 100 requests per minute

const rateLimiter = (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();

    if (!requestCounts.has(ip)) {
        requestCounts.set(ip, { count: 1, firstRequest: now });
        return next();
    }

    const record = requestCounts.get(ip);

    // Reset if window has passed
    if (now - record.firstRequest > RATE_LIMIT_WINDOW) {
        requestCounts.set(ip, { count: 1, firstRequest: now });
        return next();
    }

    // Increment count
    record.count++;

    if (record.count > MAX_REQUESTS) {
        return res.status(429).json({
            error: 'Too Many Requests',
            message: 'Rate limit exceeded. Please try again later.',
            retryAfter: Math.ceil((RATE_LIMIT_WINDOW - (now - record.firstRequest)) / 1000)
        });
    }

    next();
};

// Clean up old rate limit records periodically
setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of requestCounts.entries()) {
        if (now - record.firstRequest > RATE_LIMIT_WINDOW * 2) {
            requestCounts.delete(ip);
        }
    }
}, RATE_LIMIT_WINDOW);

// Input sanitization middleware
const sanitizeInput = (req, res, next) => {
    // Sanitize body
    if (req.body) {
        req.body = sanitizeObject(req.body);
    }
    // Sanitize query params
    if (req.query) {
        req.query = sanitizeObject(req.query);
    }
    // Sanitize params
    if (req.params) {
        req.params = sanitizeObject(req.params);
    }
    next();
};

const sanitizeObject = (obj) => {
    if (typeof obj !== 'object' || obj === null) {
        return sanitizeValue(obj);
    }

    const sanitized = Array.isArray(obj) ? [] : {};

    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            // Block MongoDB operators
            if (key.startsWith('$')) {
                continue;
            }
            sanitized[key] = sanitizeObject(obj[key]);
        }
    }

    return sanitized;
};

const sanitizeValue = (value) => {
    if (typeof value === 'string') {
        // Remove potential script tags and SQL injection patterns
        return value
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/javascript:/gi, '')
            .replace(/on\w+\s*=/gi, '')
            .trim();
    }
    return value;
};

// Admin authentication middleware (for protected admin routes)
const adminAuth = (req, res, next) => {
    const adminKey = req.headers['x-admin-key'];
    const validAdminKey = process.env.ADMIN_KEY;

    if (!validAdminKey) {
        return res.status(503).json({
            error: 'Service Unavailable',
            message: 'Admin access is not configured'
        });
    }

    if (!adminKey || adminKey !== validAdminKey) {
        return res.status(403).json({
            error: 'Forbidden',
            message: 'Admin access required'
        });
    }

    next();
};

// Request logging middleware
const requestLogger = (req, res, next) => {
    const start = Date.now();

    res.on('finish', () => {
        const duration = Date.now() - start;
        const log = {
            method: req.method,
            path: req.path,
            status: res.statusCode,
            duration: `${duration}ms`,
            ip: req.ip || req.connection.remoteAddress,
            userAgent: req.headers['user-agent']?.substring(0, 50)
        };

        // Only log in development or for errors
        if (process.env.NODE_ENV !== 'production' || res.statusCode >= 400) {
            console.log(`[${new Date().toISOString()}]`, JSON.stringify(log));
        }
    });

    next();
};

// Security headers middleware
const securityHeaders = (req, res, next) => {
    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'DENY');
    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // XSS protection
    res.setHeader('X-XSS-Protection', '1; mode=block');
    // Referrer policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    // Remove X-Powered-By header
    res.removeHeader('X-Powered-By');

    next();
};

module.exports = {
    generateApiKey,
    validateApiKey,
    validateSession,
    rateLimiter,
    sanitizeInput,
    adminAuth,
    requestLogger,
    securityHeaders
};
