import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import cors from "cors";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import db from "./db.ts";
import dotenv from "dotenv";
import { format } from "date-fns";

dotenv.config();

const app = express();
const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || "padel_secret_key";

app.use(cors());
app.use(express.json());

// Middleware to verify JWT
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: "Token não fornecido" });

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.status(403).json({ error: "Token inválido ou expirado" });
    req.user = user;
    next();
  });
};

// --- AUTH ROUTES ---

app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  const cleanUsername = username?.trim().toLowerCase();
  const cleanPassword = password?.trim();

  console.log(`Login attempt for: ${cleanUsername}`);
  const user: any = db.prepare("SELECT * FROM users WHERE LOWER(username) = ?").get(cleanUsername);

  if (!user) {
    console.log("User not found");
    return res.status(400).json({ error: "Usuário não encontrado" });
  }

  const validPassword = bcrypt.compareSync(cleanPassword, user.password);
  if (!validPassword) {
    console.log("Invalid password");
    return res.status(400).json({ error: "Senha incorreta" });
  }

  console.log("Login successful");
  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET);
  res.json({ token });
});

// Initial user creation if none exists
const adminCount: any = db.prepare("SELECT COUNT(*) as count FROM users").get();
if (adminCount.count === 0) {
  const hashedPassword = bcrypt.hashSync(process.env.ADMIN_PASSWORD || "admin123", 10);
  db.prepare("INSERT INTO users (username, password) VALUES (?, ?)").run("professor", hashedPassword);
  console.log("Default professor user created: professor / admin123");
}

// --- PUBLIC ROUTES ---

// Get all locations
app.get("/api/locations", (req, res) => {
  const locations = db.prepare("SELECT * FROM locations").all();
  res.json(locations);
});

// Get available slots for a specific location and date
app.get("/api/available-slots", (req, res) => {
  const { date, location_id } = req.query;
  const slots = db.prepare("SELECT * FROM slots WHERE date = ? AND location_id = ? AND is_available = 1").all(date, location_id);
  res.json(slots);
});

// Get list of dates that have available slots for a specific location
app.get("/api/available-days", (req, res) => {
  const { location_id } = req.query;
  const days = db.prepare(`
    SELECT DISTINCT date 
    FROM slots 
    WHERE is_available = 1 AND location_id = ? AND date >= ?
    ORDER BY date ASC
  `).all(location_id, format(new Date(), 'yyyy-MM-dd'));
  res.json(days.map((d: any) => d.date));
});

// Create a booking
app.post("/api/bookings", (req, res) => {
  const { slot_id, student_name, student_phone, booking_type, price } = req.body;
  
  try {
    const slot: any = db.prepare("SELECT * FROM slots WHERE id = ? AND is_available = 1").get(slot_id);
    if (!slot) return res.status(400).json({ error: "Horário não disponível" });

    const transaction = db.transaction(() => {
      db.prepare("INSERT INTO bookings (slot_id, student_name, student_phone, booking_type, price) VALUES (?, ?, ?, ?, ?)").run(slot_id, student_name, student_phone, booking_type, price);
      db.prepare("UPDATE slots SET is_available = 0 WHERE id = ?").run(slot_id);
    });
    
    transaction();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Erro ao realizar reserva" });
  }
});

// --- PROFESSOR ROUTES (PROTECTED) ---

// Location management
app.get("/api/admin/locations", authenticateToken, (req, res) => {
  const locations = db.prepare("SELECT * FROM locations").all();
  res.json(locations);
});

app.post("/api/admin/locations", authenticateToken, (req, res) => {
  const { name } = req.body;
  try {
    db.prepare("INSERT INTO locations (name) VALUES (?)").run(name);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: "Local já existe ou nome inválido" });
  }
});

app.delete("/api/admin/locations/:id", authenticateToken, (req, res) => {
  const { id } = req.params;
  try {
    db.prepare("DELETE FROM locations WHERE id = ?").run(id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Erro ao remover local (pode haver horários vinculados)" });
  }
});

// Manage slots (Add/Remove availability)
app.post("/api/admin/slots", authenticateToken, (req, res) => {
  const { date, times, location_id } = req.body;
  
  try {
    const insert = db.prepare("INSERT OR IGNORE INTO slots (location_id, date, time, is_available) VALUES (?, ?, ?, 1)");
    const transaction = db.transaction((slots) => {
      for (const time of slots) insert.run(location_id, date, time);
    });
    transaction(times);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Erro ao salvar horários" });
  }
});

app.delete("/api/admin/slots/:id", authenticateToken, (req, res) => {
  const { id } = req.params;
  try {
    db.prepare("DELETE FROM slots WHERE id = ? AND is_available = 1").run(id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Erro ao remover horário" });
  }
});

// Get all bookings (Finance/Student control)
app.get("/api/admin/bookings", authenticateToken, (req, res) => {
  const bookings = db.prepare(`
    SELECT b.*, s.date, s.time, l.name as location_name
    FROM bookings b 
    JOIN slots s ON b.slot_id = s.id 
    JOIN locations l ON s.location_id = l.id
    ORDER BY s.date DESC, s.time DESC
  `).all();
  res.json(bookings);
});

// Update payment status
app.patch("/api/admin/bookings/:id/pay", authenticateToken, (req, res) => {
  const { id } = req.params;
  const { paid, price } = req.body;
  try {
    db.prepare("UPDATE bookings SET paid = ?, price = ? WHERE id = ?").run(paid ? 1 : 0, price, id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Erro ao atualizar pagamento" });
  }
});

// Delete booking (cancel and free slot)
app.delete("/api/admin/bookings/:id", authenticateToken, (req, res) => {
  const { id } = req.params;
  try {
    const booking: any = db.prepare("SELECT slot_id FROM bookings WHERE id = ?").get(id);
    if (booking) {
      const transaction = db.transaction(() => {
        db.prepare("UPDATE slots SET is_available = 1 WHERE id = ?").run(booking.slot_id);
        db.prepare("DELETE FROM bookings WHERE id = ?").run(id);
      });
      transaction();
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Erro ao cancelar reserva" });
  }
});

// Get financial summary
app.get("/api/admin/finance", authenticateToken, (req, res) => {
  const summary = db.prepare(`
    SELECT 
      SUM(price) as total_revenue,
      SUM(CASE WHEN paid = 1 THEN price ELSE 0 END) as total_paid,
      SUM(CASE WHEN paid = 0 THEN price ELSE 0 END) as total_pending,
      COUNT(*) as total_bookings
    FROM bookings
  `).get();
  res.json(summary);
});

// --- VITE MIDDLEWARE ---

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
