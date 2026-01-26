
/**
 * SKYFLOW CORE ENGINE v2.3
 */

const WebSocket = require('ws');
const express = require('express');
const path = require('path');

let SimConnect = null;
try {
  SimConnect = require('node-simconnect').SimConnect;
} catch (e) {
  console.log('\n[!] SIMCONNECT DRIVER MISSING');
  console.log('    You can still use the Dashboard to generate METARs,');
  console.log('    but they won\'t inject into the game until you install SimConnect.\n');
}

const app = express();
const UI_PORT = 3000;

app.use(express.static(__dirname));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.listen(UI_PORT, () => {
  console.log('======================================================');
  console.log('✅ ENGINE STARTED SUCCESSFULLY');
  console.log(`📡 DASHBOARD READY AT: http://localhost:${UI_PORT}`);
  console.log('======================================================');
  console.log('\n[!] KEEP THIS WINDOW OPEN WHILE FLYING [!]\n');
});

const wss = new WebSocket.Server({ port: 8080 });
let simConnected = false;
let sc = null;

async function connectToSim() {
  if (!SimConnect || simConnected) return;
  try {
    sc = new SimConnect();
    await sc.open('SkyFlow Bridge');
    simConnected = true;
    console.log('[CONNECT] >>> SIMULATOR LINKED! <<<');
    broadcastStatus();
  } catch (err) {
    simConnected = false;
    broadcastStatus();
  }
}

function broadcastStatus() {
  const status = JSON.stringify({ type: 'STATUS', connected: simConnected });
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) client.send(status);
  });
}

// Check for sim every 5 seconds
setInterval(connectToSim, 5000);

wss.on('connection', (ws) => {
  broadcastStatus();
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      if (data.type === 'INJECT_WEATHER' && simConnected && sc) {
        sc.weatherSetObservation(0, data.raw);
        console.log(`[INJECT] ${data.icao} successfully sent to Flight Sim.`);
      }
    } catch (e) {}
  });
});
