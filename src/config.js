require('dotenv').config();
const fs = require('fs');
const path = require('path');

const requiredEnvVars = [
  'IN_NINJA_BASE_URL',
  'IN_NINJA_API_TOKEN'
];

const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.error('❌ Missing required environment variables:');
  missingEnvVars.forEach(varName => {
    console.error(`   - ${varName}`);
  });
  console.error('\nPlease check your .env file or environment configuration.');
  console.error('See .env.example for required variables.');
  process.exit(1);
}

const config = {
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  invoiceNinja: {
    baseUrl: process.env.IN_NINJA_BASE_URL.replace(/\/$/, ''),
    apiToken: process.env.IN_NINJA_API_TOKEN
  },
  email: {
    mailgunApiKey: process.env.MAILGUN_API_KEY,
    mailgunDomain: process.env.MAILGUN_DOMAIN,
    fromEmail: process.env.MAILGUN_FROM_EMAIL || 'noreply@localhost',
    fromName: process.env.MAILGUN_FROM_NAME || 'ROI Analysis Portal',
    baseUrl: process.env.BASE_URL || 'http://localhost:3000'
  },
  dataFiles: {
    pricebook: process.env.PRICEBOOK_PATH || './data/pricebook.json',
    benefits: process.env.BENEFITS_PATH || './data/benefits.json',
    planRules: process.env.PLAN_RULES_PATH || './data/plan_rules.json'
  }
};

function validateConfig() {
  const errors = [];
  
  if (!config.invoiceNinja.baseUrl.startsWith('http')) {
    errors.push('IN_NINJA_BASE_URL must start with http:// or https://');
  }
  
  if (config.invoiceNinja.apiToken.length < 10) {
    errors.push('IN_NINJA_API_TOKEN appears to be too short');
  }
  
  if (config.port < 1 || config.port > 65535) {
    errors.push('PORT must be between 1 and 65535');
  }
  
  for (const [key, filePath] of Object.entries(config.dataFiles)) {
    const resolvedPath = path.resolve(filePath);
    if (!fs.existsSync(resolvedPath)) {
      errors.push(`Data file not found: ${key} at ${resolvedPath}`);
    } else {
      try {
        const content = fs.readFileSync(resolvedPath, 'utf8');
        JSON.parse(content);
      } catch (error) {
        errors.push(`Invalid JSON in data file: ${key} at ${resolvedPath}`);
      }
    }
  }
  
  if (errors.length > 0) {
    console.error('❌ Configuration validation failed:');
    errors.forEach(error => {
      console.error(`   - ${error}`);
    });
    process.exit(1);
  }
  
  console.log('✅ Configuration validated successfully');
  console.log(`   - Environment: ${config.nodeEnv}`);
  console.log(`   - Port: ${config.port}`);
  console.log(`   - Invoice Ninja: ${config.invoiceNinja.baseUrl}`);
  console.log(`   - Email: ${config.email.mailgunApiKey ? 'Mailgun configured' : 'Development mode (console)'}`);
  console.log(`   - Data files: ${Object.keys(config.dataFiles).length} loaded`);
}

validateConfig();

module.exports = config;