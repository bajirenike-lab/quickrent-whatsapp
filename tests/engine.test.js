const test = require('node:test');
const assert = require('node:assert/strict');
const conversationEngine = require('../src/engine/conversationEngine');
const storage = require('../src/services/storage');
const paystack = require('../src/services/paystack');
const geo = require('../src/services/geo');

const TEST_PHONE = '2348099887766';

test('1. Main menu emits native Quick Reply buttons (zero number text)', () => {
  const reply = conversationEngine.sendMainMenu(TEST_PHONE);
  assert.equal(reply.type, 'interactive');
  assert.equal(reply.interactive.type, 'button');
  assert.equal(reply.interactive.action.buttons.length, 3);

  const buttonTitles = reply.interactive.action.buttons.map(b => b.reply.title);
  assert.deepEqual(buttonTitles, ['🔍 Find a Place', '📝 List a House', '📅 My Bookings']);
});

test('2. Renter starts discovery and receives interactive location & browse buttons', async () => {
  const reply = await conversationEngine.processIncomingMessage({
    from: TEST_PHONE,
    type: 'interactive',
    buttonId: 'btn_find_houses'
  });

  assert.equal(reply.type, 'interactive');
  assert.equal(reply.interactive.type, 'button');
  const buttonIds = reply.interactive.action.buttons.map(b => b.reply.id);
  assert.ok(buttonIds.includes('btn_browse_all'));
});

test('3. Dropping GPS pin returns category list drawer', async () => {
  const reply = await conversationEngine.processIncomingMessage({
    from: TEST_PHONE,
    type: 'location',
    location: { latitude: 6.4480, longitude: 3.4730 } // Lekki Phase 1
  });

  assert.equal(reply.type, 'interactive');
  assert.equal(reply.interactive.type, 'list');
  assert.equal(reply.interactive.action.button, 'Select Category');
  assert.ok(reply.interactive.action.sections[0].rows.length >= 4);
});

test('4. Selecting category returns visual property card with photo and direct action buttons', async () => {
  const reply = await conversationEngine.processIncomingMessage({
    from: TEST_PHONE,
    type: 'interactive',
    listId: 'cat_two_bed'
  });

  assert.equal(reply.type, 'interactive');
  assert.equal(reply.interactive.header.type, 'image');
  assert.ok(reply.interactive.header.image.link.includes('unsplash.com'));

  const actionButtons = reply.interactive.action.buttons.map(b => b.reply.title);
  assert.ok(actionButtons.some(t => t.includes('Video Tour')));
  assert.ok(actionButtons.some(t => t.includes('In-Person')));
  assert.ok(actionButtons.some(t => t.includes('Next Property')));
});

test('5. Tapping Video Tour prompts for schedule time slots list drawer', async () => {
  const reply = await conversationEngine.processIncomingMessage({
    from: TEST_PHONE,
    type: 'interactive',
    buttonId: 'btn_tour_virtual'
  });

  assert.equal(reply.type, 'interactive');
  assert.equal(reply.interactive.type, 'list');
  assert.equal(reply.interactive.action.button, 'Pick Time Slot');
});

test('6. Selecting schedule slot initializes Paystack with 80/20 revenue split', async () => {
  const reply = await conversationEngine.processIncomingMessage({
    from: TEST_PHONE,
    type: 'interactive',
    listId: 'slot_sat_2pm'
  });

  assert.equal(reply.type, 'interactive');
  assert.equal(reply.interactive.type, 'button');
  assert.ok(reply.interactive.body.text.includes('Paystack'));

  // Verify booking was stored with 80/20 split
  const bookings = storage.listBookings().filter(b => b.customerPhone === TEST_PHONE);
  assert.ok(bookings.length > 0);
  const booking = bookings[0];
  assert.equal(booking.feeAmount, 4000); // ₦4,000 for virtual
  assert.equal(booking.platformCut, 800); // 20% = ₦800
  assert.equal(booking.listerCut, 3200);   // 80% = ₦3,200
  assert.ok(booking.meetingUrl.includes('meet.jit.si'));
});

test('7. Landlord can list property for free and see it live immediately', async () => {
  const landlordPhone = '2348011223344';
  
  // Step 1: Start listing
  await conversationEngine.processIncomingMessage({
    from: landlordPhone,
    type: 'interactive',
    buttonId: 'btn_list_property'
  });

  // Step 2: Title
  const titleReply = await conversationEngine.processIncomingMessage({
    from: landlordPhone,
    type: 'text',
    text: 'Brand New 3-Bedroom Penthouse in Victoria Island'
  });
  assert.equal(titleReply.type, 'interactive');
  assert.equal(titleReply.interactive.type, 'list');

  // Step 3: Category
  await conversationEngine.processIncomingMessage({
    from: landlordPhone,
    type: 'interactive',
    listId: 'cat_three_bed'
  });

  // Step 4: Rent
  await conversationEngine.processIncomingMessage({
    from: landlordPhone,
    type: 'text',
    text: '5500000'
  });

  // Step 5: Address
  const finalReply = await conversationEngine.processIncomingMessage({
    from: landlordPhone,
    type: 'text',
    text: 'Ahmadu Bello Way, Victoria Island, Lagos'
  });

  assert.equal(finalReply.type, 'interactive');
  assert.ok(finalReply.interactive.body.text.includes('CONGRATULATIONS'));
  assert.ok(finalReply.interactive.body.text.includes('80% payout'));

  // Verify property is in storage
  const all = storage.getAllProperties();
  const added = all.find(p => p.title.includes('Victoria Island'));
  assert.ok(added);
  assert.equal(added.rentYearly, 5500000);
});

test('8. Haversine geo distance calculations correctly compute proximity', () => {
  // Lekki to Ikeja is approx 18-20 km
  const dist = geo.haversineDistanceKm(6.4474, 3.4723, 6.5925, 3.3562);
  assert.ok(dist > 15 && dist < 25);
});
