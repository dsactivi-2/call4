
/**
 * JOBSTEP CLOUD BRIDGE v2.0
 * Backend za spajanje Vonage PSTN-a sa Gemini AI Live Stream-om.
 */

import express from 'express';
import bodyParser from 'body-parser';
import { Vonage } from '@vonage/server-sdk';
import WebSocket, { WebSocketServer } from 'ws'; // Import WebSocketServer for the server
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url'; // Used to get __dirname equivalent
import 'dotenv/config'; // Load environment variables

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(bodyParser.json());

// Serve static files from the 'dist' directory (where Vite builds the frontend)
app.use(express.static(path.join(__dirname, 'dist'))); // Added static file serving

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/socket' }); // Use WebSocketServer

// VONAGE CONFIG
const vonage = new Vonage({
  apiKey: process.env.VONAGE_API_KEY || "45534291",
  apiSecret: process.env.VONAGE_API_SECRET,
  applicationId: process.env.VONAGE_APPLICATION_ID,
  privateKey: "./private.key"
});

// WEBSOCKET HANDLER
wss.on('connection', (ws) => {
  console.log('[BRIDGE] Nova audio konekcija uspostavljena.');

  ws.on('message', (message) => {
    // Ovde primamo audio bajtove iz Vonage-a (PCM L16)
    // I prosljeđujemo ih prema Gemini API-ju (preko frontend-a ili direktno)
    // Za demo svrhe, logujemo protok:
    // console.log(`[AUDIO] Primljeno ${message.length} bajtova.`);
  });

  ws.on('close', () => console.log('[BRIDGE] Konekcija zatvorena.'));
});

// Healthcheck endpoint for Railway
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// NCCO ENDPOINT (Vonage zove ovo kad se poziv uspostavi)
app.get('/ncco', (req, res) => {
  const ncco = [
    {
      action: 'talk',
      text: "Jobstep Portal vas spaja sa Goranom. Sačekajte trenutak.",
      language: "sr-RS",
      style: 0
    },
    {
      action: 'connect',
      endpoint: [{
        type: 'websocket',
        uri: `wss://${req.hostname}/socket`,
        'content-type': 'audio/l16;rate=16000'
      }]
    }
  ];
  res.json(ncco);
});

// TRIGGER CALL (Inicijalizacija sa Portala)
app.post('/api/call', async (req, res) => {
  const { number } = req.body;
  if (!number) return res.status(400).json({ error: "Broj nedostaje" });

  try {
    const result = await vonage.voice.createCall({
      to: [{ type: 'phone', number }],
      from: { type: 'phone', number: process.env.VONAGE_NUMBER },
      answer_url: [`https://${req.hostname}/ncco`],
      event_url: [`https://${req.hostname}/events`]
    });
    res.json({ success: true, uuid: result.uuid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// STATUS EVENTS
app.post('/events', (req, res) => {
  console.log('[EVENT]', req.body.status);
  res.sendStatus(200);
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`🚀 Jobstep Bridge je LIVE na portu ${PORT}`);
  console.log(`Frontend served from ${path.join(__dirname, 'dist')}`);
});
