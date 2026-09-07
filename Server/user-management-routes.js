/**
 * user-management-routes.js
 * --------------------------
 * User Management CRUD routes for the PPM Chits backend, matching the
 * roles used across the app: super_admin, admin, manager, staff, viewer.
 *
 * Permission model (mirrors the frontend's UserManagement.jsx):
 *   - GET    /api/users            -> any authenticated user (read-only for all)
 *   - POST   /api/users            -> super_admin only (add)
 *   - PUT    /api/users/:id        -> super_admin, admin (edit)
 *   - PATCH  /api/users/:id/lock   -> super_admin, admin (lock/unlock)
 *   - DELETE /api/users/:id        -> super_admin only (delete)
 *
 * This file exports a function so it can plug into the existing
 * server.js without duplicating `pool`, `requireAuth`, `asyncRoute`, etc.
 * Usage in server.js:
 *
 *   const buildUserManagementRoutes = require("./user-management-routes");
 *   app.use(
 *     "/api/users",
 *     buildUserManagementRoutes({ pool, requireAuth, requireRole, asyncRoute, bcrypt })
 *   );
 *
 * Place this BEFORE the 404 catch-all in server.js, same as the
 * Party Master routes.
 */

const express = require("express");
const { requireScreenPermission } = require("./permissions");

const ROLES = ["super_admin", "admin", "manager", "staff", "viewer"];
const ALL_COMPANIES = ["Company 1", "Company 2", "Company 3"]; // keep in sync with the frontend Sidebar

function isValidRole(role) {
  return ROLES.includes(role);
}

function isValidEmail(email) {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

module.exports = function buildUserManagementRoutes({ pool, requireAuth, asyncRoute, bcrypt }) {
  const router = express.Router();

  /* ------------------------------------------------------------ */
  /* GET /api/users — list all users                                */
  /* Any authenticated user can view (viewer role is read-only).    */
  /* ------------------------------------------------------------ */
  router.get(
    "/",
    requireAuth,
    asyncRoute(async (req, res) => {
      const result = await pool.query(
        `SELECT id, email, name, role, is_active, failed_login_count,
                locked_until, created_at, companies, screen_overrides
         FROM users
         ORDER BY created_at DESC`
      );
      res.json(result.rows);
    })
  );

  /* ------------------------------------------------------------ */
  /* POST /api/users — create a new user. Requires canAdd on the    */
  /* "user_management" screen (super_admin by default).              */
  /* ------------------------------------------------------------ */
  router.post(
    "/",
    requireAuth,
    requireScreenPermission("user_management", "canAdd"),
    asyncRoute(async (req, res) => {
      const { name, email, role, is_active, password, companies, screen_overrides } = req.body || {};

      if (!name || !name.trim()) {
        return res.status(400).json({ error: "Name is required." });
      }
      if (!isValidEmail(email)) {
        return res.status(400).json({ error: "Please enter a valid email address." });
      }
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
      const finalCompanies = role === "super_admin" ? ALL_COMPANIES : Array.isArray(companies) ? companies : [];

      if (role !== "super_admin" && finalCompanies.length === 0) {
        return res.status(400).json({ error: "Select at least one company this user can access." });
      }

      const result = await pool.query(
        `INSERT INTO users (email, password_hash, name, role, is_active, companies, screen_overrides)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, email, name, role, is_active, failed_login_count, locked_until, created_at, companies, screen_overrides`,
        [email.trim().toLowerCase(), passwordHash, name.trim(), role, is_active !== false, finalCompanies, screen_overrides || {}]
      );

      res.status(201).json(result.rows[0]);
    })
  );

  /* ------------------------------------------------------------ */
  /* PUT /api/users/:id — edit an existing user.                    */
  /* Requires canEdit on "user_management" (super_admin, admin by    */
  /* default). Email is not editable (matches frontend).             */
  /* ------------------------------------------------------------ */
  router.put(
    "/:id",
    requireAuth,
    requireScreenPermission("user_management", "canEdit"),
    asyncRoute(async (req, res) => {
      const { id } = req.params;
      const { name, role, is_active, password, companies, screen_overrides } = req.body || {};

      if (!name || !name.trim()) {
        return res.status(400).json({ error: "Name is required." });
      }
      if (role && !isValidRole(role)) {
        return res.status(400).json({ error: `Role must be one of: ${ROLES.join(", ")}` });
      }

      const finalCompanies = role === "super_admin" ? ALL_COMPANIES : Array.isArray(companies) ? companies : [];
      if (role && role !== "super_admin" && finalCompanies.length === 0) {
        return res.status(400).json({ error: "Select at least one company this user can access." });
      }

      let passwordHash = null;
      if (password) {
        if (password.length < 10) {
          return res.status(400).json({ error: "Password must be at least 10 characters." });
        }
        passwordHash = await bcrypt.hash(password, 12);
      }

      const result = await pool.query(
        `UPDATE users
         SET name = $1,
             role = COALESCE($2, role),
             is_active = $3,
             companies = COALESCE($4, companies),
             password_hash = COALESCE($5, password_hash),
             screen_overrides = COALESCE($6, screen_overrides),
             updated_at = now()
         WHERE id = $7
         RETURNING id, email, name, role, is_active, failed_login_count, locked_until, created_at, companies, screen_overrides`,
        [name.trim(), role || null, is_active !== false, role ? finalCompanies : null, passwordHash, screen_overrides || null, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "User not found." });
      }

      res.json(result.rows[0]);
    })
  );

  /* ------------------------------------------------------------ */
  /* PATCH /api/users/:id/lock — lock or unlock an account.         */
  /* Requires canEdit on "user_management".                          */
  /* ------------------------------------------------------------ */
  router.patch(
    "/:id/lock",
    requireAuth,
    requireScreenPermission("user_management", "canEdit"),
    asyncRoute(async (req, res) => {
      const { id } = req.params;
      const { locked } = req.body || {};

      // Lock indefinitely (1 year out) when locking manually; clear + reset
      // the failed-login counter when unlocking. Adjust to your own policy.
      const lockedUntil = locked ? new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toISOString() : null;

      const result = await pool.query(
        `UPDATE users
         SET locked_until = $1,
             failed_login_count = CASE WHEN $1 IS NULL THEN 0 ELSE failed_login_count END
         WHERE id = $2
         RETURNING id, email, name, role, is_active, failed_login_count, locked_until, created_at, companies, screen_overrides`,
        [lockedUntil, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "User not found." });
      }

      res.json(result.rows[0]);
    })
  );

  /* ------------------------------------------------------------ */
  /* DELETE /api/users/:id — Requires canDelete on "user_management" */
  /* (super_admin by default). Prevents deleting your own account.  */
  /* ------------------------------------------------------------ */
  router.delete(
    "/:id",
    requireAuth,
    requireScreenPermission("user_management", "canDelete"),
    asyncRoute(async (req, res) => {
      const { id } = req.params;

      if (String(req.user.sub) === String(id)) {
        return res.status(400).json({ error: "You cannot delete your own account." });
      }

      const result = await pool.query("DELETE FROM users WHERE id = $1 RETURNING id", [id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "User not found." });
      }

      res.status(204).end();
    })
  );

  return router;
};