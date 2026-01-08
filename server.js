import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Hostinger ke liye PORT hamesha process.env.PORT se lo
const PORT = process.env.PORT || 3000;

// ✅ Hostinger MySQL env vars use karo (apne hPanel ke hisaab se set karna):
const DB_CONFIG = {
 user: process.env.DB_USER,
 password: process.env.DB_PASSWORD,
 database: process.env.DB_NAME,
 host: process.env.DB_HOST,
 port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306,
 waitForConnections: true,
 connectionLimit: 20,
 queueLimit: 0,
 timezone: '+00:00',
 dateStrings: true,
};

const app = express();
let pool = mysql.createPool(DB_CONFIG);
let isDbInitialized = false;

// ✅ DB init helper
const initDb = async () => {
 if (isDbInitialized) return;
 try {
 await pool.query('SELECT 1');
 console.log('Database connected successfully');
 isDbInitialized = true;
 } catch (err) {
 console.error('Database connection failed:', err.message);
 }
};

app.use(cors());
app.use(express.json());

// ✅ Static frontend serve karna (agar Vite/React ka build folder hai)
const clientDistPath = path.join(__dirname, 'dist');
app.use(express.static(clientDistPath));

// ✅ Health check / root route — yahi pe 404 avoid hoga
app.get('/', async (req, res) => {
 try {
 await initDb();
 res.send('Bihari Chatkara RMS server is running');
 } catch (err) {
 res.status(500).send('Server running, but DB connection failed');
 }
});

// Example API route (adjust karo apne hisaab se)
app.get('/api/ping', async (req, res) => {
 try {
 await initDb();
 const [rows] = await pool.query('SELECT NOW() AS now');
 res.json({ status: 'ok', dbTime: rows[0].now });
 } catch (err) {
 console.error(err);
 res.status(500).json({ error: 'DB error' });
 }
});

// ✅ React/Vite SPA ke liye catch-all route (optional, agar frontend bhi yahi se serve kar rahe ho)
app.get('*', (req, res) => {
 res.sendFile(path.join(clientDistPath, 'index.html'));
});

// ✅ Start server
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "Bihari Chatkara RMS",
    time: new Date().toISOString()
  });
});

app.listen(PORT, () => {
 console.log(`Server running on port ${PORT}`);
});
