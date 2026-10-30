const http = require('http');
const config = require('./config/config');
const conversationEngine = require('./engine/conversationEngine');
const storage = require('./services/storage');
const paystack = require('./services/paystack');
const whatsappUI = require('./services/whatsapp');

function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => resolve(body));
  });
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;
  const method = req.method;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-paystack-signature');

  if (method === 'OPTIONS') {
    res.writeHead(200);
    return res.end();
  }

  // 1. HEALTH CHECK
  if (pathname === '/health' && method === 'GET') {
    return sendJson(res, 200, {
      status: 'ok',
      service: 'whatsapp-rentals-core',
      version: '2.0.0',
      split: `Platform: ${config.PLATFORM_COMMISSION_PERCENT}%, Lister: ${config.LISTER_SHARE_PERCENT}%`
    });
  }

  // 2. OPERATIONS ADMIN CONSOLE
  if ((pathname === '/' || pathname === '/admin') && method === 'GET') {
    const properties = storage.getAllProperties();
    const bookings = storage.listBookings();

    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>QuickRent Africa - Operations Console</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; background: #0f172a; color: #f8fafc; }
        .header { background: #1e293b; padding: 1.5rem 2rem; border-bottom: 1px solid #334155; display: flex; justify-content: space-between; align-items: center; }
        .badge { background: #10b981; color: #042f2e; padding: 4px 10px; border-radius: 9999px; font-weight: bold; font-size: 12px; }
        .container { max-width: 1200px; margin: 2rem auto; padding: 0 1rem; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 1.5rem; margin-bottom: 2rem; }
        .card { background: #1e293b; border-radius: 12px; padding: 1.5rem; border: 1px solid #334155; }
        .stat { font-size: 2.2rem; font-weight: bold; color: #38bdf8; margin-top: 0.5rem; }
        table { width: 100%; border-collapse: collapse; margin-top: 1rem; background: #1e293b; border-radius: 8px; overflow: hidden; }
        th, td { padding: 12px 16px; text-align: left; border-bottom: 1px solid #334155; font-size: 14px; }
        th { background: #0f172a; color: #94a3b8; }
        .btn-link { color: #38bdf8; text-decoration: none; font-weight: 500; }
      </style>
    </head>
    <body>
      <div class="header">
        <h2>🏠 QuickRent Africa - WhatsApp Core Engine</h2>
        <span class="badge">ACTIVE & ONLINE</span>
      </div>
      <div class="container">
        <div class="grid">
          <div class="card">
            <div>Live Available Listings</div>
            <div class="stat">${properties.length}</div>
          </div>
          <div class="card">
            <div>Total Inspections Booked</div>
            <div class="stat">${bookings.length}</div>
          </div>
          <div class="card">
            <div>Commission Revenue Split</div>
            <div class="stat">20% / 80%</div>
            <small style="color:#94a3b8;">80% paid directly to lister bank account</small>
          </div>
        </div>

        <div class="card">
          <h3>Recent Inspection Bookings</h3>
          <table>
            <thead>
              <tr>
                <th>Reference</th>
                <th>Renter</th>
                <th>Property</th>
                <th>Type</th>
                <th>Fee</th>
                <th>80% Lister Cut</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${
                bookings.length === 0
                  ? '<tr><td colspan="7" style="text-align:center; color:#64748b;">No bookings yet. Test using simulator or WhatsApp!</td></tr>'
                  : bookings
                      .map(
                        b => `
                <tr>
                  <td><code>${b.reference}</code></td>
                  <td>+${b.customerPhone}</td>
                  <td>${b.propertyTitle}</td>
                  <td>${b.inspectionType === 'virtual' ? 'Live Video Tour' : 'Physical'}</td>
                  <td>₦${b.feeAmount.toLocaleString('en-NG')}</td>
                  <td style="color:#10b981; font-weight:bold;">₦${b.listerCut.toLocaleString('en-NG')}</td>
                  <td><span class="badge">${b.status}</span></td>
                </tr>`
                      )
                      .join('')
              }
            </tbody>
          </table>
        </div>
      </div>
    </body>
    </html>
    `;
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(html);
  }

  // 3. META WHATSAPP WEBHOOK HANDSHAKE (GET /webhook or /webhook/whatsapp)
  if ((pathname === '/webhook' || pathname === '/webhook/whatsapp') && method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    if (mode === 'subscribe' && token === config.WHATSAPP_VERIFY_TOKEN) {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      return res.end(challenge);
    }
    return sendJson(res, 403, { error: 'Verification token mismatch' });
  }

  // 4. WHATSAPP WEBHOOK EVENT RECEIVER (POST /webhook or /webhook/whatsapp)
  if ((pathname === '/webhook' || pathname === '/webhook/whatsapp') && method === 'POST') {
    const rawBody = await parseBody(req);
    let payload = {};
    try {
      payload = JSON.parse(rawBody);
    } catch (e) {
      return sendJson(res, 400, { error: 'Invalid JSON' });
    }

    try {
      let from = null;
      let msgType = 'text';
      let text = null;
      let buttonId = null;
      let listId = null;
      let location = null;
      let flowResponse = null;

      // Format A: Meta WhatsApp Cloud API
      const entry = payload.entry?.[0];
      const change = entry?.changes?.[0]?.value;
      const message = change?.messages?.[0];

      if (message) {
        from = message.from;
        msgType = message.type;

        if (msgType === 'text') {
          text = message.text?.body;
        } else if (msgType === 'interactive') {
          const interactive = message.interactive;
          if (interactive.type === 'button_reply') {
            buttonId = interactive.button_reply?.id;
            text = interactive.button_reply?.title;
          } else if (interactive.type === 'list_reply') {
            listId = interactive.list_reply?.id;
            text = interactive.list_reply?.title;
          } else if (interactive.type === 'nfm_reply') {
            try {
              flowResponse = JSON.parse(interactive.nfm_reply.response_json);
            } catch (err) {}
          }
        } else if (msgType === 'location') {
          location = {
            latitude: message.location?.latitude,
            longitude: message.location?.longitude
          };
        }
      } 
      // Format B: BotSailor Webhook Forwarder
      else {
        from = payload.phone_number || payload.phone || payload.from || payload.subscriber_phone;
        text = payload.message || payload.text || payload.incoming_message || payload.last_interaction_message;
        buttonId = payload.button_payload || payload.button_id || null;
        if (buttonId) msgType = 'interactive';

        if (payload.latitude && payload.longitude) {
          msgType = 'location';
          location = { latitude: parseFloat(payload.latitude), longitude: parseFloat(payload.longitude) };
        }
      }

      if (from) {
        const replyPayload = await conversationEngine.processIncomingMessage({
          from,
          type: msgType,
          text,
          buttonId,
          listId,
          location,
          flowResponse
        });

        if (replyPayload) {
          await whatsappUI.dispatchMessage(replyPayload);
        }
      }
    } catch (err) {
      console.error('[WhatsAppWebhook] Error handling event:', err);
    }

    return sendJson(res, 200, { status: 'acknowledged' });
  }

  // 5. PAYSTACK PAYMENT WEBHOOK (POST /paystack/webhook)
  if (pathname === '/paystack/webhook' && method === 'POST') {
    const rawBody = await parseBody(req);
    const signature = req.headers['x-paystack-signature'];

    // Verify HMAC signature
    if (config.PAYSTACK_SECRET_KEY && !config.PAYSTACK_SECRET_KEY.includes('your_secret')) {
      const isValid = paystack.verifyWebhookSignature(rawBody, signature);
      if (!isValid) {
        console.warn('[PaystackWebhook] Invalid signature rejected.');
        return sendJson(res, 401, { error: 'Invalid signature' });
      }
    }

    let event = {};
    try {
      event = JSON.parse(rawBody);
    } catch (e) {
      return sendJson(res, 400, { error: 'Invalid JSON' });
    }

    if (event.event === 'charge.success') {
      const data = event.data;
      const ref = data.reference;
      const booking = storage.getBooking(ref);

      if (booking) {
        storage.updateBooking(ref, {
          status: 'confirmed',
          paymentStatus: 'paid',
          paystackTransactionId: data.id?.toString()
        });

        const renterPhone = booking.customerPhone;
        const listerPhone = booking.listerPhone;

        // 1. Notify Renter with Meeting Link / Address
        const renterConfirmText =
          `🎉 *Payment Confirmed! Your Inspection is Set!*\n\n` +
          `🏠 *Property:* ${booking.propertyTitle}\n` +
          `🗓️ *Schedule:* ${booking.scheduledTime}\n` +
          `🔍 *Type:* ${booking.inspectionType === 'virtual' ? 'Live Video Tour' : 'Physical On-Site Visit'}\n\n` +
          (booking.meetingUrl ? `📹 *Join Video Tour Room:*\n${booking.meetingUrl}\n\n` : `📍 *Address:* Provided by agent\n\n`) +
          `Our verified lister has been notified and is expecting you!`;

        const renterBtnMsg = whatsappUI.buildButtonMessage({
          to: renterPhone,
          bodyText: renterConfirmText,
          buttons: [{ id: 'btn_menu', title: '🏠 Main Menu' }]
        });
        await whatsappUI.dispatchMessage(renterBtnMsg);

        // 2. Notify Lister of 80% Earning & Appointment
        const listerConfirmText =
          `💰 *NEW PAID INSPECTION BOOKING!*\n\n` +
          `A renter just booked an inspection for *${booking.propertyTitle}*.\n` +
          `• Schedule: *${booking.scheduledTime}*\n` +
          `• Type: *${booking.inspectionType === 'virtual' ? 'Live Video Tour' : 'Physical Visit'}*\n` +
          `• Your 80% Earning: *₦${booking.listerCut.toLocaleString('en-NG')}*\n` +
          `• Renter Contact: +${renterPhone}\n\n` +
          (booking.meetingUrl ? `📹 *Video Tour Link:* ${booking.meetingUrl}\n\n` : '') +
          `Please ensure you are ready to host the inspection at the scheduled time.`;

        const listerBtnMsg = whatsappUI.buildButtonMessage({
          to: listerPhone,
          bodyText: listerConfirmText,
          buttons: [{ id: 'btn_menu', title: '🏠 Main Menu' }]
        });
        await whatsappUI.dispatchMessage(listerBtnMsg);
      }
    }

    return sendJson(res, 200, { status: 'success' });
  }

  // 404 Route Not Found
  return sendJson(res, 404, { error: 'Route not found' });
});

if (require.main === module) {
  server.listen(config.PORT, config.HOST, () => {
    console.log(`=======================================================`);
    console.log(` 🏠 QuickRent Africa WhatsApp Engine running on port ${config.PORT}`);
    console.log(` • Web Console:       http://localhost:${config.PORT}/`);
    console.log(` • Meta Webhook:      http://localhost:${config.PORT}/webhook`);
    console.log(` • Paystack Webhook:  http://localhost:${config.PORT}/paystack/webhook`);
    console.log(` • Health Check:      http://localhost:${config.PORT}/health`);
    console.log(`=======================================================`);
  });
}

module.exports = server;
