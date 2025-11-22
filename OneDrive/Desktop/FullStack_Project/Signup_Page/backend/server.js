// server.js
import express from "express";
import mysql from "mysql2/promise";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cors()); // allow cross-origin requests from frontend
app.use(express.static(path.join(__dirname, "public"))); // serve frontend files from /public

// Read DB creds from env (safer)
const DB_HOST = process.env.DB_HOST || "127.0.0.1";
const DB_PORT = process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306;
const DB_USER = process.env.DB_USER || "root";
const root = process.env.root || "root";
const DB_NAME = process.env.DB_NAME || "signup_db";

const JWT_SECRET = process.env.JWT_SECRET || "change_this_secret_in_production";
const SALT_ROUNDS = Number(process.env.SALT_ROUNDS) || 10;

// Helper: create DB and return a pool connected to DB_NAME
async function initDB() {
  // 1) connect without database to create DB if missing
  const conn = await mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: root,
    // connectTimeout: 10000
  });

  await conn.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\``);
  console.log(` Database ${DB_NAME} ready`);
  await conn.end();

  // 2) create a pool connected to that database
  const pool = mysql.createPool({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: root,
    database: DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });

  // 3) create table if not exists
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS signup (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(100) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;
  await pool.query(createTableSQL);
  console.log(" Table signup is ready");

  return pool;
}

let pool;
initDB()
  .then((p) => {
    pool = p;
  })
  .catch((err) => {
    console.error(" Failed to initialize database:", err.message || err);
    process.exit(1);
  });

// --- Auth middleware ---
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader)
    return res.status(401).json({ message: "No token provided" });

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer")
    return res.status(401).json({ message: "Invalid auth format" });

  const token = parts[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload; // contains id and email
    return next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

// --- API routes ---

// Signup: POST /api/signup
// body: { name, email, password }
app.post("/api/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res
        .status(400)
        .json({ message: "name, email, password required" });

    // check if email exists
    const [rows] = await pool.query("SELECT id FROM signup WHERE email = ?", [
      email,
    ]);
    if (rows.length > 0)
      return res.status(409).json({ message: "Email already registered" });

    // hash password
    const hashed = await bcrypt.hash(password, SALT_ROUNDS);

    // insert user
    const [result] = await pool.query(
      "INSERT INTO signup (name, email, password) VALUES (?, ?, ?)",
      [name, email, hashed]
    );

    const userId = result.insertId;
    return res.status(201).json({ message: "User created", userId });
  } catch (err) {
    console.error("Signup error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// Login: POST /api/login
// body: { email, password }
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: "email and password required" });

    const [rows] = await pool.query(
      "SELECT id, name, email, password FROM signup WHERE email = ?",
      [email]
    );
    if (rows.length === 0)
      return res.status(401).json({ message: "Invalid credentials" });

    const user = rows[0];
    const matched = await bcrypt.compare(password, user.password);
    if (!matched)
      return res.status(401).json({ message: "Invalid credentials" });

    // sign token
    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name },
      JWT_SECRET,
      { expiresIn: "2h" }
    );

    return res.json({
      message: "Login successful",
      token,
      user: { id: user.id, name: user.name, email: user.email },
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// Protected route: GET /api/profile
app.get("/api/profile", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const [rows] = await pool.query(
      "SELECT id, name, email, created_at FROM signup WHERE id = ?",
      [userId]
    );
    if (rows.length === 0)
      return res.status(404).json({ message: "User not found" });
    return res.json({ user: rows[0] });
  } catch (err) {
    console.error("Profile error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// Frontend route fallback (optional)
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// start
app.listen(PORT, () => {
  console.log(` Server running on http://localhost:${PORT}`);
});
