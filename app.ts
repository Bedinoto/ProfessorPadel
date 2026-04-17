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

  // Middleware to log every single request
  app.use((req, res, next) => {
    debugLog(`${req.method} ${req.url} - IP: ${req.ip}`);
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
    const { scriptUrl, ...params } = req.query;
    debugLog(`Sync Request Received - scriptUrl: ${scriptUrl ? 'present' : 'missing'}`);
    
    if (!scriptUrl) return res.status(400).json({ error: "Script URL is required" });

    try {
      const url = new URL(scriptUrl as string);
      Object.entries(params).forEach(([key, value]) => {
        if (value) url.searchParams.append(key, value as string);
      });

      debugLog(`Proxying to Google: ${url.toString()}`);
      
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0' // Alguns serviços bloqueiam requests sem UA
        },
        redirect: 'follow'
      });

      debugLog(`Google Response Status: ${response.status} ${response.statusText}`);
      
      const text = await response.text();
      debugLog(`Google Raw Body (first 200 chars): ${text.substring(0, 200)}`);

      if (!response.ok) {
        return res.status(response.status).json({ error: `Google Script Error: ${text}` });
      }

      try {
        const json = JSON.parse(text);
        res.json(json);
      } catch {
        // Se não for JSON, devolvemos o texto bruto no campo 'raw'
        // Isso cobre o caso onde o script retorna apenas o ID como string
        res.json({ message: "Success", raw: text.trim() });
      }
    } catch (error: any) {
      debugLog(`CRITICAL PROXY ERROR: ${error.message}`);
      res.status(500).json({ error: `Erro no Servidor Proxy: ${error.message}` });
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
