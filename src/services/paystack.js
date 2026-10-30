const crypto = require('crypto');
const config = require('../config/config');

class PaystackService {
  constructor() {
    this.secretKey = config.PAYSTACK_SECRET_KEY;
    this.publicKey = config.PAYSTACK_PUBLIC_KEY;
  }

  /**
   * Initializes a Paystack checkout for an inspection fee with 80/20 split tracking
   */
  async initializePayment({ email, amountNaira, reference, metadata, subaccountCode = null }) {
    const amountKobo = Math.round(amountNaira * 100);
    const platformCommissionKobo = Math.round(amountKobo * (config.PLATFORM_COMMISSION_PERCENT / 100));
    const listerEarningKobo = amountKobo - platformCommissionKobo;

    const payload = {
      email: email || 'renter@quickrent.africa',
      amount: amountKobo,
      reference,
      callback_url: config.PAYSTACK_CALLBACK_URL,
      metadata: {
        ...metadata,
        platform_commission_naira: platformCommissionKobo / 100,
        lister_earning_naira: listerEarningKobo / 100
      }
    };

    // If lister has a registered Paystack subaccount, Paystack handles the split automatically
    if (subaccountCode) {
      payload.subaccount = subaccountCode;
      payload.transaction_charge = platformCommissionKobo; // Platform keeps 20%
      payload.bearer = 'subaccount';
    }

    // If test keys or offline, provide a simulated instant authorization URL
    if (!this.secretKey || this.secretKey.includes('your_secret')) {
      return {
        status: true,
        data: {
          authorization_url: `https://checkout.paystack.com/simulate-${reference}`,
          access_code: `sim_${reference}`,
          reference
        }
      };
    }

    try {
      const response = await fetch('https://api.paystack.co/transaction/initialize', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.secretKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      return data;
    } catch (err) {
      console.error('[PaystackService] Initialization failed:', err.message);
      return {
        status: false,
        error: err.message,
        fallback_url: `https://checkout.paystack.com/pay/${reference}`
      };
    }
  }

  /**
   * Validates Paystack Webhook HMAC-SHA512 signature
   */
  verifyWebhookSignature(rawBody, signatureHeader) {
    if (!this.secretKey || !signatureHeader) return false;
    const hash = crypto
      .createHmac('sha512', this.secretKey)
      .update(rawBody)
      .digest('hex');
    return hash === signatureHeader;
  }

  /**
   * Verifies transaction with Paystack API
   */
  async verifyPayment(reference) {
    if (!this.secretKey || this.secretKey.includes('your_secret')) {
      return { status: true, data: { status: 'success', reference } };
    }

    try {
      const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.secretKey}`
        }
      });
      return await response.json();
    } catch (err) {
      return { status: false, error: err.message };
    }
  }
}

module.exports = new PaystackService();
