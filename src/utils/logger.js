const crypto = require('crypto');

const hashEmail = (email) => {
  return crypto.createHash('sha256').update(email.toLowerCase()).digest('hex').substring(0, 16);
};

const hashIP = (ip) => {
  return crypto.createHash('sha256').update(ip).digest('hex').substring(0, 16);
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

module.exports = { logger, hashEmail, hashIP };