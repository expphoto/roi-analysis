const crypto = require('crypto');
const { logger } = require('../utils/logger');

class AuthService {
  constructor() {
    this.magicLinks = new Map();
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  generateMagicLink(email) {
    const token = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 15 * 60 * 1000);
    
    this.magicLinks.set(token, {
      email: email.toLowerCase(),
      expiry,
      used: false
    });

    logger.info('Generated magic link', email);
    return token;
  }

  validateMagicLink(token, email) {
    const linkData = this.magicLinks.get(token);
    
    if (!linkData) {
      logger.warn('Invalid magic link token attempted', email);
      return false;
    }

    if (linkData.used) {
      logger.warn('Used magic link token attempted', email);
      return false;
    }

    if (linkData.expiry < new Date()) {
      logger.warn('Expired magic link token attempted', email);
      this.magicLinks.delete(token);
      return false;
    }

    if (linkData.email !== email.toLowerCase()) {
      logger.warn('Magic link email mismatch', email);
      return false;
    }

    linkData.used = true;
    logger.info('Magic link validated successfully', email);
    return true;
  }

  cleanup() {
    const now = new Date();
    let cleaned = 0;
    
    for (const [token, data] of this.magicLinks.entries()) {
      if (data.expiry < now || data.used) {
        this.magicLinks.delete(token);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      logger.info(`Cleaned up ${cleaned} expired/used magic links`);
    }
  }

  sendMagicLink(email, token) {
    const magicUrl = `${process.env.BASE_URL || 'http://localhost:3000'}/verify?token=${token}&email=${encodeURIComponent(email)}`;
    
    console.log('\n=== MAGIC LINK EMAIL ===');
    console.log(`To: ${email}`);
    console.log(`Subject: Your ROI Analysis Access Link`);
    console.log(`\nClick here to access your ROI analysis:\n${magicUrl}`);
    console.log('\nThis link expires in 15 minutes.');
    console.log('========================\n');
    
    logger.info('Magic link email sent (console)', email);
    return true;
  }
}

module.exports = AuthService;