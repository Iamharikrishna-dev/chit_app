/**
 * PPM Chits — Simple Secure Backend (PostgreSQL)
 * -----------------------------------------------
 * Complete production-ready backend with:
 * - Auth (register, login, logout, me)
 * - Party Master (CRUD parties + members)
 * - User Management (CRUD users, lock/unlock, roles)
 * - Security: bcrypt, JWT, rate limiting, account lockout, parameterized SQL
 *
 * Run once: npm run init-db
 * Then: npm start
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

const pool = new Pool({ connectionString: DATABASE_URL });

const ROLES = ["super_admin", "admin", "manager", "staff", "viewer"];
const ALL_COMPANIES = ["Company 1", "Company 2", "Company 3"];

function getPermissions(role) {
  return {
    canAdd: role === "super_admin",
    canEdit: role === "super_admin" || role === "admin",
    canDelete: role === "super_admin",
    canLock: role === "super_admin" || role === "admin",
  };
}

/* ============================================================
   APP SETUP
============================================================ */
const app = express();
app.set("trust proxy", 1);

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
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

function clearAuthCookie(res) {
  res.clearCookie("token", {
    httpOnly: true,
    secure: COOKIE_SECURE === "true",
    sameSite: "strict",
    domain: COOKIE_DOMAIN || undefined,
    path: "/",
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

function requirePermission(permissionKey) {
  return (req, res, next) => {
    const permissions = getPermissions(req.user?.role);
    if (!permissions[permissionKey]) {
      return res.status(403).json({
        error: `Your role ("${req.user?.role}") is not allowed to perform this action.`,
      });
    }
    req.permissions = permissions;
    next();
  };
}

function isValidEmail(email) {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidRole(role) {
  return ROLES.includes(role);
}

function asyncRoute(fn) {
  return (req, res, next) => fn(req, res, next).catch(next);
}

function safeCompaniesFor(role, requested) {
  if (role === "super_admin") return ALL_COMPANIES;
  return Array.isArray(requested) ? requested.filter((c) => ALL_COMPANIES.includes(c)) : [];
}

function parseJsonbField(field) {
  if (typeof field === 'string') {
    try {
      return JSON.parse(field);
    } catch {
      return field;
    }
  }
  return field || null;
}

/* ============================================================
   AUTH ROUTES
============================================================ */

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
    const safeRole = (role === "admin" || role === "super_admin") ? role : "staff";
    const companiesToSave = safeRole === "super_admin" ? ALL_COMPANIES : [];

    const result = await pool.query(
      `INSERT INTO users (email, password_hash, name, role, companies)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, name, role, companies`,
      [email, passwordHash, name.trim(), safeRole, JSON.stringify(companiesToSave)]
    );

    return res.status(201).json(result.rows[0]);
  })
);

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

    await pool.query(
      `UPDATE users SET failed_login_count = 0, locked_until = NULL WHERE id = $1`,
      [user.id]
    );

    const token = jwt.sign(
      { sub: user.id, email: user.email, role: user.role, name: user.name },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    const companies = parseJsonbField(user.companies) || [];
    const screenOverrides = parseJsonbField(user.screen_overrides) || {};

    setAuthCookie(res, token);

    return res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        companies,
        screen_overrides: screenOverrides,
      },
    });
  })
);

app.post("/api/auth/logout", (req, res) => {
  clearAuthCookie(res);
  return res.json({ ok: true });
});

app.get(
  "/api/auth/me",
  requireAuth,
  asyncRoute(async (req, res) => {
    const result = await pool.query(
      "SELECT id, email, name, role, is_active, companies, screen_overrides FROM users WHERE id = $1",
      [req.user.sub]
    );
    const user = result.rows[0];
    if (!user || !user.is_active) return res.status(401).json({ error: "Not authenticated." });

    const companies = parseJsonbField(user.companies) || [];
    const screenOverrides = parseJsonbField(user.screen_overrides) || {};

    return res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      companies,
      screen_overrides: screenOverrides,
    });
  })
);

app.get("/api/auth/admin-only", requireAuth, requireRole("admin", "super_admin"), (req, res) => {
  res.json({ message: "Welcome, admin." });
});

/* ============================================================
   PARTY MASTER ROUTES
============================================================ */

async function fetchAllParties() {
  const partiesResult = await pool.query("SELECT * FROM parties ORDER BY id ASC");
  const membersResult = await pool.query("SELECT * FROM party_members ORDER BY id ASC");

  const membersByParty = {};
  membersResult.rows.forEach((m) => {
    if (!membersByParty[m.party_id]) membersByParty[m.party_id] = [];
    membersByParty[m.party_id].push({
      name: m.name,
      role: m.role,
      phone: m.phone,
      chitShare: Number(m.chit_share) || 0,
    });
  });

  return partiesResult.rows.map((p) => ({
    id: p.id,
    name: p.name,
    relation: p.relation,
    address: p.address,
    city: p.city,
    phone: p.phone,
    chitValue: Number(p.chit_value),
    status: p.status,
    members: membersByParty[p.id] || [
      { name: p.name, role: "Primary Subscriber", phone: p.phone, chitShare: Number(p.chit_value) || 0 },
    ],
  }));
}

app.get(
  "/api/parties",
  requireAuth,
  asyncRoute(async (req, res) => {
    const parties = await fetchAllParties();
    res.json(parties);
  })
);

app.post(
  "/api/parties",
  requireAuth,
  asyncRoute(async (req, res) => {
    const { name, relation, address, city, phone, chitValue, status, members } = req.body || {};

    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Name is required." });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const partyResult = await client.query(
        `INSERT INTO parties (name, relation, address, city, phone, chit_value, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [name.trim(), relation || null, address || null, city || null, phone || null, Number(chitValue) || 0, status || "Active"]
      );
      const partyId = partyResult.rows[0].id;

      const memberList =
        Array.isArray(members) && members.length
          ? members
          : [{ name, role: "Primary Subscriber", phone, chitShare: Number(chitValue) || 0 }];

      for (const m of memberList) {
        if (!m.name || !m.name.trim()) continue;
        await client.query(
          `INSERT INTO party_members (party_id, name, role, phone, chit_share)
           VALUES ($1, $2, $3, $4, $5)`,
          [partyId, m.name.trim(), m.role || null, m.phone || null, Number(m.chitShare) || 0]
        );
      }

      await client.query("COMMIT");
      res.status(201).json({ id: partyId });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  })
);

app.put(
  "/api/parties/:id",
  requireAuth,
  asyncRoute(async (req, res) => {
    const { id } = req.params;
    const { name, relation, address, city, phone, chitValue, status, members } = req.body || {};

    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Name is required." });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const updateResult = await client.query(
        `UPDATE parties
         SET name = $1, relation = $2, address = $3, city = $4, phone = $5,
             chit_value = $6, status = $7, updated_at = now()
         WHERE id = $8
         RETURNING id`,
        [name.trim(), relation || null, address || null, city || null, phone || null, Number(chitValue) || 0, status || "Active", id]
      );

      if (updateResult.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Party not found." });
      }

      await client.query("DELETE FROM party_members WHERE party_id = $1", [id]);

      const memberList =
        Array.isArray(members) && members.length
          ? members
          : [{ name, role: "Primary Subscriber", phone, chitShare: Number(chitValue) || 0 }];

      for (const m of memberList) {
        if (!m.name || !m.name.trim()) continue;
        await client.query(
          `INSERT INTO party_members (party_id, name, role, phone, chit_share)
           VALUES ($1, $2, $3, $4, $5)`,
          [id, m.name.trim(), m.role || null, m.phone || null, Number(m.chitShare) || 0]
        );
      }

      await client.query("COMMIT");
      res.json({ ok: true });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  })
);

app.delete(
  "/api/parties/:id",
  requireAuth,
  asyncRoute(async (req, res) => {
    const { id } = req.params;
    const result = await pool.query("DELETE FROM parties WHERE id = $1 RETURNING id", [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Party not found." });
    }
    res.json({ ok: true });
  })
);

/* ============================================================
   USER MANAGEMENT ROUTES
============================================================ */

app.get(
  "/api/users",
  requireAuth,
  asyncRoute(async (req, res) => {
    const result = await pool.query(
      `SELECT id, email, name, role, is_active, failed_login_count, locked_until,
              created_at, companies
       FROM users
       ORDER BY created_at DESC`
    );
    res.json(result.rows);
  })
);

app.post(
  "/api/users",
  requireAuth,
  requirePermission("canAdd"),
  asyncRoute(async (req, res) => {
    const { name, email, role, is_active, password, companies } = req.body || {};

    if (!name || !name.trim()) return res.status(400).json({ error: "Name is required." });
    if (!isValidEmail(email)) return res.status(400).json({ error: "A valid email is required." });
    if (!isValidRole(role)) {
      return res.status(400).json({ error: `Role must be one of: ${ROLES.join(", ")}` });
    }
    if (!password || password.length < 10) {
      return res.status(400).json({ error: "Password must be at least 10 characters." });
    }

    const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: "Unable to create account with these details." });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const companiesToSave = safeCompaniesFor(role, companies);

    const result = await pool.query(
      `INSERT INTO users (email, password_hash, name, role, is_active, companies)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, email, name, role, is_active, failed_login_count, locked_until, created_at, companies`,
      [email.trim().toLowerCase(), passwordHash, name.trim(), role, is_active !== false, JSON.stringify(companiesToSave)]
    );

    res.status(201).json(result.rows[0]);
  })
);

app.put(
  "/api/users/:id",
  requireAuth,
  requirePermission("canEdit"),
  asyncRoute(async (req, res) => {
    const { id } = req.params;
    const { name, role, is_active, password, companies } = req.body || {};

    if (!name || !name.trim()) return res.status(400).json({ error: "Name is required." });
    if (role && !isValidRole(role)) {
      return res.status(400).json({ error: `Role must be one of: ${ROLES.join(", ")}` });
    }

    const existing = await pool.query("SELECT * FROM users WHERE id = $1", [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: "User not found." });
    }

    const finalRole = role || existing.rows[0].role;
    const existingCompanies = parseJsonbField(existing.rows[0].companies) || [];
    const companiesToSave = safeCompaniesFor(finalRole, companies ?? existingCompanies);

    let passwordHash = existing.rows[0].password_hash;
    if (password) {
      if (password.length < 10) {
        return res.status(400).json({ error: "Password must be at least 10 characters." });
      }
      passwordHash = await bcrypt.hash(password, 12);
    }

    const result = await pool.query(
      `UPDATE users
       SET name = $1, role = $2, is_active = $3, password_hash = $4, companies = $5
       WHERE id = $6
       RETURNING id, email, name, role, is_active, failed_login_count, locked_until, created_at, companies`,
      [name.trim(), finalRole, is_active !== false, passwordHash, JSON.stringify(companiesToSave), id]
    );

    res.json(result.rows[0]);
  })
);

app.patch(
  "/api/users/:id/lock",
  requireAuth,
  requirePermission("canLock"),
  asyncRoute(async (req, res) => {
    const { id } = req.params;
    const { locked } = req.body || {};

    const lockedUntil = locked
      ? new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toISOString()
      : null;

    const result = await pool.query(
      `UPDATE users
       SET locked_until = $1, failed_login_count = CASE WHEN $2 THEN failed_login_count ELSE 0 END
       WHERE id = $3
       RETURNING id, email, name, role, is_active, failed_login_count, locked_until, created_at, companies`,
      [lockedUntil, !!locked, id]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: "User not found." });
    res.json(result.rows[0]);
  })
);

app.delete(
  "/api/users/:id",
  requireAuth,
  requirePermission("canDelete"),
  asyncRoute(async (req, res) => {
    const { id } = req.params;

    if (String(req.user.sub) === String(id)) {
      return res.status(400).json({ error: "You cannot delete your own account." });
    }

    const result = await pool.query("DELETE FROM users WHERE id = $1 RETURNING id", [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: "User not found." });
    res.json({ ok: true });
  })
);

/* ============================================================
   HEALTH CHECK
============================================================ */

app.get("/api/health", asyncRoute(async (req, res) => {
  await pool.query("SELECT 1");
  res.json({ ok: true, db: "connected" });
}));

/* ============================================================
   ERROR HANDLING
============================================================ */

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