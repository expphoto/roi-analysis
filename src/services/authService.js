const crypto = require('crypto');
const { logger } = require('../utils/logger');

class AuthService {
  constructor() {
    this.magicLinks = new Map();
    this.sessionTokens = new Map();
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  generateMagicLink(email, userAgent = '', ipHash = '') {
    const token = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 15 * 60 * 1000);
    
    this.magicLinks.set(token, {
      email: email.toLowerCase(),
      expiry,
      used: false,
      userAgent: userAgent.substring(0, 100),
      ipHash: ipHash.substring(0, 16)
    });

    logger.info('Generated magic link', email);
    return token;
  }

  validateMagicLink(token, email, userAgent = '', ipHash = '') {
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

    if (linkData.userAgent && userAgent && linkData.userAgent !== userAgent.substring(0, 100)) {
      logger.warn('Magic link user agent mismatch', email);
      return false;
    }

    if (linkData.ipHash && ipHash && linkData.ipHash !== ipHash.substring(0, 16)) {
      logger.warn('Magic link IP hash mismatch', email);
      return false;
    }

    linkData.used = true;
    logger.info('Magic link validated successfully', email);
    return true;
  }

  exchangeMagicLinkForSession(magicToken, email, userAgent = '', ipHash = '') {
    if (!this.validateMagicLink(magicToken, email, userAgent, ipHash)) {
      return null;
    }

    const sessionToken = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 60 * 60 * 1000);

    this.sessionTokens.set(sessionToken, {
      email: email.toLowerCase(),
      expiry,
      userAgent: userAgent.substring(0, 100),
      ipHash: ipHash.substring(0, 16)
    });

    logger.info('Generated session token', email);
    return sessionToken;
  }

  validateSessionToken(token, userAgent = '', ipHash = '') {
    const sessionData = this.sessionTokens.get(token);
    
    if (!sessionData) {
      return null;
    }

    if (sessionData.expiry < new Date()) {
      this.sessionTokens.delete(token);
      return null;
    }

    if (sessionData.userAgent && userAgent && sessionData.userAgent !== userAgent.substring(0, 100)) {
      logger.warn('Session token user agent mismatch', sessionData.email);
      return null;
    }

    if (sessionData.ipHash && ipHash && sessionData.ipHash !== ipHash.substring(0, 16)) {
      logger.warn('Session token IP hash mismatch', sessionData.email);
      return null;
    }

    return sessionData.email;
  }

  cleanup() {
    const now = new Date();
    let cleanedMagic = 0;
    let cleanedSession = 0;
    
    for (const [token, data] of this.magicLinks.entries()) {
      if (data.expiry < now || data.used) {
        this.magicLinks.delete(token);
        cleanedMagic++;
      }
    }
    
    for (const [token, data] of this.sessionTokens.entries()) {
      if (data.expiry < now) {
        this.sessionTokens.delete(token);
        cleanedSession++;
      }
    }
    
    if (cleanedMagic > 0 || cleanedSession > 0) {
      logger.info(`Cleaned up ${cleanedMagic} magic links and ${cleanedSession} session tokens`);
    }
  }

  async sendMagicLink(email, token, emailService) {
    try {
      const result = await emailService.sendMagicLink(email, token);
      return result.success;
    } catch (error) {
      logger.error('Failed to send magic link', error, email);
      return false;
    }
  }
}

module.exports = AuthService;