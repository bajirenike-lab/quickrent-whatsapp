const config = require('../config/config');
const storage = require('../services/storage');
const geo = require('../services/geo');
const paystack = require('../services/paystack');
const meetings = require('../services/meetings');
const whatsappUI = require('../services/whatsapp');

class ConversationEngine {
  /**
   * Routes incoming WhatsApp message through button/list/location handlers
   */
  async processIncomingMessage({ from, type, text, buttonId, listId, location, flowResponse }) {
    const session = storage.getSession(from);
    const step = session.step;

    // Global reset triggers
    const lowerText = (text || '').trim().toLowerCase();
    if (buttonId === 'btn_menu' || lowerText === 'menu' || lowerText === 'reset' || lowerText === 'start') {
      storage.clearSession(from);
      return this.sendMainMenu(from);
    }

    // 1. INCOMING WHATSAPP FLOW (IN-APP FORM) RESPONSE
    if (flowResponse) {
      if (flowResponse.flow_action === 'complete' || flowResponse.title) {
        return this.handleLandlordFlowSubmission(from, flowResponse);
      }
      if (flowResponse.inspection_type) {
        return this.handleInspectionFlowSubmission(from, flowResponse, session.data);
      }
    }

    // 2. IDLE / WELCOME STATE
    if (step === 'IDLE') {
      if (buttonId === 'btn_find_houses') {
        return this.startRenterDiscovery(from);
      }
      if (buttonId === 'btn_list_property') {
        return this.startLandlordListing(from);
      }
      if (buttonId === 'btn_my_bookings') {
        return this.showBookings(from);
      }
      return this.sendMainMenu(from);
    }

    // 3. RENTER FLOW: AWAITING LOCATION OR CATEGORY
    if (step === 'RENTER_AWAITING_LOCATION') {
      if (location && location.latitude && location.longitude) {
        return this.handleRenterLocationPin(from, location.latitude, location.longitude);
      }
      // If user taps "browse all" button
      if (buttonId === 'btn_browse_all' || buttonId === 'btn_skip_loc') {
        return this.showApartmentCategoryList(from, 6.4474, 3.4723); // Default to Central Lagos coordinates
      }
      // Re-prompt with buttons
      return this.repromptLocation(from);
    }

    if (step === 'RENTER_SELECTING_CATEGORY') {
      const selectedCategory = listId || buttonId || 'all';
      return this.displayMatchingProperties(from, selectedCategory.replace('cat_', ''));
    }

    if (step === 'RENTER_VIEWING_PROPERTY') {
      if (buttonId === 'btn_tour_virtual' || buttonId === 'btn_tour_physical') {
        const inspType = buttonId === 'btn_tour_virtual' ? 'virtual' : 'physical';
        return this.chooseInspectionSchedule(from, inspType);
      }
      if (buttonId === 'btn_next_prop') {
        return this.showNextProperty(from);
      }
      if (buttonId === 'btn_back_search') {
        return this.startRenterDiscovery(from);
      }
    }

    if (step === 'RENTER_SELECTING_SCHEDULE') {
      const selectedSlot = listId || buttonId || text || 'Saturday 2:00 PM';
      return this.generateInspectionCheckout(from, selectedSlot);
    }

    // 4. LANDLORD FLOW (If not using in-app form)
    if (step === 'LANDLORD_AWAITING_TITLE') {
      session.data.title = text;
      storage.setSession(from, 'LANDLORD_AWAITING_CATEGORY', session.data);
      return this.askLandlordCategory(from);
    }

    if (step === 'LANDLORD_AWAITING_CATEGORY') {
      session.data.category = (listId || buttonId || 'two_bed').replace('cat_', '');
      storage.setSession(from, 'LANDLORD_AWAITING_RENT', session.data);
      return this.askLandlordRent(from);
    }

    if (step === 'LANDLORD_AWAITING_RENT') {
      const rent = parseFloat((text || '').replace(/[^0-9]/g, '')) || 2000000;
      session.data.rentYearly = rent;
      storage.setSession(from, 'LANDLORD_AWAITING_ADDRESS', session.data);
      return this.askLandlordAddress(from);
    }

    if (step === 'LANDLORD_AWAITING_ADDRESS') {
      session.data.address = text;
      return this.finalizeLandlordListing(from, session.data);
    }

    // Fallback: Show Main Menu
    return this.sendMainMenu(from);
  }

  // =========================================================================
  // 1. MAIN WELCOME MENU (NO NUMBERS - PURE QUICK REPLY BUTTONS)
  // =========================================================================
  sendMainMenu(phone) {
    storage.clearSession(phone);
    const bodyText =
      `👋 *Welcome to QuickRent Africa!* 🏠\n\n` +
      `Your smart, verified real estate platform on WhatsApp.\n\n` +
      `• *Renters:* Find verified apartments nearby & book live inspections.\n` +
      `• *Landlords & Agents:* List properties for free and earn 80% on every inspection fee booked.\n\n` +
      `Tap an option below to get started:`;

    const buttons = [
      { id: 'btn_find_houses', title: '🔍 Find a Place' },
      { id: 'btn_list_property', title: '📝 List a House' },
      { id: 'btn_my_bookings', title: '📅 My Bookings' }
    ];

    return whatsappUI.buildButtonMessage({
      to: phone,
      bodyText,
      buttons,
      headerText: 'QuickRent Africa'
    });
  }

  // =========================================================================
  // 2. RENTER JOURNEY (LOCATION PIN + INTERACTIVE LIST DRAWERS)
  // =========================================================================
  startRenterDiscovery(phone) {
    storage.setSession(phone, 'RENTER_AWAITING_LOCATION', {});

    const bodyText =
      `📍 *Where would you like to live?*\n\n` +
      `Tap WhatsApp's attachment icon (*📎*) and select *Location* to drop a pin in your preferred area.\n\n` +
      `Or tap below to browse all verified listings:`;

    const buttons = [
      { id: 'btn_browse_all', title: '🌐 View All Listings' },
      { id: 'btn_menu', title: '🏠 Main Menu' }
    ];

    return whatsappUI.buildButtonMessage({
      to: phone,
      bodyText,
      buttons
    });
  }

  repromptLocation(phone) {
    return whatsappUI.buildButtonMessage({
      to: phone,
      bodyText: `📍 Please share a WhatsApp Location Pin (📎) or tap below to browse without location:`,
      buttons: [
        { id: 'btn_browse_all', title: '🌐 Browse All' },
        { id: 'btn_menu', title: '🏠 Main Menu' }
      ]
    });
  }

  handleRenterLocationPin(phone, lat, lng) {
    storage.setSession(phone, 'RENTER_SELECTING_CATEGORY', { userLat: lat, userLng: lng });
    return this.showApartmentCategoryList(phone, lat, lng);
  }

  showApartmentCategoryList(phone, lat, lng) {
    storage.setSession(phone, 'RENTER_SELECTING_CATEGORY', { userLat: lat, userLng: lng });

    const bodyText = `Great! What layout or apartment category are you searching for?`;
    const sections = [
      {
        title: 'Apartment Categories',
        rows: [
          { id: 'cat_all', title: '✨ Any Layout', description: 'Show all available listings' },
          { id: 'cat_self_contain', title: '🚪 Self-Contain / Studio', description: 'Single room self-contain & mini flats' },
          { id: 'cat_one_bed', title: '🛏️ 1-Bedroom Flat', description: '1 Bed, 1 Bath apartment' },
          { id: 'cat_two_bed', title: '🏠 2-Bedroom Flat', description: '2 Bedrooms, serviced / unserviced' },
          { id: 'cat_three_bed', title: '🏢 3+ Bedroom / Duplex', description: '3 or more bedrooms' }
        ]
      }
    ];

    return whatsappUI.buildListMessage({
      to: phone,
      bodyText,
      buttonText: 'Select Category',
      sections
    });
  }

  displayMatchingProperties(phone, categoryFilter) {
    const session = storage.getSession(phone);
    const userLat = session.data.userLat || 6.4474;
    const userLng = session.data.userLng || 3.4723;

    const allProps = storage.getAllProperties();
    const ranked = geo.findPropertiesNear(allProps, userLat, userLng, 50, categoryFilter);

    if (ranked.length === 0) {
      storage.clearSession(phone);
      return whatsappUI.buildButtonMessage({
        to: phone,
        bodyText: `😔 We couldn't find any vacant apartments matching that category in this area right now.\n\nWould you like to try another category or area?`,
        buttons: [
          { id: 'btn_find_houses', title: '🔍 Search Again' },
          { id: 'btn_menu', title: '🏠 Main Menu' }
        ]
      });
    }

    session.data.matches = ranked;
    session.data.currentIndex = 0;
    storage.setSession(phone, 'RENTER_VIEWING_PROPERTY', session.data);

    return this.renderPropertyCard(phone, ranked[0]);
  }

  showNextProperty(phone) {
    const session = storage.getSession(phone);
    const matches = session.data.matches || [];
    let idx = (session.data.currentIndex || 0) + 1;

    if (idx >= matches.length) {
      idx = 0; // Loop back to first
    }

    session.data.currentIndex = idx;
    storage.setSession(phone, 'RENTER_VIEWING_PROPERTY', session.data);
    return this.renderPropertyCard(phone, matches[idx]);
  }

  // =========================================================================
  // 3. VISUAL PROPERTY CARD WITH DIRECT ACTION BUTTONS
  // =========================================================================
  renderPropertyCard(phone, prop) {
    const session = storage.getSession(phone);
    session.data.selectedPropertyId = prop.id;
    storage.setSession(phone, 'RENTER_VIEWING_PROPERTY', session.data);

    const rentFormatted = `${config.CURRENCY_SYMBOL}${prop.rentYearly.toLocaleString('en-NG')}/yr`;
    const distanceText = prop.distanceKm !== undefined ? `📍 *${prop.distanceKm} km away* (${prop.address})` : `📍 ${prop.address}`;

    const caption =
      `🏡 *${prop.title}*\n` +
      `${distanceText}\n\n` +
      `💰 *Rent:* ${rentFormatted}\n` +
      `✨ *Amenities:* ${prop.amenities ? prop.amenities.join(', ') : 'Serviced'}\n\n` +
      `👇 Tap below to inspect this property:`;

    const buttons = [
      { id: 'btn_tour_virtual', title: `📹 Video Tour (₦4k)` },
      { id: 'btn_tour_physical', title: `🚶 In-Person (₦6k)` },
      { id: 'btn_next_prop', title: '➡️ Next Property' }
    ];

    return whatsappUI.buildImageCardMessage({
      to: phone,
      imageUrl: prop.photoUrl,
      caption,
      buttons
    });
  }

  // =========================================================================
  // 4. INSPECTION SCHEDULING & PAYSTACK 80/20 CHECKOUT
  // =========================================================================
  chooseInspectionSchedule(phone, inspectionType) {
    const session = storage.getSession(phone);
    session.data.inspectionType = inspectionType;
    storage.setSession(phone, 'RENTER_SELECTING_SCHEDULE', session.data);

    const typeTitle = inspectionType === 'virtual' ? 'Live Video Tour' : 'Physical In-Person Visit';
    const fee = config.FEES[inspectionType];

    const bodyText =
      `📅 *Schedule Your ${typeTitle}*\n\n` +
      `Fee: *${config.CURRENCY_SYMBOL}${fee.toLocaleString('en-NG')}*\n` +
      `Please select your preferred inspection time slot:`;

    const sections = [
      {
        title: 'Available Time Slots',
        rows: [
          { id: 'slot_sat_10am', title: 'Saturday 10:00 AM', description: 'Morning slot' },
          { id: 'slot_sat_2pm', title: 'Saturday 02:00 PM', description: 'Afternoon slot' },
          { id: 'slot_sun_3pm', title: 'Sunday 03:00 PM', description: 'Weekend afternoon' },
          { id: 'slot_mon_11am', title: 'Monday 11:00 AM', description: 'Weekday morning' }
        ]
      }
    ];

    return whatsappUI.buildListMessage({
      to: phone,
      bodyText,
      buttonText: 'Pick Time Slot',
      sections
    });
  }

  async generateInspectionCheckout(phone, slotTitle) {
    const session = storage.getSession(phone);
    const propId = session.data.selectedPropertyId;
    const prop = storage.getPropertyById(propId);
    const inspectionType = session.data.inspectionType || 'virtual';
    const fee = config.FEES[inspectionType];

    // Create booking record with 80/20 fee tracking
    const booking = storage.createBooking({
      propertyId: prop ? prop.id : 'unknown',
      propertyTitle: prop ? prop.title : 'QuickRent Property',
      customerPhone: phone,
      listerPhone: prop ? prop.listerPhone : '2348000000000',
      inspectionType,
      feeAmount: fee,
      platformCut: fee * (config.PLATFORM_COMMISSION_PERCENT / 100), // 20%
      listerCut: fee * (config.LISTER_SHARE_PERCENT / 100),           // 80%
      scheduledTime: slotTitle,
      meetingUrl: inspectionType === 'virtual' ? meetings.createVirtualInspectionRoom(null, prop?.title) : null
    });

    // Initialize Paystack checkout
    const paystackRes = await paystack.initializePayment({
      email: `${phone}@quickrent.africa`,
      amountNaira: fee,
      reference: booking.reference,
      metadata: {
        booking_reference: booking.reference,
        property_id: booking.propertyId,
        customer_phone: phone,
        inspection_type: inspectionType
      }
    });

    const paymentUrl = paystackRes.data?.authorization_url || `https://checkout.paystack.com/pay/${booking.reference}`;
    storage.updateBooking(booking.reference, { paymentUrl });
    storage.clearSession(phone);

    const bodyText =
      `✅ *Inspection Booked! Complete Payment Below*\n\n` +
      `🏠 *Property:* ${prop ? prop.title : 'Apartment'}\n` +
      `🗓️ *Time Slot:* ${slotTitle}\n` +
      `🔍 *Type:* ${inspectionType === 'virtual' ? 'Live Video Tour' : 'Physical On-Site Visit'}\n` +
      `💰 *Inspection Fee:* ${config.CURRENCY_SYMBOL}${fee.toLocaleString('en-NG')}\n\n` +
      `💳 *Tap here to pay securely via Paystack:*\n${paymentUrl}\n\n` +
      `_Once payment is completed, you and the lister will receive instant confirmation and inspection access._`;

    const buttons = [
      { id: 'btn_menu', title: '🏠 Main Menu' }
    ];

    return whatsappUI.buildButtonMessage({
      to: phone,
      bodyText,
      buttons,
      headerText: 'Paystack Checkout'
    });
  }

  // =========================================================================
  // 5. LANDLORD LISTING JOURNEY (FREE LISTING - 80% EARNINGS)
  // =========================================================================
  startLandlordListing(phone) {
    storage.setSession(phone, 'LANDLORD_AWAITING_TITLE', {});

    const bodyText =
      `🎉 *List Your Property on QuickRent (100% Free)*\n\n` +
      `Reach thousands of active renters & earn *80% on every inspection fee booked*!\n\n` +
      `What is the title of your apartment?\n` +
      `_Example: Newly Built 2-Bedroom Flat in Lekki Phase 1_`;

    return {
      to: phone,
      type: 'text',
      text: { body: bodyText }
    };
  }

  askLandlordCategory(phone) {
    const bodyText = `Select the category for your property:`;
    const sections = [
      {
        title: 'Categories',
        rows: [
          { id: 'cat_self_contain', title: 'Self-Contain / Studio', description: 'Single room mini flat' },
          { id: 'cat_one_bed', title: '1-Bedroom Flat', description: '1 Bed, 1 Bath' },
          { id: 'cat_two_bed', title: '2-Bedroom Flat', description: '2 Bedrooms' },
          { id: 'cat_three_bed', title: '3+ Bedroom Flat', description: '3 or more bedrooms / Duplex' }
        ]
      }
    ];

    return whatsappUI.buildListMessage({
      to: phone,
      bodyText,
      buttonText: 'Select Category',
      sections
    });
  }

  askLandlordRent(phone) {
    return {
      to: phone,
      type: 'text',
      text: {
        body: `💰 What is the yearly rent price in Naira (₦)?\n_Example: 2500000_`
      }
    };
  }

  askLandlordAddress(phone) {
    return {
      to: phone,
      type: 'text',
      text: {
        body: `📍 What is the street address and city of this property?\n_Example: Admiralty Way, Lekki Phase 1, Lagos_`
      }
    };
  }

  finalizeLandlordListing(phone, data) {
    const newProp = storage.addProperty({
      title: data.title || 'Apartment',
      category: data.category || 'two_bed',
      rentYearly: data.rentYearly || 2000000,
      address: data.address || 'Lagos, Nigeria',
      city: 'Lagos',
      latitude: 6.4474,
      longitude: 3.4723,
      photoUrl: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800',
      listerPhone: phone,
      isAvailable: true
    });

    storage.clearSession(phone);

    const bodyText =
      `🎉 *CONGRATULATIONS! Your Property is Live!* 🏠\n\n` +
      `• *Title:* ${newProp.title}\n` +
      `• *Rent:* ${config.CURRENCY_SYMBOL}${newProp.rentYearly.toLocaleString('en-NG')}/year\n` +
      `• *Location:* ${newProp.address}\n\n` +
      `Renters searching near your location can now discover and book inspections for your property.\n` +
      `You will receive an instant WhatsApp alert and your *80% payout* whenever an inspection is booked!`;

    const buttons = [
      { id: 'btn_find_houses', title: '🔍 Browse Listings' },
      { id: 'btn_menu', title: '🏠 Main Menu' }
    ];

    return whatsappUI.buildButtonMessage({
      to: phone,
      bodyText,
      buttons
    });
  }

  showBookings(phone) {
    const userBookings = storage.listBookings().filter(b => b.customerPhone === phone || b.listerPhone === phone);

    if (userBookings.length === 0) {
      return whatsappUI.buildButtonMessage({
        to: phone,
        bodyText: `📋 You have no active or upcoming property inspections.`,
        buttons: [
          { id: 'btn_find_houses', title: '🔍 Find a House' },
          { id: 'btn_menu', title: '🏠 Main Menu' }
        ]
      });
    }

    const lines = [`📋 *Your Active Inspections:*\n`];
    userBookings.forEach((b, i) => {
      lines.push(
        `*${i + 1}. ${b.propertyTitle}*\n` +
        `• Schedule: ${b.scheduledTime}\n` +
        `• Type: ${b.inspectionType === 'virtual' ? 'Live Video Tour' : 'Physical On-Site'}\n` +
        `• Status: ${b.status}\n`
      );
    });

    return whatsappUI.buildButtonMessage({
      to: phone,
      bodyText: lines.join('\n'),
      buttons: [{ id: 'btn_menu', title: '🏠 Main Menu' }]
    });
  }
}

module.exports = new ConversationEngine();
