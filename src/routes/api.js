const express = require('express');
const ROIService = require('../services/roiService');
const AuthService = require('../services/authService');
const { roiLimiter, magicLinkLimiter } = require('../middleware/rateLimiter');
const { logger } = require('../utils/logger');

const router = express.Router();
const roiService = new ROIService();
const authService = new AuthService();

router.post('/request-access', magicLinkLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email || !email.includes('@')) {
      return res.status(400).json({ 
        error: 'Valid email address is required' 
      });
    }

    const token = authService.generateMagicLink(email);
    const sent = authService.sendMagicLink(email, token);
    
    if (sent) {
      logger.info('Magic link request successful', email);
      res.json({ 
        success: true, 
        message: 'Access link sent to your email' 
      });
    } else {
      logger.error('Failed to send magic link', null, email);
      res.status(500).json({ 
        error: 'Failed to send access link' 
      });
    }

  } catch (error) {
    logger.error('Error in request-access endpoint', error);
    res.status(500).json({ 
      error: 'Internal server error' 
    });
  }
});

router.get('/verify', async (req, res) => {
  try {
    const { token, email } = req.query;
    
    if (!token || !email) {
      return res.status(400).send(`
        <html><body>
          <h1>Invalid Link</h1>
          <p>Missing token or email parameter.</p>
        </body></html>
      `);
    }

    const isValid = authService.validateMagicLink(token, email);
    
    if (isValid) {
      const redirectUrl = `/roi-analysis.html?email=${encodeURIComponent(email)}&token=${token}`;
      res.redirect(redirectUrl);
    } else {
      res.status(400).send(`
        <html><body>
          <h1>Invalid or Expired Link</h1>
          <p>This access link is invalid, expired, or has already been used.</p>
          <p><a href="/">Request a new link</a></p>
        </body></html>
      `);
    }

  } catch (error) {
    logger.error('Error in verify endpoint', error);
    res.status(500).send(`
      <html><body>
        <h1>Error</h1>
        <p>An error occurred while verifying your access link.</p>
      </body></html>
    `);
  }
});

router.get('/roi', roiLimiter, async (req, res) => {
  try {
    const { email, token } = req.query;
    
    if (!email) {
      return res.status(400).json({ 
        error: 'Email parameter is required' 
      });
    }

    if (!token || !authService.validateMagicLink(token, email)) {
      return res.status(401).json({ 
        error: 'Valid authentication token is required' 
      });
    }

    logger.info('Processing ROI request', email);
    const result = await roiService.getClientROI(email);
    
    if (!result.success) {
      if (result.isAmbiguous) {
        return res.status(400).json({
          error: result.message,
          clients: result.clients?.map(client => ({
            id: client.id,
            name: client.name,
            email: client.contacts?.[0]?.email
          }))
        });
      } else {
        return res.status(404).json({ 
          error: result.message 
        });
      }
    }

    logger.info('ROI request completed successfully', email);
    res.json(result.data);

  } catch (error) {
    logger.error('Error in ROI endpoint', error, req.query.email);
    
    if (error.message.includes('authentication failed')) {
      res.status(401).json({ 
        error: 'Invoice Ninja API authentication failed. Please contact administrator.' 
      });
    } else {
      res.status(500).json({ 
        error: 'Failed to retrieve ROI data' 
      });
    }
  }
});

router.get('/roi/ui', roiLimiter, async (req, res) => {
  try {
    const { email, token } = req.query;
    
    if (!email) {
      return res.status(400).json({ 
        error: 'Email parameter is required' 
      });
    }

    if (!token || !authService.validateMagicLink(token, email)) {
      return res.status(401).json({ 
        error: 'Valid authentication token is required' 
      });
    }

    logger.info('Processing UI ROI request', email);
    const result = await roiService.getClientROI(email);
    
    if (!result.success) {
      return res.status(result.isAmbiguous ? 400 : 404).json({
        error: result.message,
        clients: result.clients
      });
    }

    logger.info('UI ROI request completed successfully', email);
    res.json(result.data);

  } catch (error) {
    logger.error('Error in UI ROI endpoint', error, req.query.email);
    
    if (error.message.includes('authentication failed')) {
      res.status(401).json({ 
        error: 'Invoice Ninja API authentication failed. Please contact administrator.' 
      });
    } else {
      res.status(500).json({ 
        error: 'Failed to retrieve ROI data' 
      });
    }
  }
});

module.exports = router;