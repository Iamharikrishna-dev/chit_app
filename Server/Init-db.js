/**
 * PPM Chits — Simple Secure Backend (PostgreSQL)
 * -----------------------------------------------
 * One main file. PostgreSQL via the plain `pg` driver — no ORM, so every
 * query is visible and easy to follow. Run `npm run init-db` once first
 * to create the users table.
 *
 * Security included:
 *   - bcrypt password hashing
 *   - JWT session token in an httpOnly cookie (never touchable by JS)
 *   - Rate limiting on login
 *   - Account lockout after repeated failed attempts
 *   - Generic error messages (no email enumeration)
 *   - Helmet security headers + locked-down CORS
 *   - Parameterized SQL everywhere (no injection risk)
 */

require("dotenv").config();

const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const { Pool } = require("pg");

const {
  PORT = 4000,
  NODE_ENV = "development",
  CORS_ORIGIN = "",
  JWT_SECRET,
  JWT_EXPIRES_IN = "7d",
  COOKIE_DOMAIN,
  COOKIE_SECURE = "true",
  MAX_FAILED_LOGIN_ATTEMPTS = 5,
  LOCKOUT_MINUTES = 15,
  DATABASE_URL,
} = process.env;

if (!JWT_SECRET || JWT_SECRET.includes("REPLACE_WITH")) {
  console.error("JWT_SECRET is not set. Generate one with: openssl rand -base64 64");
  process.exit(1);
}
if (!DATABASE_URL) {
  console.error("DATABASE_URL is not set. Check your .env file.");
  process.exit(1);
}

/* ============================================================
   DATABASE
   Run `npm run init-db` once before starting the server.
============================================================ */
const pool = new Pool({ connectionString: DATABASE_URL });

/* ============================================================
   APP SETUP
============================================================ */
const app = express();
app.set("trust proxy", 1); // needed behind Caddy/Nginx

app.use(helmet());

const allowedOrigins = CORS_ORIGIN.split(",").map((s) => s.trim()).filter(Boolean);
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts. Please try again in 15 minutes." },
});

/* ============================================================
   HELPERS
============================================================ */
function setAuthCookie(res, token) {
  res.cookie("token", token, {
    httpOnly: true,
    secure: COOKIE_SECURE === "true",
    sameSite: "strict",
    domain: COOKIE_DOMAIN || undefined,
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
}

function requireAuth(req, res, next) {
  const token = req.cookies?.token;
  if (!token) return res.status(401).json({ error: "Not authenticated." });

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Session expired. Please log in again." });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "You do not have permission to do this." });
    }
    next();
  };
}

function isValidEmail(email) {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// small wrapper so route handlers can just `throw` / reject and it's caught centrally
function asyncRoute(fn) {
  return (req, res, next) => fn(req, res, next).catch(next);
}

/* ============================================================
   ROUTES
============================================================ */

// --- Register (lock down after creating your first admin — see README) ---
app.post(
  "/api/auth/register",
  asyncRoute(async (req, res) => {
    const { email, password, name, role } = req.body || {};

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: "Please enter a valid email address." });
    }
    if (!password || password.length < 10) {
      return res.status(400).json({ error: "Password must be at least 10 characters." });
    }
    if (!name || name.trim().length < 2) {
      return res.status(400).json({ error: "Please enter a name." });
    }

    const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: "Unable to create account with these details." });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const safeRole = role === "admin" || role === "super_admin" ? role : "staff";

    const result = await pool.query(
      `INSERT INTO users (email, password_hash, name, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, name, role`,
      [email, passwordHash, name.trim(), safeRole]
    );

    return res.status(201).json(result.rows[0]);
  })
);

// --- Login ---
app.post(
  "/api/auth/login",
  loginLimiter,
  asyncRoute(async (req, res) => {
    const { email, password } = req.body || {};
    const genericError = () => res.status(401).json({ error: "Invalid email or password." });

    if (!isValidEmail(email) || !password) return genericError();

    const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    const user = result.rows[0];

    if (!user || !user.is_active) return genericError();

    // Lockout check
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const minutesLeft = Math.ceil((new Date(user.locked_until) - new Date()) / 60000);
      return res.status(423).json({
        error: `Account temporarily locked. Try again in ${minutesLeft} minute(s).`,
      });
    }

    const passwordValid = await bcrypt.compare(password, user.password_hash);

    if (!passwordValid) {
      const failedCount = user.failed_login_count + 1;
      const shouldLock = failedCount >= Number(MAX_FAILED_LOGIN_ATTEMPTS);

      await pool.query(
        `UPDATE users SET failed_login_count = $1, locked_until = $2 WHERE id = $3`,
        [
          shouldLock ? 0 : failedCount,
          shouldLock
            ? new Date(Date.now() + Number(LOCKOUT_MINUTES) * 60000).toISOString()
            : null,
          user.id,
        ]
      );

      return genericError();
    }

    // Success — reset failure count
    await pool.query(
      `UPDATE users SET failed_login_count = 0, locked_until = NULL WHERE id = $1`,
      [user.id]
    );

    const token = jwt.sign(
      { sub: user.id, email: user.email, role: user.role, name: user.name },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    setAuthCookie(res, token);

    return res.json({
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  })
);

// --- Logout ---
app.post("/api/auth/logout", (req, res) => {
  res.clearCookie("token", { path: "/" });
  return res.json({ ok: true });
});

// --- Current user ---
app.get(
  "/api/auth/me",
  requireAuth,
  asyncRoute(async (req, res) => {
    const result = await pool.query(
      "SELECT id, email, name, role, is_active FROM users WHERE id = $1",
      [req.user.sub]
    );
    const user = result.rows[0];
    if (!user || !user.is_active) return res.status(401).json({ error: "Not authenticated." });
    return res.json({ id: user.id, email: user.email, name: user.name, role: user.role });
  })
);

// --- Example protected, role-restricted route ---
app.get("/api/auth/admin-only", requireAuth, requireRole("admin", "super_admin"), (req, res) => {
  res.json({ message: "Welcome, admin." });
});

app.get("/api/health", asyncRoute(async (req, res) => {
  await pool.query("SELECT 1");
  res.json({ ok: true, db: "connected" });
}));

app.use((req, res) => res.status(404).json({ error: "Not found." }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({
    error: NODE_ENV === "production" ? "Something went wrong." : err.message,
  });
});

app.listen(PORT, () => {
  console.log(`PPM Chits backend running on port ${PORT}`);
});