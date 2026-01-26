
/**
 * SKYFLOW BRIDGE & UI SERVER
 * Handles weather injection and system notifications.
 */

const WebSocket = require('ws');
const { SimConnect } = require('node-simconnect');
const notifier = require('node-notifier');
const express = require('express');
const path = require('path');
const { exec } = require('child_process');

console.clear();
console.log('======================================================');
console.log('            🚀 SKYFLOW FLIGHT BRIDGE 🚀              ');
console.log('======================================================');
console.log('');
console.log('[TIP] Keep this window open for "Automated Updates" to work.');
console.log('');

// --- 1. START THE WEB SERVER ---
const app = express();
const UI_PORT = 3000;

app.use(express.static(__dirname));

app.listen(UI_PORT, () => {
  console.log(`[STATUS] ✅ Dashboard is ready at http://localhost:${UI_PORT}`);
  
  const url = `http://localhost:${UI_PORT}`;
  const start = (process.platform == 'darwin' ? 'open' : process.platform == 'win32' ? 'start' : 'xdg-open');
  exec(`${start} ${url}`);
});

// --- 2. THE SIMULATOR LINK ---
const wss = new WebSocket.Server({ port: 8080 });
let simConnected = false;
let sc = null;

function notifyUser(title, message) {
  notifier.notify({
    title: title,
    message: message,
    appID: "SkyFlow Engine",
    sound: true, 
    wait: false
  });
}

async function connectToSim() {
  try {
    if (sc) await sc.close();
    sc = new SimConnect();
    await sc.open('SkyFlow Bridge');
    simConnected = true;
    console.log('[STATUS] ✈️  LINKED TO FLIGHT SIMULATOR!');
    notifyUser("SkyFlow Connected!", "Link established. Automated sync is now available.");
    broadcastStatus();
  } catch (err) {
    console.log('[STATUS] 😴 Waiting for game... (Retrying in 5s)');
    simConnected = false;
    broadcastStatus();
  }
}

function broadcastStatus() {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: 'STATUS', connected: simConnected }));
    }
  });
}

setInterval(() => {
  if (!simConnected) connectToSim();
}, 5000);

connectToSim();

wss.on('connection', (ws) => {
  console.log('[BRIDGE] 🔗 Connection established with Browser Dashboard.');
  broadcastStatus();

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      if (data.type === 'CONNECT_SIM') await connectToSim();
      if (data.type === 'INJECT_WEATHER') {
        if (simConnected && sc) {
          sc.weatherSetObservation(0, data.raw);
          const mode = data.isAuto ? "(AUTO)" : "(MANUAL)";
          console.log(`[ACTION] 🌦️  Weather Sync ${mode} -> ${data.icao}`);
          
          notifyUser(
            data.isAuto ? "Auto-Sync Successful" : "Weather Injected!",
            `Sim skies updated for ${data.icao}. Next check in 10 mins.`
          );
        } else {
          console.log('[ERROR] ❌ Injection failed: Simulator closed.');
        }
      }
    } catch (e) {
      console.error('[ERROR] Communication error between dashboard and bridge.');
    }
  });
});

console.log('------------------------------------------------------');
console.log('READY! Minimize this window and enjoy your flight.');
