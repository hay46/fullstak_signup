import express from "express";
import mysql from "mysql2";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import bcrypt from "bcryptjs";

dotenv.config();

const app = express();

// Configuration
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet());
app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  })
);
app.use(express.json());

// Database Configuration
const dbConfig = {
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "root",
  database: process.env.DB_NAME || "haymanot-ebabu-portfolio",
  port: process.env.DB_PORT || 3306,
};

// Database Connection
const db = mysql.createConnection(dbConfig);

// Query helper
const executeQuery = (query, params = []) =>
  new Promise((resolve, reject) => {
    db.query(query, params, (err, results) =>
      err ? reject(err) : resolve(results)
    );
  });

// Initialize Database Table
const initializeDatabase = async () => {
  try {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        full_name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    await executeQuery(createTableQuery);
    console.log("Users table checked/created successfully!");
  } catch (error) {
    console.error("Database initialization error:", error);
  }
};

// Connect to database and initialize
db.connect(async (err) => {
  if (err) {
    console.error("Database connection failed:", err.message);
    process.exit(1);
  } else {
    console.log("Connected to MySQL Database!");
    await initializeDatabase();
  }
});

// Routes

// Health check
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    message: "Server is running",
    timestamp: new Date().toISOString(),
  });
});

// Test database endpoint
app.get("/test-db", async (req, res) => {
  try {
    // Test query
    const result = await executeQuery("SELECT 1 + 1 AS solution");
    console.log("Database test result:", result);

    // Check if users table exists
    const tableCheck = await executeQuery("SHOW TABLES LIKE 'users'");

    res.json({
      success: true,
      message: "Database connection successful",
      tableExists: tableCheck.length > 0,
      testResult: result[0].solution,
    });
  } catch (error) {
    console.error("Database test failed:", error);
    res.status(500).json({
      success: false,
      error: "Database test failed: " + error.message,
    });
  }
});

// Create users table (manual endpoint)
app.get("/create-users-table", async (req, res) => {
  try {
    const query = `
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        full_name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await executeQuery(query);
    res.json({ success: true, message: "Users table ready!" });
  } catch (error) {
    console.error("Table creation error:", error);
    res.status(500).json({ success: false, error: "Table creation failed" });
  }
});

// Signup endpoint
app.post("/signup", async (req, res) => {
  try {
    console.log("Received signup request:", req.body);

    const { full_name, email, password } = req.body;

    // Validation
    if (!full_name || !email || !password) {
      return res.status(400).json({
        success: false,
        error: "Full name, email and password are required",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: "Password must be at least 6 characters",
      });
    }

    // Check if user exists
    const existingUser = await executeQuery(
      "SELECT id FROM users WHERE email = ?",
      [email]
    );

    if (existingUser.length > 0) {
      return res.status(409).json({
        success: false,
        error: "User already exists with this email",
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user
    const result = await executeQuery(
      "INSERT INTO users (full_name, email, password) VALUES (?, ?, ?)",
      [full_name, email, hashedPassword]
    );

    console.log("User created successfully with ID:", result.insertId);

    res.status(201).json({
      success: true,
      message: "User registered successfully!",
      user: {
        id: result.insertId,
        full_name,
        email,
      },
    });
  } catch (error) {
    console.error("Signup error details:", error);

    // More specific error handling
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        error: "Email already exists",
      });
    }

    if (error.code === "ER_NO_SUCH_TABLE") {
      return res.status(500).json({
        success: false,
        error: "Database table not found. Please contact administrator.",
      });
    }

    res.status(500).json({
      success: false,
      error: "Registration failed: " + error.message,
    });
  }
});

// Get all users
app.get("/users", async (req, res) => {
  try {
    const users = await executeQuery(
      "SELECT id, full_name, email, created_at FROM users"
    );
    res.json({ success: true, data: users });
  } catch (error) {
    console.error("Get users error:", error);
    res.status(500).json({ success: false, error: "Failed to fetch users" });
  }
});

// Root route
app.get("/", (req, res) => {
  res.json({
    message: "Signup API Server is running!",
    endpoints: {
      health: "GET /health",
      testDB: "GET /test-db",
      createTable: "GET /create-users-table",
      signup: "POST /signup",
      getUsers: "GET /users",
    },
  });
});

// Error handling for unhandled routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Route not found",
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error("Global error handler:", error);
  res.status(500).json({
    success: false,
    error: "Internal server error",
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`URL: http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Database test: http://localhost:${PORT}/test-db`);
});
