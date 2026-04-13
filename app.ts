import express from "express";
import path from "path";
import cors from "cors";
import fs from "fs";

const app = express();
// Hostinger requires process.env.PORT
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// --- PING FOR 503 TEST ---
app.get("/ping", (req, res) => {
  res.status(200).send("pong");
});

// --- SERVING FRONTEND ---
// Using a more robust path resolution for Hostinger
const distPath = path.resolve(process.cwd(), "dist");

app.use(express.static(distPath));

app.get("*", (req, res) => {
  const indexPath = path.join(distPath, "index.html");
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(200).send(`
      <h1>Servidor Node.js Ativo</h1>
      <p>Pasta 'dist' não encontrada em: ${distPath}</p>
      <p>Certifique-se de que o comando 'npm run build' foi executado com sucesso.</p>
    `);
  }
});

// Global error logger for Hostinger
process.on('uncaughtException', (err) => {
  fs.writeFileSync('erro_fatal.txt', `${new Date().toISOString()}: ${err.message}\n${err.stack}`);
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
