# QuickRent Africa - WhatsApp Core Engine 🏠📱

A completely new, standalone, **tap-driven conversational real estate engine** built natively for WhatsApp.

This project discards the old SMS-style "reply 1, reply 2" text menus entirely. Every interaction uses native WhatsApp interactive components:
* **Quick Reply Buttons** (tap to choose)
* **Interactive List Drawers** (bottom sheets for categories and time slots)
* **Media Cards** (actual apartment photos with direct action buttons attached)
* **WhatsApp Location Pins** (instant geospatial distance matching)
* **WhatsApp Flows** (native in-app forms for structured data collection)
* **Paystack 80/20 Revenue Split** (20% platform commission / 80% lister payout)
* **Free Virtual Video Inspections** (instant Jitsi Meet room links)

---

## 🌟 The Modern WhatsApp User Experience

### 1. Renter Journey
1. **Welcome Screen:**
   - User receives a warm greeting with 3 native buttons:
     `[ 🔍 Find a Place ]` | `[ 📝 List a House ]` | `[ 📅 My Bookings ]`
2. **Location Selection:**
   - User taps WhatsApp's attachment icon (*📎*) -> *Location* to share their current location or target area.
   - Or taps `[ 🌐 View All Listings ]`.
3. **Category Drawer:**
   - A native list drawer slides up with icons and descriptions:
     - `🚪 Self-Contain / Studio`
     - `🛏️ 1-Bedroom Flat`
     - `🏠 2-Bedroom Flat`
     - `🏢 3+ Bedroom / Duplex`
4. **Visual Property Cards:**
   - WhatsApp displays the actual apartment photograph with rent, amenities, and exact distance (e.g. *"1.2 km away"*).
   - Tappable buttons right under the image:
     `[ 📹 Video Tour (₦4k) ]` | `[ 🚶 In-Person (₦6k) ]` | `[ ➡️ Next Property ]`
5. **1-Tap Schedule & Paystack Checkout:**
   - User picks a time slot from a native drawer (`Saturday 10:00 AM`, `Saturday 02:00 PM`, etc.).
   - Instant booking generated with Paystack payment link.
   - Platform automatically records:
     - **₦4,000 Total** -> **₦800 (20% Platform)** / **₦3,200 (80% Lister)**

---

### 2. Landlord & Agent Journey (100% Free Listing)
1. Landlord taps `[ 📝 List a House ]`.
2. Property title, category, rent, and address are collected via conversational buttons or native **WhatsApp Flows** in-app form ([`src/flows/flowDefinitions.json`](src/flows/flowDefinitions.json)).
3. Property is immediately indexed into the live geospatial search index.
4. When a renter books an inspection, the lister receives an instant WhatsApp alert with appointment details and their **80% earning**.

---

## 🚀 How to Run and Test Right Now

### 1. Run the Interactive Terminal Simulator
Experience the exact button-and-drawer flow directly in your terminal:
```powershell
cd C:\Users\Tope\.gemini\antigravity\scratch\whatsapp-rentals-core
node src/simulator.js
```

### 2. Run the Automated Unit Tests
```powershell
npm test
```

### 3. Run the Live Webhook Server (Port 4000)
```powershell
npm start
```
* **Web Console:** `http://localhost:4000/`
* **Health Endpoint:** `http://localhost:4000/health`
* **Meta WhatsApp Webhook:** `http://localhost:4000/webhook`
* **Paystack Webhook:** `http://localhost:4000/paystack/webhook`
