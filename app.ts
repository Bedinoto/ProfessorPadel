import express from "express";
import path from "path";
import cors from "cors";
import fs from "fs";
import { google } from "googleapis";
import admin from "firebase-admin";
import { initializeApp as initializeClientApp } from 'firebase/app';
import { getFirestore as getClientFirestore, doc as clientDoc, getDoc as getClientDoc, setDoc as clientSetDoc, collection as clientCollection, serverTimestamp } from 'firebase/firestore';
import firebaseConfig from "./firebase-applet-config.json";

// --- VERBOSE LOGGING SYSTEM ---
const logFile = path.resolve(process.cwd(), "hostinger_debug.log");

function debugLog(msg: string) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${msg}\n`;
  try {
    fs.appendFileSync(logFile, line);
    console.log(msg);
  } catch (e) {
    console.error("Failed to write to log file:", e);
  }
}

debugLog("--- APPLICATION STARTING ---");

// Initialize Firebase Admin (still needed for some admin tasks if any)
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      projectId: firebaseConfig.projectId,
    });
    debugLog(`Firebase Admin initialized for project: ${firebaseConfig.projectId}`);
  } catch (e: any) {
    debugLog(`Firebase Admin initialization failed: ${e.message}`);
  }
}

// Use Client SDK for Firestore on the server
const clientApp = initializeClientApp(firebaseConfig);
const db = getClientFirestore(clientApp, firebaseConfig.firestoreDatabaseId);
debugLog(`Client Firestore instance created for database: ${firebaseConfig.firestoreDatabaseId}`);

const app = express();
const PORT = process.env.PORT || 3000;

// --- GOOGLE OAUTH CONFIG ---
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.APP_URL || 'http://localhost:3000'}/api/auth/google/callback`
);

app.use(cors());
app.use(express.json());

// --- API ROUTES ---

// 1. Get Google Auth URL
app.get("/api/auth/google/url", (req, res) => {
  const scopes = [
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/calendar.readonly'
  ];

  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent' // Force to get refresh_token
  });

  res.json({ url });
});

// 2. Google Auth Callback
app.get("/api/auth/google/callback", async (req, res) => {
  const { code } = req.query;
  
  try {
    const { tokens } = await oauth2Client.getToken(code as string);
    
    // Store the refresh_token in Firestore using Client SDK
    if (tokens.refresh_token) {
      const docRef = clientDoc(db, 'settings', 'google_calendar');
      await clientSetDoc(docRef, {
        refresh_token: tokens.refresh_token,
        admin_email: "uillian.bedinoto@gmail.com",
        updated_at: serverTimestamp()
      }, { merge: true });
    }

    res.send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'GOOGLE_AUTH_SUCCESS' }, '*');
              window.close();
            } else {
              window.location.href = '/admin';
            }
          </script>
          <p>Conexão com Google Calendar realizada com sucesso! Esta janela fechará automaticamente.</p>
        </body>
      </html>
    `);
  } catch (error: any) {
    debugLog(`OAuth Error: ${error.message}`);
    res.status(500).send("Erro na autenticação com Google.");
  }
});

// 3. Create Calendar Event
app.post("/api/calendar/create-event", async (req, res) => {
  const { summary, description, startDateTime, endDateTime, location } = req.body;

  try {
    const docRef = clientDoc(db, 'settings', 'google_calendar');
    const settingsDoc = await getClientDoc(docRef);
    
    if (!settingsDoc.exists() || !settingsDoc.data()?.refresh_token) {
      return res.status(400).json({ error: "Google Calendar não está conectado." });
    }

    const refreshToken = settingsDoc.data()?.refresh_token;
    oauth2Client.setCredentials({ refresh_token: refreshToken });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    const event = {
      summary,
      location,
      description,
      start: {
        dateTime: startDateTime,
        timeZone: 'America/Sao_Paulo',
      },
      end: {
        dateTime: endDateTime,
        timeZone: 'America/Sao_Paulo',
      },
    };

    const response = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: event,
    });

    res.json({ success: true, eventId: response.data.id });
  } catch (error: any) {
    debugLog(`Calendar Event Error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// --- FRONTEND SERVING ---
const distPath = path.resolve(process.cwd(), "dist");
debugLog(`Checking dist path: ${distPath}`);

if (fs.existsSync(distPath)) {
  debugLog("Dist directory found.");
  app.use(express.static(distPath));
} else {
  debugLog("WARNING: Dist directory NOT found!");
}

app.get("*", (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  
  const indexPath = path.join(distPath, "index.html");
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(200).send(`
      <html>
        <body style="font-family: sans-serif; padding: 2rem;">
          <h1 style="color: #16a34a;">✅ Servidor Node.js está Online</h1>
          <p>O servidor iniciou com sucesso, mas não encontrou os arquivos do site (pasta dist).</p>
          <hr>
          <ul>
            <li><b>Porta:</b> ${PORT}</li>
            <li><b>Caminho:</b> ${process.cwd()}</li>
            <li><b>Arquivos na raiz:</b> ${fs.readdirSync(process.cwd()).join(", ")}</li>
          </ul>
          <p>Verifique se você executou o <b>npm run build</b> antes de subir os arquivos.</p>
        </body>
      </html>
    `);
  }
});

// --- SERVER LISTEN ---
try {
  app.listen(Number(PORT), "0.0.0.0", () => {
    debugLog(`SUCCESS: Server listening on 0.0.0.0:${PORT}`);
  });
} catch (error: any) {
  debugLog(`CRITICAL ERROR during app.listen: ${error.message}`);
}

// Catch-all for unhandled errors
process.on('uncaughtException', (err) => {
  debugLog(`FATAL UNCAUGHT EXCEPTION: ${err.message}\n${err.stack}`);
});

process.on('unhandledRejection', (reason, promise) => {
  debugLog(`UNHANDLED REJECTION at: ${promise}, reason: ${reason}`);
});
