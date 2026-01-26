
/**
 * SKYFLOW BRIDGE & UI SERVER v2.1
 */

const WebSocket = require('ws');
const express = require('express');
const path = require('path');
const { exec } = require('child_process');
const notifier = require('node-notifier');

let SimConnect = null;
try {
  SimConnect = require('node-simconnect').SimConnect;
} catch (e) {
  console.log('\n[WARN] SimConnect drivers not found or failed to load.');
  console.log('[TIP] You can still use the Dashboard to view METARs.');
}

console.clear();
console.log('======================================================');
console.log('            🚀 SKYFLOW FLIGHT BRIDGE 🚀              ');
console.log('======================================================');

const app = express();
const UI_PORT = 3000;

app.use(express.static(__dirname));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const server = app.listen(UI_PORT, () => {
  console.log(`[SYSTEM] Dashboard: http://localhost:${UI_PORT}`);
  exec(`start http://localhost:${UI_PORT}`);
});

const wss = new WebSocket.Server({ port: 8080 });
let simConnected = false;
let sc = null;

async function connectToSim() {
  if (!SimConnect) return;
  try {
    if (sc) { try { await sc.close(); } catch(e) {} }
    
    console.log('[SYSTEM] Searching for Flight Simulator...');
    sc = new SimConnect();
    await sc.open('SkyFlow Bridge');
    
    simConnected = true;
    console.log('[STATUS] ✅ SIMULATOR LINKED!');
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

setInterval(() => {
  if (!simConnected && SimConnect) connectToSim();
}, 10000);

wss.on('connection', (ws) => {
  broadcastStatus();
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      if (data.type === 'INJECT_WEATHER' && simConnected && sc) {
        sc.weatherSetObservation(0, data.raw);
        console.log(`[SYNC] ${data.icao} -> Success`);
      }
    } catch (e) {}
  });
});

console.log('------------------------------------------------------');
console.log('KEEP THIS WINDOW OPEN WHILE FLYING.');
