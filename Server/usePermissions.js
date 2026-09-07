/**
 * usePermissions.js
 * ------------------
 * Frontend mirror of the backend's permissions.js. Same role defaults,
 * same per-user screen_overrides. Use this in ANY screen (Party Master,
 * Chit Groups, Collections, etc.) to decide whether to show Edit/Delete/Add
 * buttons — not just User Management.
 *
 * Usage in a screen component:
 *
 *   import { getScreenPermissions } from "../hooks/usePermissions";
 *
 *   const permissions = getScreenPermissions(user, "party_master");
 *   {permissions.canEdit && <EditButton />}
 *   {permissions.canDelete && <DeleteButton />}
 *
 * `user` should be whatever your app already has in context/props after
 * login (from /api/auth/me), and MUST include `role` and `screen_overrides`
 * for this to work — see the note at the bottom of this file.
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
 * @param {{ role: string, screen_overrides?: object }} user
 * @param {string} screen — e.g. "party_master", "chit_groups", "user_management"
 */
export function getScreenPermissions(user, screen) {
  const base = roleDefaults(user?.role);
  const override = user?.screen_overrides?.[screen] || {};

  // Overrides can only grant (true), never take away what the role already has.
  return {
    canView: base.canView || !!override.canView,
    canAdd: base.canAdd || !!override.canAdd,
    canEdit: base.canEdit || !!override.canEdit,
    canDelete: base.canDelete || !!override.canDelete,
  };
}

/**
 * NOTE — you must include `screen_overrides` in whatever your
 * /api/auth/me and /api/auth/login responses return, the same way
 * `companies` was added earlier. In server.js:
 *
 *   SELECT id, email, name, role, is_active, companies, screen_overrides
 *   FROM users WHERE id = $1
 *
 * ...and include `screen_overrides: user.screen_overrides` in both the
 * login and /me JSON responses. Without that, every screen's
 * getScreenPermissions() call will just fall back to plain role defaults
 * (which is still safe — it just means overrides won't take effect on
 * the frontend until this is wired up).
 */