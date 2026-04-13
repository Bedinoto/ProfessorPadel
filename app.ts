import express from "express";
import path from "path";
import cors from "cors";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import { format } from "date-fns";
import pool from "./db.ts";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "padel_secret_key";

// --- MIDDLEWARES ---
app.use(cors());
app.use(express.json());

// --- ROUTES ---
app.get("/ping", (req, res) => res.send("pong"));

app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok", database: "connected" });
  } catch (error) {
    res.status(500).json({ status: "error", message: String(error) });
  }
});

// Auth, Locations, Slots, Bookings (Simplified for stability)
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const [rows]: any = await pool.query("SELECT * FROM users WHERE LOWER(username) = ?", [username?.toLowerCase()]);
    const user = rows[0];
    if (user && bcrypt.compareSync(password, user.password)) {
      const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET);
      return res.json({ token });
    }
    res.status(400).json({ error: "Credenciais inválidas" });
  } catch (error) {
    res.status(500).json({ error: "Erro no servidor" });
  }
});

app.get("/api/locations", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM locations");
    res.json(rows);
  } catch (error) { res.status(500).json([]); }
});

app.get("/api/available-days", async (req, res) => {
  try {
    const [rows]: any = await pool.query("SELECT DISTINCT date FROM slots WHERE location_id = ? AND is_available = 1 AND date >= CURDATE() ORDER BY date", [req.query.location_id]);
    res.json(rows.map((r: any) => format(new Date(r.date), 'yyyy-MM-dd')));
  } catch (error) { res.status(500).json([]); }
});

app.get("/api/available-slots", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM slots WHERE date = ? AND location_id = ? AND is_available = 1 ORDER BY start_time", [req.query.date, req.query.location_id]);
    res.json(rows);
  } catch (error) { res.status(500).json([]); }
});

// --- SERVING FRONTEND ---
const distPath = path.join(process.cwd(), "dist");
app.use(express.static(distPath));

app.get("*", (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(distPath, "index.html"), (err) => {
    if (err) {
      res.status(200).send("Servidor Ativo. Aguardando arquivos do site (dist)...");
    }
  });
});

// --- START ---
app.listen(PORT, () => {
  console.log(`SERVER RUNNING ON PORT ${PORT}`);
});
