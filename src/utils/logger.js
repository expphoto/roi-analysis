const crypto = require('crypto');

const hashEmail = (email) => {
  return crypto.createHash('sha256').update(email.toLowerCase()).digest('hex').substring(0, 16);
};

function normalizeIP(ip) {
  if (!ip) return '';
  // Normalize IPv6-mapped IPv4 and loopback addresses for consistency
  if (ip.startsWith('::ffff:')) {
    return ip.split(':').pop();
  }
  if (ip === '::1') return '127.0.0.1';
  return ip;
}

const hashIP = (ip) => {
  const n = normalizeIP(ip);
  return crypto.createHash('sha256').update(n).digest('hex').substring(0, 16);
};

const logger = {
  info: (message, email = null) => {
    const timestamp = new Date().toISOString();
    const emailHash = email ? ` [email:${hashEmail(email)}]` : '';
    console.log(`[${timestamp}] INFO:${emailHash} ${message}`);
  },
  
  error: (message, error = null, email = null) => {
    const timestamp = new Date().toISOString();
    const emailHash = email ? ` [email:${hashEmail(email)}]` : '';
    const errorDetails = error ? ` - ${error.message}` : '';
    console.error(`[${timestamp}] ERROR:${emailHash} ${message}${errorDetails}`);
  },
  
  warn: (message, email = null) => {
    const timestamp = new Date().toISOString();
    const emailHash = email ? ` [email:${hashEmail(email)}]` : '';
    console.warn(`[${timestamp}] WARN:${emailHash} ${message}`);
  }
};

module.exports = { logger, hashEmail, hashIP, normalizeIP };
