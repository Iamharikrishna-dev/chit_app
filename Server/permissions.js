/**
 * permissions.js
 * ---------------
 * Central permission model for the whole app — not just User Management.
 *
 * Two layers:
 *  1. Role defaults — what a role can do on any screen by default.
 *  2. Per-user screen overrides — lets one specific user be granted more
 *     than their role normally allows, but ONLY on a named screen (e.g.
 *     a "viewer" who should be able to edit Party Master specifically).
 *
 * Overrides can only ever GRANT permissions, never revoke ones a role
 * already has. This keeps the model predictable — an admin's edit rights
 * can't accidentally be stripped by a stray override.
 */

const ROLES = ["super_admin", "admin", "manager", "staff", "viewer"];

// Screens that have edit/delete actions gated by this permission model.
// Add new keys here as new screens get CRUD routes.
const SCREENS = ["party_master", "chit_groups", "collections", "payments", "user_management"];

/**
 * Role defaults. Same shape for every screen currently (uniform edit/delete
 * rules), but kept per-role rather than global so you can special-case a
 * role's default per screen later if needed (e.g. "manager can edit
 * Collections but not Party Master" would just mean returning different
 * defaults per screen inside this function).
 */
function roleDefaults(role) {
  switch (role) {
    case "super_admin":
      return { canView: true, canAdd: true, canEdit: true, canDelete: true };
    case "admin":
      return { canView: true, canAdd: false, canEdit: true, canDelete: false };
    case "manager":
    case "staff":
      return { canView: true, canAdd: false, canEdit: false, canDelete: false };
    case "viewer":
    default:
      return { canView: true, canAdd: false, canEdit: false, canDelete: false };
  }
}

/**
 * Resolves the effective permissions for a given user on a given screen,
 * applying any per-user override on top of their role's default.
 *
 * @param {{ role: string, screen_overrides?: object }} user
 * @param {string} screen — one of SCREENS
 */
function getScreenPermissions(user, screen) {
  const base = roleDefaults(user?.role);
  const override = user?.screen_overrides?.[screen] || {};

  // Overrides can only turn a `false` into `true` — never the reverse.
  return {
    canView: base.canView || !!override.canView,
    canAdd: base.canAdd || !!override.canAdd,
    canEdit: base.canEdit || !!override.canEdit,
    canDelete: base.canDelete || !!override.canDelete,
  };
}

/**
 * Express middleware factory: blocks the request unless the user's
 * effective permission for `permissionKey` on `screen` is true.
 *
 * Usage:
 *   app.put("/api/parties/:id", requireAuth, requireScreenPermission("party_master", "canEdit"), ...)
 *
 * Requires `req.user` to already be populated by requireAuth, AND that
 * `req.user` includes the user's `screen_overrides` (see note below on
 * how to attach it, since the JWT payload is small and may not carry it).
 */
function requireScreenPermission(screen, permissionKey) {
  return async (req, res, next) => {
    // screen_overrides isn't stored in the JWT (kept small/stable), so it's
    // fetched fresh here. Pass your `pool` in via req.app.locals.pool, or
    // adapt this line to however your app exposes the db connection.
    try {
      const pool = req.app.locals.pool;
      const result = await pool.query(
        "SELECT role, screen_overrides FROM users WHERE id = $1",
        [req.user.sub]
      );
      const dbUser = result.rows[0];
      if (!dbUser) return res.status(401).json({ error: "Not authenticated." });

      const permissions = getScreenPermissions(dbUser, screen);
      if (!permissions[permissionKey]) {
        return res.status(403).json({
          error: `Your role ("${dbUser.role}") is not allowed to perform this action on ${screen}.`,
        });
      }

      req.screenPermissions = permissions;
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = {
  ROLES,
  SCREENS,
  roleDefaults,
  getScreenPermissions,
  requireScreenPermission,
};