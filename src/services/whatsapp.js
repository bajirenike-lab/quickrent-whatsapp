const config = require('../config/config');

class WhatsAppUIService {
  constructor() {
    this.phoneNumberId = config.WHATSAPP_PHONE_NUMBER_ID;
    this.accessToken = config.WHATSAPP_ACCESS_TOKEN;
  }

  /**
   * 1. Native WhatsApp Interactive Quick Reply Buttons (up to 3 buttons)
   * No typing numbers! The user simply taps the button.
   */
  buildButtonMessage({ to, bodyText, buttons, headerText = null, footerText = null }) {
    const formattedButtons = buttons.slice(0, 3).map((b, i) => ({
      type: 'reply',
      reply: {
        id: b.id || `btn_${i}`,
        title: (b.title || b.text || '').substring(0, 20) // WhatsApp limit: 20 chars
      }
    }));

    const interactive = {
      type: 'button',
      body: { text: bodyText },
      action: { buttons: formattedButtons }
    };

    if (headerText) {
      interactive.header = { type: 'text', text: headerText };
    }
    if (footerText) {
      interactive.footer = { text: footerText };
    }

    return {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'interactive',
      interactive
    };
  }

  /**
   * 2. Native WhatsApp Interactive List Drawer (up to 10 rows with sections)
   * Tapping opens a clean modal sheet with titles and descriptions.
   */
  buildListMessage({ to, bodyText, buttonText, sections, headerText = null, footerText = null }) {
    const interactive = {
      type: 'list',
      body: { text: bodyText },
      action: {
        button: (buttonText || 'Select Option').substring(0, 20),
        sections
      }
    };

    if (headerText) {
      interactive.header = { type: 'text', text: headerText };
    }
    if (footerText) {
      interactive.footer = { text: footerText };
    }

    return {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'interactive',
      interactive
    };
  }

  /**
   * 3. Native WhatsApp Media Card (Photo + Caption + Action Buttons)
   */
  buildImageCardMessage({ to, imageUrl, caption, buttons = [] }) {
    // If buttons are included, send interactive button message with image header
    if (buttons && buttons.length > 0) {
      const formattedButtons = buttons.slice(0, 3).map((b, i) => ({
        type: 'reply',
        reply: {
          id: b.id || `btn_${i}`,
          title: (b.title || b.text || '').substring(0, 20)
        }
      }));

      return {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'interactive',
        interactive: {
          type: 'button',
          header: {
            type: 'image',
            image: { link: imageUrl }
          },
          body: { text: caption },
          action: { buttons: formattedButtons }
        }
      };
    }

    // Otherwise standard media message
    return {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'image',
      image: {
        link: imageUrl,
        caption: caption || ''
      }
    };
  }

  /**
   * 4. Native WhatsApp Location Prompt
   */
  buildLocationPromptMessage({ to, bodyText }) {
    return {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: {
        preview_url: false,
        body: bodyText || '📍 Please tap the attachment icon (📎) and select *Location* to share your desired area.'
      }
    };
  }

  /**
   * 5. Native WhatsApp Flow (In-App Form)
   * Opens an interactive multi-field form inside WhatsApp for Landlords or Renters.
   */
  buildFlowMessage({ to, flowId, flowToken, ctaText, screenId, bodyText, data = {} }) {
    return {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'interactive',
      interactive: {
        type: 'flow',
        body: { text: bodyText || 'Tap below to complete your details.' },
        action: {
          name: 'flow',
          parameters: {
            flow_message_version: '3',
            flow_token: flowToken || `token_${Date.now()}`,
            flow_id: flowId || 'quickrent_listing_flow',
            flow_cta: ctaText || 'Open Form',
            flow_action: 'navigate',
            flow_action_payload: {
              screen: screenId || 'START_SCREEN',
              data
            }
          }
        }
      }
    };
  }

  /**
   * Dispatch payload to Meta WhatsApp Cloud API or BotSailor API
   */
  async dispatchMessage(payload) {
    const toPhone = (payload.to || '').toString().replace(/[^0-9]/g, '');
    const botSailorToken = config.BOTSAILOR_API_TOKEN;
    const botSailorPhoneId = config.BOTSAILOR_PHONE_NUMBER_ID || '729382720254467';

    // 1. If BotSailor API is configured (e.g. For +234 911 900 2066)
    if (botSailorToken && !botSailorToken.includes('your_token')) {
      try {
        let endpoint = 'https://botsailor.com/api/v1/whatsapp/send';
        let reqBody = {
          apiToken: botSailorToken,
          phone_number_id: botSailorPhoneId,
          phone_number: toPhone
        };

        if (payload.type === 'interactive' && payload.interactive.type === 'button') {
          endpoint = 'https://botsailor.com/api/v1/whatsapp/send/interactive-buttons';
          reqBody.message = payload.interactive.body?.text || 'Select an option:';
          reqBody.buttons = payload.interactive.action.buttons.map(b => ({
            id: b.reply.id,
            title: b.reply.title.substring(0, 20)
          }));
          if (payload.interactive.header && payload.interactive.header.type === 'image') {
            reqBody.media_url = payload.interactive.header.image.link;
            reqBody.media_type = 'image';
          }
        } else if (payload.type === 'interactive' && payload.interactive.type === 'list') {
          // Fallback to interactive buttons or formatted options if list not supported
          endpoint = 'https://botsailor.com/api/v1/whatsapp/send/interactive-buttons';
          reqBody.message = `${payload.interactive.body.text}\n\nTap an option:`;
          const allRows = [];
          payload.interactive.action.sections.forEach(s => {
            s.rows.forEach(r => allRows.push({ id: r.id, title: r.title.substring(0, 20) }));
          });
          reqBody.buttons = allRows.slice(0, 3);
        } else if (payload.type === 'text') {
          reqBody.message = payload.text.body;
        } else {
          reqBody.message = payload.text?.body || 'QuickRent Africa Notification';
        }

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(reqBody)
        });
        const data = await res.json();
        return { status: 'delivered_via_botsailor', data };
      } catch (err) {
        console.error('[WhatsAppUIService] BotSailor dispatch error:', err.message);
      }
    }

    // 2. Fallback to Meta Cloud API directly
    if (this.phoneNumberId && this.accessToken) {
      try {
        const url = `https://graph.facebook.com/v19.0/${this.phoneNumberId}/messages`;
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        return { status: 'delivered_via_meta', data };
      } catch (err) {
        console.error('[WhatsAppUIService] Meta dispatch failed:', err.message);
        return { status: 'error', error: err.message };
      }
    }

    return { status: 'simulated', payload };
  }
}

module.exports = new WhatsAppUIService();
