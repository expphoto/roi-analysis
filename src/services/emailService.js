const mailgun = require('mailgun-js');
const config = require('../config');
const { logger } = require('../utils/logger');

class EmailService {
  constructor() {
    this.isConfigured = !!(config.email.mailgunApiKey && config.email.mailgunDomain);
    this.deliveryMode = config.email.delivery; // 'console' | 'enabled' | 'disabled'

    if (this.isConfigured && this.deliveryMode !== 'disabled') {
      this.mg = mailgun({
        apiKey: config.email.mailgunApiKey,
        domain: config.email.mailgunDomain,
      });
      logger.info(`Mailgun initialized; delivery=${this.deliveryMode}, env=${config.nodeEnv}`);
    } else if (this.isConfigured && this.deliveryMode === 'disabled') {
      logger.info('Mailgun configured but delivery disabled by EMAIL_DELIVERY=disabled');
    } else {
      logger.info('Email service in console mode (no external delivery)');
    }
  }

  async sendMagicLink(email, token) {
    logger.info('EmailService.sendMagicLink called', email);
    
    const magicUrl = `${config.email.baseUrl}/api/verify?token=${token}&email=${encodeURIComponent(email)}`;
    
    const emailData = {
      from: `${config.email.fromName} <${config.email.fromEmail}>`,
      to: email,
      subject: 'Your ROI Analysis Access Link',
      html: this.generateEmailTemplate(email, magicUrl),
      text: this.generateTextEmail(email, magicUrl)
    };

    logger.info(`Email config - isConfigured: ${this.isConfigured}, env: ${config.nodeEnv}, delivery: ${this.deliveryMode}`);

    // Send via Mailgun if configured AND delivery mode is enabled (regardless of NODE_ENV)
    if (this.isConfigured && this.deliveryMode === 'enabled') {
      try {
        logger.info('Sending email via Mailgun', email);
        const result = await this.mg.messages().send(emailData);
        logger.info('Magic link email sent via Mailgun', email);
        return { success: true, messageId: result.id };
      } catch (error) {
        logger.error('Failed to send email via Mailgun', error, email);
        throw new Error('Failed to send email');
      }
    } else if (config.nodeEnv === 'production' && this.isConfigured) {
      // Back-compat: in production default to sending if configured
      try {
        logger.info('Sending email via Mailgun (production default)', email);
        const result = await this.mg.messages().send(emailData);
        logger.info('Magic link email sent via Mailgun', email);
        return { success: true, messageId: result.id };
      } catch (error) {
        logger.error('Failed to send email via Mailgun', error, email);
        throw new Error('Failed to send email');
      }
    } else {
      // Development mode - console output
      console.log('\n=== MAGIC LINK EMAIL (DEV MODE) ===');
      console.log(`To: ${email}`);
      console.log(`From: ${emailData.from}`);
      console.log(`Subject: ${emailData.subject}`);
      console.log(`\nMagic Link: ${magicUrl}`);
      console.log('\nThis link expires in 15 minutes.');
      console.log('=====================================\n');
      
      logger.info('Magic link email sent (console mode)', email);
      return { success: true, messageId: 'dev-mode' };
    }
  }

  generateEmailTemplate(email, magicUrl) {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Your ROI Analysis Access Link</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            background: linear-gradient(135deg, #007cba, #005a87);
            color: white;
            padding: 30px;
            text-align: center;
            border-radius: 8px 8px 0 0;
        }
        .content {
            background: #ffffff;
            padding: 30px;
            border: 1px solid #ddd;
            border-top: none;
            border-radius: 0 0 8px 8px;
        }
        .button {
            display: inline-block;
            background: #007cba;
            color: white;
            padding: 15px 30px;
            text-decoration: none;
            border-radius: 5px;
            margin: 20px 0;
            font-weight: bold;
        }
        .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            font-size: 0.9em;
            color: #666;
        }
        .warning {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            color: #856404;
            padding: 15px;
            border-radius: 4px;
            margin: 20px 0;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>ROI Analysis Portal</h1>
        <p>Your secure access link is ready</p>
    </div>
    
    <div class="content">
        <h2>Hello!</h2>
        
        <p>You requested access to your ROI analysis dashboard. Click the button below to securely access your data:</p>
        
        <div style="text-align: center;">
            <a href="${magicUrl}" class="button">Access Your ROI Dashboard</a>
        </div>
        
        <div class="warning">
            <strong>Security Notice:</strong> This link expires in 15 minutes and can only be used once. If you didn't request this access, please ignore this email.
        </div>
        
        <h3>What you'll see:</h3>
        <ul>
            <li>12-month billing and payment summary</li>
            <li>On-time payment rate analysis</li>
            <li>Savings vs list price calculations</li>
            <li>Recent invoices and payments</li>
            <li>Service benefits overview</li>
        </ul>
        
        <p>If you have any questions or need assistance, please contact our support team.</p>
        
        <div class="footer">
            <p>This email was sent to: ${email}</p>
            <p>If the button doesn't work, copy and paste this link into your browser:<br>
            <small>${magicUrl}</small></p>
        </div>
    </div>
</body>
</html>`;
  }

  generateTextEmail(email, magicUrl) {
    return `ROI Analysis Portal - Access Link

Hello!

You requested access to your ROI analysis dashboard. Click the link below to securely access your data:

${magicUrl}

SECURITY NOTICE: This link expires in 15 minutes and can only be used once. If you didn't request this access, please ignore this email.

What you'll see:
- 12-month billing and payment summary
- On-time payment rate analysis  
- Savings vs list price calculations
- Recent invoices and payments
- Service benefits overview

If you have any questions or need assistance, please contact our support team.

This email was sent to: ${email}

If the link doesn't work, copy and paste it into your browser.
`;
  }
}

module.exports = EmailService;
