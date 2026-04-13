import pool from './db.ts';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

async function initDb() {
  try {
    console.log('Iniciando migração para MySQL...');

    // Create Tables
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS locations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS slots (
        id INT AUTO_INCREMENT PRIMARY KEY,
        location_id INT,
        date DATE NOT NULL,
        time VARCHAR(10) NOT NULL,
        is_available TINYINT(1) DEFAULT 1,
        UNIQUE(location_id, date, time),
        FOREIGN KEY(location_id) REFERENCES locations(id) ON DELETE CASCADE
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS bookings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        slot_id INT,
        student_name VARCHAR(255) NOT NULL,
        student_phone VARCHAR(50),
        booking_type VARCHAR(50),
        price DECIMAL(10, 2) DEFAULT 0,
        paid TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(slot_id) REFERENCES slots(id) ON DELETE CASCADE
      )
    `);

    console.log('Tabelas verificadas/criadas com sucesso.');

    // Create default user
    const [rows]: any = await pool.query('SELECT COUNT(*) as count FROM users');
    if (rows[0].count === 0) {
      const hashedPassword = bcrypt.hashSync(process.env.ADMIN_PASSWORD || "admin123", 10);
      await pool.query('INSERT INTO users (username, password) VALUES (?, ?)', ['professor', hashedPassword]);
      console.log('Usuário padrão criado: professor / admin123');
    }

    console.log('Migração concluída com sucesso!');
    process.exit(0);
  } catch (error) {
    console.error('Erro durante a migração:', error);
    process.exit(1);
  }
}

initDb();
