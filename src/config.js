require('dotenv').config();

const config = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  invoiceNinja: {
    baseUrl: process.env.IN_NINJA_BASE_URL,
    apiToken: process.env.IN_NINJA_API_TOKEN
  },
  dataFiles: {
    pricebook: process.env.PRICEBOOK_PATH || './data/pricebook.json',
    benefits: process.env.BENEFITS_PATH || './data/benefits.json',
    planRules: process.env.PLAN_RULES_PATH || './data/plan_rules.json'
  }
};

if (!config.invoiceNinja.baseUrl || !config.invoiceNinja.apiToken) {
  console.error('Missing required environment variables: IN_NINJA_BASE_URL and IN_NINJA_API_TOKEN');
  process.exit(1);
}

module.exports = config;