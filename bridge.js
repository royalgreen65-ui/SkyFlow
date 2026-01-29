/**
 * SKYFLOW CORE ENGINE v2.10
 * Robust Bridge for FSX/P3D with Persistent Logging
 */

const WebSocket = require('ws');
const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const UI_PORT = 3000;
const LOG_FILE = path.join(__dirname, 'skyflow_avionics.log');

// --- LOGGING ENGINE ---
function writeLog(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  const entry = `[${timestamp}] [${level}] ${message}\n`;
  console.log(entry.trim());
  try {
    fs.appendFileSync(LOG_FILE, entry);
  } catch (err) {
    console.error('Failed to write to log file:', err);
  }
}

// 30-Day Auto-Purge Logic
if (fs.existsSync(LOG_FILE)) {
  try {
    const stats = fs.statSync(LOG_FILE);
    const now = new Date().getTime();
    const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;
    if (now - stats.birthtimeMs > thirtyDaysInMs) {
      fs.writeFileSync(LOG_FILE, `[SYSTEM] Log purged after 30 days of service.\n`);
      console.log('SKYFLOW: 30-day log rotation executed.');
    }
  } catch (e) {
    writeLog('Purge check failed: ' + e.message, 'WARN');
  }
}

writeLog('SkyFlow Bridge Initializing...');

// --- SERVER SETUP ---
app.use((req, res, next) => {
  if (req.url.endsWith('.tsx') || req.url.endsWith('.ts')) {
    res.set('Content-Type', 'application/javascript');
  }
  next();
});

app.use(express.static(__dirname));

app.get('/api/logs', (req, res) => {
  if (fs.existsSync(LOG_FILE)) {
    res.sendFile(LOG_FILE);
  } else {
    res.status(404).send('Log file not found.');
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(UI_PORT, () => {
  writeLog(`UI Server active on http://localhost:${UI_PORT}`);
});

// --- SIMCONNECT BRIDGE ---
let SimConnect = null;
try {
  SimConnect = require('node-simconnect').SimConnect;
} catch (e) {
  writeLog('SimConnect Driver not detected. Operating in simulated mode.', 'WARN');
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
    writeLog('SimConnect Link established with FSX/P3D', 'SUCCESS');
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
  writeLog('Remote dashboard connected via WebSocket');
  broadcastStatus();
  ws.on('message', async (msg) => {
    try {
      const data = JSON.parse(msg);
      if (data.type === 'INJECT_WEATHER' && simConnected && sc) {
        sc.weatherSetObservation(0, data.raw);
        writeLog(`WEATHER_INJECTION: ${data.icao} telemetry pushed to sim.`);
      }
    } catch (e) {
      writeLog('Malformed WS packet received.', 'ERROR');
    }
  });
});
