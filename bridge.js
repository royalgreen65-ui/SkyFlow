
/**
 * SKYFLOW CORE ENGINE v2.7
 * High-Performance Bridge for FSX/P3D
 */

const WebSocket = require('ws');
const express = require('express');
const path = require('path');

const app = express();
const UI_PORT = 3000;

// Ensure proper module resolution for .tsx files in the browser
app.use((req, res, next) => {
  if (req.url.endsWith('.tsx') || req.url.endsWith('.ts')) {
    res.set('Content-Type', 'application/javascript');
  }
  next();
});

app.use(express.static(__dirname));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(UI_PORT, () => {
  console.clear();
  console.log('======================================================');
  console.log('🚀 SKYFLOW ENGINE IS READY');
  console.log('======================================================');
  console.log(`\nURL: http://localhost:${UI_PORT}`);
  console.log('STATUS: Instant Loading Active\n');
});

// SIMCONNECT BRIDGE LOGIC
let SimConnect = null;
try {
  SimConnect = require('node-simconnect').SimConnect;
} catch (e) {
  console.log('[!] SimConnect Driver: Not detected. (Offline Mode)');
}

const wss = new WebSocket.Server({ port: 8080 });
let simConnected = false;
let sc = null;

async function connectToSim() {
  if (!SimConnect || simConnected) return;
  try {
    sc = new SimConnect();
    await sc.open('SkyFlow Bridge');
    simConnected = true;
    console.log('[OK] Linked to Flight Simulator.');
    broadcastStatus();
  } catch (err) {
    simConnected = false;
  }
}

function broadcastStatus() {
  const status = JSON.stringify({ type: 'STATUS', connected: simConnected });
  wss.clients.forEach(c => { if (c.readyState === WebSocket.OPEN) c.send(status); });
}

setInterval(connectToSim, 5000);

wss.on('connection', (ws) => {
  broadcastStatus();
  ws.on('message', async (msg) => {
    try {
      const data = JSON.parse(msg);
      if (data.type === 'INJECT_WEATHER' && simConnected && sc) {
        sc.weatherSetObservation(0, data.raw);
        console.log(`[SYNC] ${data.icao} injected.`);
      }
    } catch (e) {}
  });
});
