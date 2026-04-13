import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  waitForConnections: true,
  connectionLimit: 5, // Reduced for stability on shared hosting
  queueLimit: 0,
  connectTimeout: 10000 // 10 seconds timeout
});

// Test connection and log status
(async () => {
  try {
    const connection = await pool.getConnection();
    console.log("✅ DATABASE CONNECTED SUCCESSFULLY to " + process.env.MYSQL_HOST);
    connection.release();
  } catch (err) {
    console.error("❌ DATABASE CONNECTION FAILED:");
    console.error(err);
    console.log("Check if your Hostinger MySQL allows connections from this host.");
  }
})();

export default pool;
