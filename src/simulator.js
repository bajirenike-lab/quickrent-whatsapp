const readline = require('readline');
const conversationEngine = require('./engine/conversationEngine');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const TEST_PHONE = '2348123456789';

let lastAvailableButtons = [];
let lastAvailableListRows = [];

function renderWhatsAppUI(payload) {
  console.log('\n' + '━'.repeat(60));
  console.log(`📱 [WHATSAPP MESSAGE TO +${payload.to}]`);
  console.log('━'.repeat(60));

  lastAvailableButtons = [];
  lastAvailableListRows = [];

  if (payload.type === 'text') {
    console.log(payload.text.body);
  } else if (payload.type === 'image') {
    console.log(`🖼️ [IMAGE]: ${payload.image.link}`);
    console.log(payload.image.caption);
  } else if (payload.type === 'interactive') {
    const inter = payload.interactive;
    if (inter.header && inter.header.type === 'image') {
      console.log(`🖼️ [IMAGE ATTACHMENT]: ${inter.header.image.link}`);
    } else if (inter.header && inter.header.text) {
      console.log(`📌 [${inter.header.text}]`);
    }

    if (inter.body) {
      console.log(inter.body.text);
    }

    if (inter.type === 'button') {
      console.log('\n👉 Tappable Quick Reply Buttons:');
      inter.action.buttons.forEach((b, i) => {
        lastAvailableButtons.push(b.reply.id);
        console.log(`   [ ${i + 1} ] 🔘 ${b.reply.title}  (id: ${b.reply.id})`);
      });
    } else if (inter.type === 'list') {
      console.log(`\n📋 Interactive List Drawer [${inter.action.button}]:`);
      let counter = 1;
      inter.action.sections.forEach(sec => {
        console.log(`   ── ${sec.title} ──`);
        sec.rows.forEach(r => {
          lastAvailableListRows.push(r.id);
          console.log(`   [ ${counter} ] ▫️ ${r.title} : ${r.description || ''} (id: ${r.id})`);
          counter++;
        });
      });
    } else if (inter.type === 'flow') {
      console.log(`\n📄 WhatsApp Flow Form [${inter.action.parameters.flow_cta}]:`);
      console.log(`   Flow ID: ${inter.action.parameters.flow_id}`);
    }
  }
  console.log('━'.repeat(60) + '\n');
}

async function startSimulator() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║   QUICKRENT AFRICA - INTERACTIVE WHATSAPP SIMULATOR      ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('Simulate the modern, button-driven WhatsApp user experience.');
  console.log('Commands:');
  console.log('  • "1", "2", "3"   -> Tap the corresponding button or list option on screen');
  console.log('  • "loc <lat,lng>" -> Drop a location pin (e.g. "loc 6.4474,3.4723" for Lekki)');
  console.log('  • "loc ibadan"    -> Drop location in Ibadan (7.4243, 3.9056)');
  console.log('  • "menu"          -> Reset to Main Menu');
  console.log('  • "exit"          -> Quit simulator\n');

  // Initial Welcome
  const welcomePayload = conversationEngine.sendMainMenu(TEST_PHONE);
  renderWhatsAppUI(welcomePayload);

  promptUser();
}

function promptUser() {
  rl.question(`You (+${TEST_PHONE}) > `, async (input) => {
    const trimmed = input.trim();
    if (trimmed.toLowerCase() === 'exit') {
      console.log('Exiting simulator.');
      rl.close();
      process.exit(0);
    }

    let payload = null;

    // Check if user tapped a button by index
    const num = parseInt(trimmed, 10);
    if (!isNaN(num) && num > 0) {
      if (lastAvailableButtons.length >= num) {
        const btnId = lastAvailableButtons[num - 1];
        payload = await conversationEngine.processIncomingMessage({
          from: TEST_PHONE,
          type: 'interactive',
          buttonId: btnId
        });
      } else if (lastAvailableListRows.length >= num) {
        const listId = lastAvailableListRows[num - 1];
        payload = await conversationEngine.processIncomingMessage({
          from: TEST_PHONE,
          type: 'interactive',
          listId: listId
        });
      }
    }

    // Check if user dropped a location pin
    if (!payload && trimmed.toLowerCase().startsWith('loc')) {
      let lat = 6.4474;
      let lng = 3.4723;
      if (trimmed.toLowerCase().includes('ibadan')) {
        lat = 7.4243;
        lng = 3.9056;
      } else if (trimmed.includes(',')) {
        const parts = trimmed.replace('loc', '').trim().split(',');
        lat = parseFloat(parts[0]);
        lng = parseFloat(parts[1]);
      }

      console.log(`📍 Dropped GPS Location Pin at (${lat}, ${lng})`);
      payload = await conversationEngine.processIncomingMessage({
        from: TEST_PHONE,
        type: 'location',
        location: { latitude: lat, longitude: lng }
      });
    }

    // Fallback: regular text
    if (!payload) {
      payload = await conversationEngine.processIncomingMessage({
        from: TEST_PHONE,
        type: 'text',
        text: trimmed
      });
    }

    if (payload) {
      renderWhatsAppUI(payload);
    }

    promptUser();
  });
}

if (require.main === module) {
  startSimulator();
}
