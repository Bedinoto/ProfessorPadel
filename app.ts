import express from "express";
import path from "path";
import cors from "cors";
import fs from "fs";

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

// --- TEST ROUTES ---
app.get("/ping", (req, res) => {
  debugLog("Ping route hit");
  res.status(200).send("pong");
});

app.get("/debug-info", (req, res) => {
  const info = {
    cwd: process.cwd(),
    env: process.env,
    files: fs.readdirSync(process.cwd())
  };
  res.json(info);
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
