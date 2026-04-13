import express from "express";
import path from "path";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// --- MINIMAL ROUTES ---
app.get("/ping", (req, res) => res.send("pong"));

// Mock API for health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", mode: "client-side-only" });
});

// --- SERVING FRONTEND ---
const distPath = path.join(process.cwd(), "dist");
app.use(express.static(distPath));

app.get("*", (req, res) => {
  res.sendFile(path.join(distPath, "index.html"), (err) => {
    if (err) {
      res.status(200).send("Servidor Ativo (Modo Estático). Aguardando build do frontend...");
    }
  });
});

app.listen(PORT, () => {
  console.log(`STATIC SERVER RUNNING ON PORT ${PORT}`);
});
