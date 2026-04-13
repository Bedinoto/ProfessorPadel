import express from "express";
import path from "path";
import cors from "cors";
import fs from "fs";
import { fileURLToPath } from 'url';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// --- LOGGING ---
const logFile = path.join(process.cwd(), "server_log.txt");
function log(msg: string) {
  const line = `${new Date().toISOString()}: ${msg}\n`;
  try {
    fs.appendFileSync(logFile, line);
  } catch (e) {}
  console.log(msg);
}

log("SERVER STARTING (ESM)...");

app.get("/ping", (req, res) => {
  res.status(200).send("pong");
});

// In ESM, we derive __dirname if needed, but process.cwd() is usually fine for dist
const distPath = path.resolve(process.cwd(), "dist");

app.use(express.static(distPath));

app.get("*", (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  
  const indexPath = path.join(distPath, "index.html");
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(200).send(`
      <h1>Servidor Node.js Ativo (ESM)</h1>
      <p>Pasta 'dist' não encontrada em: ${distPath}</p>
      <p>CWD: ${process.cwd()}</p>
    `);
  }
});

app.listen(Number(PORT), "0.0.0.0", () => {
  log(`SERVER RUNNING ON PORT ${PORT}`);
});

process.on('uncaughtException', (err) => {
  log(`FATAL EXCEPTION: ${err.message}\n${err.stack}`);
});
