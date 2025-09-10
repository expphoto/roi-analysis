const rateLimit = require('express-rate-limit');
const { logger } = require('../utils/logger');

const createRateLimiter = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    message: { error: message },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      const email = req.query.email || req.body.email || 'unknown';
      logger.warn(`Rate limit exceeded: ${message}`, email);
      res.status(429).json({ error: message });
    }
  });
};

const roiLimiter = createRateLimiter(
  15 * 60 * 1000,
  10, 
  'Too many ROI requests. Please try again in 15 minutes.'
);

const magicLinkLimiter = createRateLimiter(
  60 * 1000,
  3,
  'Too many magic link requests. Please try again in 1 minute.'
);

const generalLimiter = createRateLimiter(
  15 * 60 * 1000,
  100,
  'Too many requests. Please try again later.'
);

module.exports = {
  roiLimiter,
  magicLinkLimiter,
  generalLimiter
};