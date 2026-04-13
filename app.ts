import express from "express";
import path from "path";
import cors from "cors";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import pool from "./db.ts";
import dotenv from "dotenv";
import { format } from "date-fns";

dotenv.config();

// --- GLOBAL ERROR HANDLING ---
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION! Shutting down...');
  console.error(err.name, err.message, err.stack);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('UNHANDLED REJECTION! Shutting down...');
  console.error(reason);
});

// Validate environment variables
const requiredEnv = ['MYSQL_HOST', 'MYSQL_USER', 'MYSQL_PASSWORD', 'MYSQL_DATABASE'];
const missingEnv = requiredEnv.filter(key => !process.env[key]);

console.log("--- Environment Check ---");
console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`PORT: ${process.env.PORT}`);
console.log(`JWT_SECRET: ${process.env.JWT_SECRET ? 'Configured' : 'Using Default'}`);
requiredEnv.forEach(key => {
  console.log(`${key}: ${process.env[key] ? 'Present' : 'MISSING'}`);
});
console.log("-------------------------");

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "padel_secret_key";

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get("/api/health", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT 1");
    res.json({ status: "ok", database: "connected", timestamp: new Date() });
  } catch (error) {
    res.status(500).json({ status: "error", database: "disconnected", message: error instanceof Error ? error.message : String(error) });
  }
});

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

app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  const cleanUsername = username?.trim().toLowerCase();
  const cleanPassword = password?.trim();

  try {
    const [rows]: any = await pool.query("SELECT * FROM users WHERE LOWER(username) = ?", [cleanUsername]);
    const user = rows[0];

    if (!user) {
      return res.status(400).json({ error: "Usuário não encontrado" });
    }

    const validPassword = bcrypt.compareSync(cleanPassword, user.password);
    if (!validPassword) {
      return res.status(400).json({ error: "Senha incorreta" });
    }

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET);
    res.json({ token });
  } catch (error) {
    res.status(500).json({ error: "Erro no servidor" });
  }
});

// --- PUBLIC ROUTES ---

app.get("/api/locations", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM locations");
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: "Erro ao buscar locais" });
  }
});

app.get("/api/available-slots", async (req, res) => {
  const { date, location_id } = req.query;
  try {
    const [rows] = await pool.query("SELECT * FROM slots WHERE date = ? AND location_id = ? AND is_available = 1", [date, location_id]);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: "Erro ao buscar horários" });
  }
});

app.get("/api/available-days", async (req, res) => {
  const { location_id } = req.query;
  try {
    const [rows]: any = await pool.query(`
      SELECT DISTINCT date 
      FROM slots 
      WHERE is_available = 1 AND location_id = ? AND date >= ?
      ORDER BY date ASC
    `, [location_id, format(new Date(), 'yyyy-MM-dd')]);
    res.json(rows.map((d: any) => format(new Date(d.date), 'yyyy-MM-dd')));
  } catch (error) {
    res.status(500).json({ error: "Erro ao buscar dias" });
  }
});

app.post("/api/bookings", async (req, res) => {
  const { slot_id, student_name, student_phone, booking_type, price } = req.body;
  
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [slots]: any = await connection.query("SELECT * FROM slots WHERE id = ? AND is_available = 1 FOR UPDATE", [slot_id]);
    const slot = slots[0];

    if (!slot) {
      await connection.rollback();
      return res.status(400).json({ error: "Horário não disponível" });
    }

    await connection.query("INSERT INTO bookings (slot_id, student_name, student_phone, booking_type, price) VALUES (?, ?, ?, ?, ?)", [slot_id, student_name, student_phone, booking_type, price]);
    await connection.query("UPDATE slots SET is_available = 0 WHERE id = ?", [slot_id]);

    await connection.commit();
    res.json({ success: true });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ error: "Erro ao realizar reserva" });
  } finally {
    connection.release();
  }
});

// --- PROFESSOR ROUTES (PROTECTED) ---

app.get("/api/admin/locations", authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM locations");
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: "Erro ao buscar locais" });
  }
});

app.post("/api/admin/locations", authenticateToken, async (req, res) => {
  const { name } = req.body;
  try {
    await pool.query("INSERT INTO locations (name) VALUES (?)", [name]);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: "Local já existe ou nome inválido" });
  }
});

app.delete("/api/admin/locations/:id", authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query("DELETE FROM locations WHERE id = ?", [id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Erro ao remover local" });
  }
});

app.get("/api/admin/all-slots-dates", authenticateToken, async (req, res) => {
  const { location_id } = req.query;
  try {
    const [rows]: any = await pool.query(`
      SELECT DISTINCT date 
      FROM slots 
      WHERE location_id = ?
    `, [location_id]);
    res.json(rows.map((d: any) => format(new Date(d.date), 'yyyy-MM-dd')));
  } catch (error) {
    res.status(500).json({ error: "Erro ao buscar datas" });
  }
});

app.post("/api/admin/slots", authenticateToken, async (req, res) => {
  const { date, times, location_id } = req.body;
  
  try {
    const duplicates = [];
    for (const time of times) {
      const [existing]: any = await pool.query("SELECT location_id FROM slots WHERE date = ? AND time = ?", [date, time]);
      if (existing[0]) {
        if (existing[0].location_id !== parseInt(location_id)) {
          duplicates.push(time);
        }
        continue;
      }
      await pool.query("INSERT INTO slots (location_id, date, time, is_available) VALUES (?, ?, ?, 1)", [location_id, date, time]);
    }
    
    if (duplicates.length > 0) {
      return res.json({ 
        success: true, 
        warning: `Alguns horários (${duplicates.join(", ")}) já estão ocupados em outro local e não foram duplicados.` 
      });
    }
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Erro ao salvar horários" });
  }
});

app.get("/api/admin/slots", authenticateToken, async (req, res) => {
  const { date, location_id } = req.query;
  try {
    const [rows] = await pool.query("SELECT * FROM slots WHERE date = ? AND location_id = ?", [date, location_id]);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: "Erro ao buscar horários" });
  }
});

app.delete("/api/admin/slots/:id", authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query("DELETE FROM slots WHERE id = ? AND is_available = 1", [id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Erro ao remover horário" });
  }
});

app.get("/api/admin/bookings", authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT b.*, s.date, s.time, l.name as location_name
      FROM bookings b 
      JOIN slots s ON b.slot_id = s.id 
      JOIN locations l ON s.location_id = l.id
      ORDER BY s.date DESC, s.time DESC
    `);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: "Erro ao buscar reservas" });
  }
});

app.patch("/api/admin/bookings/:id/pay", authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { paid, price } = req.body;
  try {
    await pool.query("UPDATE bookings SET paid = ?, price = ? WHERE id = ?", [paid ? 1 : 0, price, id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Erro ao atualizar pagamento" });
  }
});

app.delete("/api/admin/bookings/:id", authenticateToken, async (req, res) => {
  const { id } = req.params;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows]: any = await connection.query("SELECT slot_id FROM bookings WHERE id = ?", [id]);
    const booking = rows[0];
    if (booking) {
      await connection.query("UPDATE slots SET is_available = 1 WHERE id = ?", [booking.slot_id]);
      await connection.query("DELETE FROM bookings WHERE id = ?", [id]);
    }
    await connection.commit();
    res.json({ success: true });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ error: "Erro ao cancelar reserva" });
  } finally {
    connection.release();
  }
});

app.get("/api/admin/finance", authenticateToken, async (req, res) => {
  try {
    const [rows]: any = await pool.query(`
      SELECT 
        SUM(price) as total_revenue,
        SUM(CASE WHEN paid = 1 THEN price ELSE 0 END) as total_paid,
        SUM(CASE WHEN paid = 0 THEN price ELSE 0 END) as total_pending,
        COUNT(*) as total_bookings
      FROM bookings
    `);
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: "Erro ao buscar resumo financeiro" });
  }
});

// --- VITE MIDDLEWARE ---

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    try {
      // @ts-ignore - Dynamic import for dev only
      const viteModule = await import("vite");
      const vite = await viteModule.createServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
      console.log("Vite middleware loaded (Development)");
    } catch (e) {
      console.error("Failed to load Vite middleware:", e);
    }
  } else {
    const distPath = path.resolve(process.cwd(), "dist");
    console.log(`Production mode: serving static files from ${distPath}`);
    
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, () => {
    console.log(`>>> SERVER IS ALIVE <<<`);
    console.log(`Port: ${PORT}`);
    console.log(`Mode: ${process.env.NODE_ENV || 'development'}`);
  });
}

startServer();
