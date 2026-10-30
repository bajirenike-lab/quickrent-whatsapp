const crypto = require('crypto');
const config = require('../config/config');

class StorageService {
  constructor() {
    this.properties = new Map();
    this.bookings = new Map();
    this.sessions = new Map();
    this.users = new Map();

    this._seedInitialProperties();
  }

  _seedInitialProperties() {
    const samples = [
      {
        id: 'prop_01',
        title: 'Modern 2-Bedroom Serviced Apartment in Lekki Phase 1',
        category: 'two_bed',
        categoryLabel: '2-Bedroom Apartment',
        rentYearly: 3500000,
        address: 'Admiralty Way, Lekki Phase 1, Lagos',
        city: 'Lagos',
        latitude: 6.4474,
        longitude: 3.4723,
        bedrooms: 2,
        bathrooms: 2,
        amenities: ['24/7 Power', 'Fitted Kitchen', 'Swimming Pool', 'Security'],
        photoUrl: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800',
        listerPhone: '2348011112222',
        listerName: 'Adewale Properties',
        isAvailable: true
      },
      {
        id: 'prop_02',
        title: 'Spacious Self-Contain (Mini Flat) near Yaba Tech',
        category: 'self_contain',
        categoryLabel: 'Self-Contain / Studio',
        rentYearly: 950000,
        address: 'Commercial Avenue, Sabo Yaba, Lagos',
        city: 'Lagos',
        latitude: 6.5158,
        longitude: 3.3792,
        bedrooms: 1,
        bathrooms: 1,
        amenities: ['Prepaid Meter', 'Borehole Water', 'Gated Compound'],
        photoUrl: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800',
        listerPhone: '2348033334444',
        listerName: 'Heritage Realty',
        isAvailable: true
      },
      {
        id: 'prop_03',
        title: 'Executive 3-Bedroom Flat in Bodija / Ibadan North',
        category: 'three_bed',
        categoryLabel: '3-Bedroom Flat',
        rentYearly: 1800000,
        address: 'Old Bodija, Ibadan North, Oyo State',
        city: 'Ibadan',
        latitude: 7.4243,
        longitude: 3.9056,
        bedrooms: 3,
        bathrooms: 3,
        amenities: ['POP Ceiling', 'All Rooms En-suite', 'Ample Parking', 'Estate Security'],
        photoUrl: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800',
        listerPhone: '2348055556666',
        listerName: 'Premier Living Ltd',
        isAvailable: true
      },
      {
        id: 'prop_04',
        title: 'Brand New 1-Bedroom Studio Apartment in Ikeja GRA',
        category: 'one_bed',
        categoryLabel: '1-Bedroom Apartment',
        rentYearly: 2200000,
        address: 'Isaac John Street, Ikeja GRA, Lagos',
        city: 'Lagos',
        latitude: 6.5925,
        longitude: 3.3562,
        bedrooms: 1,
        bathrooms: 1,
        amenities: ['Gym', 'Elevator', 'Backup Generator', 'CCTV'],
        photoUrl: 'https://images.unsplash.com/photo-1502005229762-ee1b2b8ab98f?w=800',
        listerPhone: '2348077778888',
        listerName: 'Ikeja Prime Homes',
        isAvailable: true
      }
    ];

    samples.forEach(p => this.properties.set(p.id, p));
  }

  // --- Properties ---
  getAllProperties() {
    return Array.from(this.properties.values());
  }

  getPropertyById(id) {
    return this.properties.get(id) || null;
  }

  addProperty(propData) {
    const id = `prop_${crypto.randomBytes(4).toString('hex')}`;
    const prop = {
      id,
      isAvailable: true,
      createdAt: new Date().toISOString(),
      ...propData
    };
    this.properties.set(id, prop);
    return prop;
  }

  // --- Bookings ---
  createBooking(bookingData) {
    const ref = `LOC-INS-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const booking = {
      reference: ref,
      status: 'pending_payment',
      paymentStatus: 'unpaid',
      createdAt: new Date().toISOString(),
      ...bookingData
    };
    this.bookings.set(ref, booking);
    return booking;
  }

  getBooking(reference) {
    return this.bookings.get(reference) || null;
  }

  updateBooking(reference, updates) {
    const existing = this.bookings.get(reference);
    if (!existing) return null;
    const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    this.bookings.set(reference, updated);
    return updated;
  }

  listBookings() {
    return Array.from(this.bookings.values());
  }

  // --- Conversational Sessions ---
  getSession(phone) {
    if (!this.sessions.has(phone)) {
      this.sessions.set(phone, {
        phone,
        step: 'IDLE',
        data: {},
        updatedAt: Date.now()
      });
    }
    return this.sessions.get(phone);
  }

  setSession(phone, step, data = {}) {
    const existing = this.getSession(phone);
    const updated = {
      phone,
      step,
      data: { ...existing.data, ...data },
      updatedAt: Date.now()
    };
    this.sessions.set(phone, updated);
    return updated;
  }

  clearSession(phone) {
    this.sessions.set(phone, {
      phone,
      step: 'IDLE',
      data: {},
      updatedAt: Date.now()
    });
  }
}

module.exports = new StorageService();
