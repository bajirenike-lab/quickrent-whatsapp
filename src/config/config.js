const fs = require('fs');
const path = require('path');

// Auto-load .env if it exists
const envPath = path.resolve(__dirname, '../../.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split(/\r?\n/).forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const key = trimmed.substring(0, idx).trim();
      const val = trimmed.substring(idx + 1).trim();
      if (!process.env[key]) {
        process.env[key] = val.replace(/^["']|["']$/g, '');
      }
    }
  });
}

module.exports = {
  PORT: parseInt(process.env.PORT || '3000', 10),
  HOST: process.env.HOST || '0.0.0.0',
  NODE_ENV: process.env.NODE_ENV || 'development',
  BASE_URL: process.env.BASE_URL || 'http://localhost:4000',

  // Meta WhatsApp Cloud API Credentials
  WHATSAPP_PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
  WHATSAPP_ACCESS_TOKEN: process.env.WHATSAPP_ACCESS_TOKEN || '',
  WHATSAPP_VERIFY_TOKEN: process.env.WHATSAPP_VERIFY_TOKEN || 'quickrent_secret_verify_token',

  // BotSailor / Webhook Relay (optional bridge if user prefers BotSailor number)
  BOTSAILOR_API_TOKEN: process.env.BOTSAILOR_API_TOKEN || '',
  BOTSAILOR_PHONE_NUMBER_ID: process.env.BOTSAILOR_PHONE_NUMBER_ID || '',

  // Paystack Configuration
  PAYSTACK_SECRET_KEY: process.env.PAYSTACK_SECRET_KEY || 'sk_test_e79f12602cb1a05b4af0028199d048d759c8559b',
  PAYSTACK_PUBLIC_KEY: process.env.PAYSTACK_PUBLIC_KEY || 'pk_test_d5ea713a2fe6746868cbb437b628d99891612d4d',
  PAYSTACK_CALLBACK_URL: process.env.PAYSTACK_CALLBACK_URL || 'https://checkout.paystack.com',

  // Platform Business Model
  PLATFORM_COMMISSION_PERCENT: 20, // Platform retains 20%
  LISTER_SHARE_PERCENT: 80,        // Lister receives 80%
  CURRENCY_CODE: 'NGN',
  CURRENCY_SYMBOL: '₦',

  // Standard Inspection Fees
  FEES: {
    virtual: 4000,   // ₦4,000 Live Video Tour
    physical: 6000   // ₦6,000 Physical On-Site Visit
  }
};
