/**
 * SKYFLOW CORE ENGINE v2.12
 * Robust Bridge for FSX/P3D with Persistent Logging & 30-Day Auto-Purge
 */

const WebSocket = require('ws');
const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const UI_PORT = 3000;

// Use process.cwd() for logs so they appear next to the EXE
const LOG_FILE = path.join(process.cwd(), 'skyflow_avionics.log');

// --- LOGGING ENGINE ---
function writeLog(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  const entry = `[${timestamp}] [${level}] ${message}\n`;
  console.log(entry.trim());
  try {
    fs.appendFileSync(LOG_FILE, entry);
  } catch (err) {
    // If we can't write to CWD (e.g. Program Files), try a temp dir
  }
}

// 30-Day Auto-Purge Logic
function checkLogRotation() {
  if (fs.existsSync(LOG_FILE)) {
    try {
      const stats = fs.statSync(LOG_FILE);
      const now = new Date().getTime();
      const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;
      
      if (now - stats.birthtimeMs > thirtyDaysInMs) {
        fs.unlinkSync(LOG_FILE);
        writeLog('Log rotated.');
      }
    } catch (e) {}
  }
}

checkLogRotation();
writeLog('SkyFlow Bridge Booting...');

// --- SERVER SETUP ---
// Important for PKG: __dirname is internal, process.cwd() is external
const staticPath = __dirname; 

app.use((req, res, next) => {
  if (req.url.endsWith('.tsx') || req.url.endsWith('.ts')) {
    res.set('Content-Type', 'application/javascript');
  }
  next();
});

app.use(express.static(staticPath));

app.get('/', (req, res) => {
  res.sendFile(path.join(staticPath, 'index.html'));
});

const { exec } = require('child_process');

app.listen(UI_PORT, () => {
  writeLog(`UI Server active on http://localhost:${UI_PORT}`);
  
  // Automatically open the dashboard in the default browser
  exec('start http://localhost:3000', (err) => {
    if (err) writeLog('Failed to auto-launch browser.', 'WARN');
  });
});

// --- SIMCONNECT BRIDGE ---
let SimConnect = null;
try {
  SimConnect = require('node-simconnect').SimConnect;
} catch (e) {
  writeLog('SimConnect Driver not detected.', 'WARN');
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
    writeLog('SimConnect Link established', 'SUCCESS');
    
    // Send a message to the Sim screen (the "tooltip" feature)
    try {
      sc.text(3, "SkyFlow Connected: Ready for Injection", 5);
    } catch (e) {}

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
        try {
          sc.weatherSetModeCustom();
          sc.weatherSetObservation(0, data.raw);
          writeLog(`WEATHER_INJECTION: ${data.icao}`);
          
          // Show tooltip in sim
          sc.text(3, `SkyFlow: Injected weather for ${data.icao}`, 8);
          
        } catch (err) {
          writeLog(`INJECTION_FAILURE: ${err.message}`, 'ERROR');
        }
      }
    } catch (e) {
      writeLog('Malformed WS packet.', 'ERROR');
    }
  });
});