
/**
 * SKYFLOW BRIDGE CLI v1.1.0
 * Connects the SkyFlow Web Dashboard to FSX/P3D via SimConnect.
 */

const WebSocket = require('ws');
const { SimConnect } = require('node-simconnect');

console.log('===========================================');
console.log('SKYFLOW WEATHER BRIDGE - v1.1.0');
console.log('WINDOWS FSX/P3D INTERFACE');
console.log('===========================================');
console.log('');

const wss = new WebSocket.Server({ port: 8080 });
let simConnected = false;
let sc = null;

async function connectToSim() {
  try {
    if (sc) await sc.close();
    
    console.log('[SimConnect] Locating Simulator process...');
    sc = new SimConnect();
    await sc.open('SkyFlow Bridge');
    simConnected = true;
    console.log('[SimConnect] SUCCESS: Connected to FSX/P3D.');
    broadcastStatus();
  } catch (err) {
    console.error('[SimConnect] ERROR: Simulator not detected. Ensure FSX is running.');
    simConnected = false;
    broadcastStatus();
  }
}

function broadcastStatus() {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ 
        type: 'STATUS', 
        connected: simConnected 
      }));
    }
  });
}

// Auto-connect on startup
connectToSim();

wss.on('connection', (ws) => {
  console.log('[Bridge] Dashboard linked via WebSocket.');
  broadcastStatus();

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      
      if (data.type === 'CONNECT_SIM') {
        await connectToSim();
      }

      if (data.type === 'INJECT_WEATHER') {
        console.log(`[Injection] Station: ${data.icao} | METAR: ${data.raw}`);
        
        if (simConnected && sc) {
          // Injection into the global weather engine
          sc.weatherSetObservation(0, data.raw);
          console.log(`[FSX] Injection Successful.`);
        } else {
          console.warn('[FSX] Injection failed: Sim not connected.');
          await connectToSim(); // Try to reconnect
        }
      }
    } catch (e) {
      console.error('[Bridge] Communication Error.');
    }
  });

  ws.on('close', () => {
    console.log('[Bridge] Dashboard disconnected.');
  });
});

console.log('[Bridge] Waiting for Dashboard connection on ws://localhost:8080');
console.log('[Bridge] Press Ctrl+C to stop.');
