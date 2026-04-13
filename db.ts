import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dbPath = path.join(process.cwd(), 'padel.db');
const db = new Database(dbPath);
db.pragma('foreign_keys = ON');

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT
  );

  CREATE TABLE IF NOT EXISTS locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE
  );

  CREATE TABLE IF NOT EXISTS slots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    location_id INTEGER,
    date TEXT,
    time TEXT,
    is_available INTEGER DEFAULT 1,
    UNIQUE(location_id, date, time),
    FOREIGN KEY(location_id) REFERENCES locations(id)
  );

  CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slot_id INTEGER,
    student_name TEXT,
    student_phone TEXT,
    booking_type TEXT,
    price REAL DEFAULT 0,
    paid INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(slot_id) REFERENCES slots(id)
  );
`);

export default db;
