import express from "express";
import path from "path";
import cors from "cors";
import fs from "fs";
import { createServer as createViteServer } from "vite";

const app = express();
const PORT = process.env.PORT || 3000;

// --- VERBOSE LOGGING SYSTEM ---
const logFile = path.resolve(process.cwd(), "hostinger_debug.log");

function debugLog(msg: string) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${msg}\n`;
  try {
    fs.appendFileSync(logFile, line);
    console.log(msg);
  } catch (e) {
    // If we can't write to file, at least try to log to console
    console.error("Failed to write to log file:", e);
  }
}

async function startServer() {
  debugLog("--- APPLICATION STARTING ---");
  debugLog(`Node Version: ${process.version}`);
  debugLog(`Current Directory (CWD): ${process.cwd()}`);
  debugLog(`Port from Env: ${process.env.PORT}`);
  debugLog(`Environment: ${process.env.NODE_ENV}`);

  app.use(cors());
  app.use(express.json());

  // --- GLOBAL REQUEST LOGGER ---
  app.use((req, res, next) => {
    // Only log API routes to avoid log spamming from assets
    if (req.url.startsWith('/api')) {
      debugLog(`${req.method} ${req.url} - IP: ${req.ip}`);
    }
    next();
  });

  // --- API ROUTES ---
  app.get("/ping", (req, res) => {
    debugLog("Ping route hit");
    res.status(200).send("pong");
  });

  app.get("/api/debug-info", (req, res) => {
    const info = {
      cwd: process.cwd(),
      env: process.env,
      files: fs.readdirSync(process.cwd())
    };
    res.json(info);
  });

  // --- GOOGLE CALENDAR PROXY ---
  app.get("/api/sync-calendar", async (req, res) => {
    debugLog("--- CALENDAR PROXY ROUTE HIT ---");
    const { scriptUrl, ...params } = req.query;
    debugLog(`Sync Request Received - scriptUrl: ${scriptUrl ? 'present' : 'missing'}`);
    debugLog(`Params: ${JSON.stringify(params)}`);

    let scriptUrlString = (scriptUrl || "") as string;
    
    // Smart Fix: Se o usuário esquecer o protocolo ou a URL for incompleta
    if (scriptUrlString && !scriptUrlString.startsWith('http')) {
      scriptUrlString = `https://${scriptUrlString}`;
      debugLog(`Auto-prepending https:// to scriptUrl`);
    }

    if (!scriptUrlString || scriptUrlString.length < 10) {
       return res.status(400).json({ error: "URL do Script inválida ou ausente nas configurações." });
    }

    try {
      const url = new URL(scriptUrlString);
      Object.entries(params).forEach(([key, value]) => {
        if (value) url.searchParams.append(key, value as string);
      });

      debugLog(`Proxying to Google: ${url.toString()}`);
      
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        redirect: 'follow'
      });

      debugLog(`Google Response Status: ${response.status} ${response.statusText}`);
      
      const text = await response.text();
      debugLog(`Google Raw Body [FULL]: ${text}`);

      if (!response.ok) {
        return res.status(response.status).json({ error: `Erro no Script Google (${response.status}): ${text.substring(0, 200)}` });
      }

      // Prevenção: Se o Google devolver HTML (página de erro), não é o que queremos
      if (text.toLowerCase().includes('<html')) {
        debugLog("ALERTA: Google Script retornou HTML.");
        return res.status(500).json({ error: "O Script do Google retornou HTML em vez do ID. Verifique a publicação do Script." });
      }

      try {
        const json = JSON.parse(text);
        debugLog(`Parsed JSON: ${JSON.stringify(json)}`);
        res.json({ ...json, raw: text }); // Envia o JSON e também o texto bruto por segurança
      } catch {
        // Scanner para IDs de agenda
        const idMatch = text.match(/([a-zA-Z0-9\-_.~%]{15,}(?:@google\.com)?)/i);
        let extractedId = "";
        
        if (idMatch && idMatch[1]) {
           extractedId = idMatch[1];
           debugLog(`ID detectado no texto bruto: ${extractedId}`);
        }
        
        // Retorna tudo para debug no frontend
        res.json({ 
          message: "Success (Text Mode)", 
          id: extractedId, 
          raw: text 
        });
      }
    } catch (error: any) {
      debugLog(`CRITICAL PROXY ERROR: ${error.message}`);
      res.status(500).json({ error: `Falha técnica no Proxy: ${error.message}` });
    }
  });

  // --- VITE MIDDLEWARE OR STATIC SERVING ---
  if (process.env.NODE_ENV !== "production") {
    debugLog("Starting Vite in middleware mode...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), "dist");
    debugLog(`Checking dist path: ${distPath}`);

    if (fs.existsSync(distPath)) {
      debugLog("Dist directory found.");
      app.use(express.static(distPath));
      
      app.get("*", (req, res, next) => {
        if (req.path.startsWith('/api/')) return next();
        const indexPath = path.join(distPath, "index.html");
        if (fs.existsSync(indexPath)) {
          res.sendFile(indexPath);
        } else {
          res.status(404).send("Frontend build not found.");
        }
      });
    } else {
      debugLog("WARNING: Dist directory NOT found!");
    }
  }

  // --- SERVER LISTEN ---
  try {
    app.listen(Number(PORT), "0.0.0.0", () => {
      debugLog(`SUCCESS: Server listening on 0.0.0.0:${PORT}`);
    });
  } catch (error: any) {
    debugLog(`CRITICAL ERROR during app.listen: ${error.message}`);
  }
}

startServer();

// Catch-all for unhandled errors
process.on('uncaughtException', (err) => {
  debugLog(`FATAL UNCAUGHT EXCEPTION: ${err.message}\n${err.stack}`);
});

process.on('unhandledRejection', (reason, promise) => {
  debugLog(`UNHANDLED REJECTION at: ${promise}, reason: ${reason}`);
});
