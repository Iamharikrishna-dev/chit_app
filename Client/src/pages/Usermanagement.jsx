import React, { useState, useMemo, useCallback, useRef } from "react";
import { AgGridReact } from "ag-grid-react";
import { AllCommunityModule, ModuleRegistry, ValidationModule } from "ag-grid-community";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  X,
  Search,
  Plus,
  Download,
  FileSpreadsheet,
  FileText,
  UserCircle,
  Pencil,
  Trash2,
  AlertTriangle,
  ShieldCheck,
  Lock,
  Unlock,
  KeyRound,
} from "lucide-react";

// AG Grid v36 requires explicit module registration. AllCommunityModule
// covers pagination, quick filter, and all community column filters
// (text/number). Note: agSetColumnFilter is an ENTERPRISE-only filter —
// we use agTextColumnFilter for Role/Status below since this app only
// registers Community modules.
ModuleRegistry.registerModules([AllCommunityModule, ValidationModule]);

const BLUE = "#1D4ED8";
const YELLOW = "#FBBF24";
const BORDER = "#E5E7EB";
const BG = "#F5F8FC";

const API_BASE_URL = import.meta.env?.VITE_API_BASE_URL || "/api";

const ROLES = ["super_admin", "admin", "manager", "staff", "viewer"];

// Companies a user can be granted access to. Keep in sync with the
// Sidebar's company switcher list.
const COMPANIES = ["Company 1", "Company 2", "Company 3"];

// Screens that support per-user permission overrides (e.g. letting one
// specific "viewer" edit Party Master only, without changing their role).
// Keep this list in sync with SCREENS in the backend's permissions.js.
const SCREENS = [
  { key: "party_master", label: "Party Master" },
  { key: "chit_groups", label: "Chit Groups" },
  { key: "collections", label: "Collections" },
  { key: "payments", label: "Payments" },
  { key: "user_management", label: "User Management" },
];


/**
 * Permission model for the User Management screen, based on the
 * logged-in user's own role, plus any per-user override granted to them
 * specifically for the "user_management" screen (set by a super_admin in
 * this same screen — see the "Extra Permissions" section in the modal).
 *  - super_admin: full control — add, edit, delete users
 *  - admin:       can edit existing users, cannot add or delete
 *  - everyone else (manager/staff/viewer): read-only, unless granted an
 *    explicit "user_management" override
 */
function getPermissions(currentUserRole, currentUserScreenOverrides) {
  const role = currentUserRole || "viewer";
  const override = currentUserScreenOverrides?.user_management || {};
  return {
    canAdd: role === "super_admin",
    canEdit: role === "super_admin" || role === "admin" || !!override.canEdit,
    canDelete: role === "super_admin",
    canLock: role === "super_admin" || role === "admin" || !!override.canEdit,
  };
}

/* ============================================================
   AG Grid theme override — matches PPM Chits navy/blue/yellow
   (identical to PartyMaster so both screens feel consistent)
============================================================ */
const gridThemeStyles = `
.ppm-grid.ag-theme-quartz {
  --ag-font-family: Inter, sans-serif;
  --ag-font-size: 13.5px;
  --ag-header-background-color: ${BLUE};
  --ag-header-foreground-color: #ffffff;
  --ag-header-column-separator-color: rgba(255,255,255,0.18);
  --ag-header-height: 46px;
  --ag-borders: solid 1px;
  --ag-border-color: ${BORDER};
  --ag-row-hover-color: #EFF6FF;
  --ag-selected-row-background-color: #DBEAFE;
  --ag-odd-row-background-color: #F9FAFB;
  --ag-cell-horizontal-padding: 16px;
  --ag-row-height: 52px;
  --ag-checkbox-checked-color: ${BLUE};
  border-radius: 10px;
  overflow: hidden;
}
.ppm-grid .ag-header-cell-label {
  font-weight: 600;
  letter-spacing: 0.3px;
  text-transform: uppercase;
  font-size: 11.5px;
}
.ppm-grid .ag-header {
  border-bottom: 4px solid ${YELLOW};
}
.ppm-grid .ag-floating-filter-input input {
  border-radius: 6px;
  font-size: 12.5px;
}
.ppm-grid .ag-pinned-right-cols-container,
.ppm-grid .ag-pinned-right-header {
  border-left: 1px solid ${BORDER};
}
`;

function StatusPill({ active, locked }) {
  if (locked) {
    return (
      <span
        style={{
          background: "#FEE2E2",
          color: "#B91C1C",
          padding: "3px 10px",
          borderRadius: 12,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.4px",
          textTransform: "uppercase",
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
        }}
      >
        <Lock size={11} /> Locked
      </span>
    );
  }
  const styles = active
    ? { bg: "#DCFCE7", color: "#15803D" }
    : { bg: "#F3F4F6", color: "#6B7280" };
  return (
    <span
      style={{
        background: styles.bg,
        color: styles.color,
        padding: "3px 10px",
        borderRadius: 12,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.4px",
        textTransform: "uppercase",
      }}
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function RolePill({ role }) {
  const styles = {
    admin: { bg: "#EDE9FE", color: "#6D28D9" },
    manager: { bg: "#DBEAFE", color: "#1D4ED8" },
    staff: { bg: "#FEF3C7", color: "#A16207" },
    viewer: { bg: "#F3F4F6", color: "#4B5563" },
  }[role] || { bg: "#F3F4F6", color: "#4B5563" };
  return (
    <span
      style={{
        background: styles.bg,
        color: styles.color,
        padding: "3px 10px",
        borderRadius: 12,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.4px",
        textTransform: "capitalize",
      }}
    >
      {role}
    </span>
  );
}

function NameCellRenderer(props) {
  const { data } = props;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, height: "100%" }}>
      <div
        style={{
          width: 30,
          height: 30,
          borderRadius: "50%",
          background: "#EFF6FF",
          color: BLUE,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <UserCircle size={20} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {data.name}
        </div>
        <div style={{ fontSize: 11, color: "#9CA3AF", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {data.email}
        </div>
      </div>
    </div>
  );
}

function RoleCellRenderer(props) {
  return <RolePill role={props.value} />;
}

function StatusCellRenderer(props) {
  const { data } = props;
  const locked = data.locked_until && new Date(data.locked_until) > new Date();
  return <StatusPill active={data.is_active} locked={locked} />;
}

function FailedLoginsCellRenderer(props) {
  const value = Number(props.value) || 0;
  return (
    <span
      style={{
        fontWeight: 600,
        color: value >= 5 ? "#B91C1C" : value > 0 ? "#A16207" : "#9CA3AF",
      }}
    >
      {value}
    </span>
  );
}

function DateCellRenderer(props) {
  if (!props.value) return <span style={{ color: "#D1D5DB" }}>—</span>;
  const d = new Date(props.value);
  if (Number.isNaN(d.getTime())) return <span style={{ color: "#D1D5DB" }}>—</span>;
  return (
    <span style={{ fontSize: 12.5 }}>
      {d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
    </span>
  );
}

function ActionsCellRenderer(props) {
  const { openEdit, setDeletingRow, toggleLock, permissions } = props.context;
  const { data } = props;
  const locked = data.locked_until && new Date(data.locked_until) > new Date();

  if (!permissions.canEdit && !permissions.canDelete && !permissions.canLock) {
    return <span style={{ fontSize: 11.5, color: "#9CA3AF" }}>View only</span>;
  }

  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center", height: "100%" }}>
      {permissions.canEdit && (
        <button
          onClick={() => openEdit(data)}
          title="Edit"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            background: "#EFF6FF",
            color: BLUE,
            border: "none",
            borderRadius: 8,
            padding: "6px 10px",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          <Pencil size={13} />
        </button>
      )}
      {permissions.canLock && (
        <button
          onClick={() => toggleLock(data)}
          title={locked ? "Unlock account" : "Lock account"}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            background: locked ? "#ECFDF5" : "#FFFBEB",
            color: locked ? "#15803D" : "#A16207",
            border: "none",
            borderRadius: 8,
            padding: "6px 10px",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          {locked ? <Unlock size={13} /> : <Lock size={13} />}
        </button>
      )}
      {permissions.canDelete && (
        <button
          onClick={() => setDeletingRow(data)}
          title="Delete"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            background: "#FEF2F2",
            color: "#B91C1C",
            border: "none",
            borderRadius: 8,
            padding: "6px 10px",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          <Trash2 size={13} />
        </button>
      )}
    </div>
  );
}

function Toast({ message }) {
  if (!message) return null;
  return (
    <div
      style={{
        position: "fixed",
        bottom: 26,
        left: "50%",
        transform: "translateX(-50%)",
        background: BLUE,
        color: "#fff",
        padding: "13px 24px",
        borderRadius: 10,
        fontSize: 13.5,
        fontWeight: 500,
        boxShadow: "0 12px 30px rgba(0,0,0,0.25)",
        borderLeft: `4px solid ${YELLOW}`,
        zIndex: 999,
      }}
    >
      {message}
    </div>
  );
}

const emptyForm = {
  name: "",
  email: "",
  role: "staff",
  is_active: true,
  password: "",
  confirmPassword: "",
  companies: [],
  screen_overrides: {},
};

function NewUserModal({ open, onClose, onSave, editingRow, saving, permissions, isEdit: forceEdit }) {
  const isEdit = !!editingRow;
  // Read-only mode: editor opened just to view a row (admin viewing a row
  // they can't edit, e.g. future-proofing; currently editEnabled gates this).
  const readOnly = isEdit && !permissions.canEdit;
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [showResetPassword, setShowResetPassword] = useState(false);

  React.useEffect(() => {
    if (open) {
      setForm(
        editingRow
          ? {
              name: editingRow.name || "",
              email: editingRow.email || "",
              role: editingRow.role || "staff",
              is_active: editingRow.is_active ?? true,
              password: "",
              confirmPassword: "",
              companies: editingRow.companies || [],
              screen_overrides: editingRow.screen_overrides || {},
            }
          : emptyForm
      );
      setShowResetPassword(false);
      setError("");
    }
  }, [open, editingRow]);

  if (!open) return null;

  const update = (key) => (e) =>
    setForm((f) => ({
      ...f,
      [key]: e.target.type === "checkbox" ? e.target.checked : e.target.value,
    }));

  const toggleCompany = (company) =>
    setForm((f) => ({
      ...f,
      companies: f.companies.includes(company)
        ? f.companies.filter((c) => c !== company)
        : [...f.companies, company],
    }));

  // Toggles a single "canEdit" override for one screen. Overrides only ever
  // grant extra access on top of the role's normal permissions — they never
  // take permissions away from a role that already has them.
  const toggleScreenOverride = (screenKey) =>
    setForm((f) => {
      const current = f.screen_overrides?.[screenKey]?.canEdit || false;
      return {
        ...f,
        screen_overrides: {
          ...f.screen_overrides,
          [screenKey]: { ...f.screen_overrides?.[screenKey], canEdit: !current },
        },
      };
    });

  const buildPayload = () => {
    const payload = {
      name: form.name,
      email: form.email,
      role: form.role,
      is_active: form.is_active,
      // super_admin implicitly has access to every company, so we don't
      // require a selection for that role.
      companies: form.role === "super_admin" ? COMPANIES : form.companies,
      screen_overrides: form.screen_overrides,
    };
    // password_hash is generated server-side — we only ever send a plain
    // "password" field (on create, or on explicit reset) and let the API
    // hash it. Existing hash is never read/edited from the client.
    if (!isEdit || showResetPassword) {
      payload.password = form.password;
    }
    return payload;
  };

  const handleSave = () => {
    if (!form.name.trim()) return setError("Name is required.");
    if (!form.email.trim()) return setError("Email is required.");
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) return setError("Enter a valid email address.");
    if (!isEdit || showResetPassword) {
      if (!form.password || form.password.length < 8) {
        return setError("Password must be at least 8 characters.");
      }
      if (form.password !== form.confirmPassword) {
        return setError("Passwords do not match.");
      }
    }
    if (form.role !== "super_admin" && form.companies.length === 0) {
      return setError("Select at least one company this user can access.");
    }
    setError("");
    onSave(buildPayload());
  };

  const fieldStyle = {
    padding: "10px 12px",
    border: `1.5px solid ${BORDER}`,
    borderRadius: 8,
    fontSize: 14,
    background: "#fff",
    width: "100%",
    fontFamily: "inherit",
    boxSizing: "border-box",
  };

  const labelStyle = {
    fontSize: 12.5,
    fontWeight: 600,
    color: "#374151",
    display: "block",
    marginBottom: 5,
  };

  const sectionLabelStyle = {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.6px",
    textTransform: "uppercase",
    color: "#6B7280",
    marginBottom: 10,
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 14,
          width: "100%",
          maxWidth: 560,
          maxHeight: "90vh",
          boxShadow: "0 25px 60px rgba(0,0,0,0.3)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            background: BLUE,
            color: "#fff",
            padding: "18px 26px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: `4px solid ${YELLOW}`,
            flexShrink: 0,
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>
              {isEdit ? "Edit User" : "Add New User"}
            </h2>
            <div
              style={{
                fontSize: 11,
                letterSpacing: "1.2px",
                textTransform: "uppercase",
                opacity: 0.85,
                marginTop: 3,
              }}
            >
              User Management — Account Access
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,0.15)",
              border: "none",
              borderRadius: 6,
              color: "#fff",
              cursor: "pointer",
              padding: 6,
            }}
          >
            <X size={18} />
          </button>
        </div>

        <div
          style={{
            padding: "24px 26px",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 20,
          }}
        >
          {error && (
            <div
              style={{
                background: "#FEE2E2",
                color: "#B91C1C",
                padding: "10px 14px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              {error}
            </div>
          )}

          <div>
            <div style={sectionLabelStyle}>Account Details</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={labelStyle}>Name</label>
                <input
                  style={fieldStyle}
                  placeholder="Full name"
                  value={form.name}
                  onChange={update("name")}
                  autoFocus
                />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={labelStyle}>Email</label>
                <input
                  style={fieldStyle}
                  placeholder="name@example.com"
                  type="email"
                  value={form.email}
                  onChange={update("email")}
                  disabled={isEdit}
                />
                {isEdit && (
                  <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 4 }}>
                    Email is used as the login ID and can't be changed here.
                  </div>
                )}
              </div>
              <div>
                <label style={labelStyle}>Role</label>
                <select style={fieldStyle} value={form.role} onChange={update("role")}>
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r.charAt(0).toUpperCase() + r.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: "flex", alignItems: "flex-end" }}>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#374151",
                    cursor: "pointer",
                    padding: "10px 0",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={update("is_active")}
                    style={{ width: 16, height: 16 }}
                  />
                  Account is active
                </label>
              </div>
            </div>
          </div>

          <div style={{ borderTop: `1px dashed ${BORDER}`, paddingTop: 18 }}>
            <div style={sectionLabelStyle}>Company Access</div>
            {form.role === "super_admin" ? (
              <p style={{ fontSize: 12, color: "#9CA3AF", margin: 0 }}>
                Super Admins automatically have access to all companies.
              </p>
            ) : (
              <>
                <p style={{ fontSize: 12, color: "#9CA3AF", margin: "0 0 10px" }}>
                  Choose which companies this user is allowed to switch into.
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {COMPANIES.map((company) => {
                    const checked = form.companies.includes(company);
                    return (
                      <label
                        key={company}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 7,
                          padding: "8px 14px",
                          borderRadius: 8,
                          border: `1.5px solid ${checked ? BLUE : BORDER}`,
                          background: checked ? "#EFF6FF" : "#fff",
                          color: checked ? BLUE : "#374151",
                          fontSize: 12.5,
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleCompany(company)}
                          style={{ width: 14, height: 14 }}
                        />
                        {company}
                      </label>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {form.role !== "super_admin" && form.role !== "admin" && (
            <div style={{ borderTop: `1px dashed ${BORDER}`, paddingTop: 18 }}>
              <div style={sectionLabelStyle}>Extra Permissions (optional)</div>
              <p style={{ fontSize: 12, color: "#9CA3AF", margin: "0 0 10px" }}>
                By default, this role ("{form.role}") is read-only everywhere. Grant edit
                access to individual screens for this user only — their role stays
                unchanged.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {SCREENS.map(({ key, label }) => {
                  const checked = !!form.screen_overrides?.[key]?.canEdit;
                  return (
                    <label
                      key={key}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "9px 14px",
                        borderRadius: 8,
                        border: `1.5px solid ${checked ? BLUE : BORDER}`,
                        background: checked ? "#EFF6FF" : "#F9FAFB",
                        cursor: "pointer",
                      }}
                    >
                      <span style={{ fontSize: 13, fontWeight: 600, color: checked ? BLUE : "#374151" }}>
                        {label}
                      </span>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 11.5, color: "#9CA3AF" }}>Can edit</span>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleScreenOverride(key)}
                          style={{ width: 15, height: 15 }}
                        />
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          <div style={{ borderTop: `1px dashed ${BORDER}`, paddingTop: 18 }}>
            {isEdit ? (
              <>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: showResetPassword ? 14 : 0,
                  }}
                >
                  <div style={{ ...sectionLabelStyle, marginBottom: 0 }}>Password</div>
                  <button
                    onClick={() => setShowResetPassword((v) => !v)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      background: "#FFFBEB",
                      color: "#A16207",
                      border: `1.5px solid #FDE68A`,
                      borderRadius: 8,
                      padding: "6px 12px",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    <KeyRound size={13} />
                    {showResetPassword ? "Cancel reset" : "Reset password"}
                  </button>
                </div>
                {!showResetPassword && (
                  <p style={{ fontSize: 12, color: "#9CA3AF", margin: "8px 0 0" }}>
                    Password is securely hashed and never shown. Use "Reset password" to set a
                    new one.
                  </p>
                )}
              </>
            ) : (
              <div style={sectionLabelStyle}>Set Password</div>
            )}

            {(!isEdit || showResetPassword) && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: isEdit ? 0 : 10 }}>
                <div>
                  <label style={labelStyle}>{isEdit ? "New Password" : "Password"}</label>
                  <input
                    style={fieldStyle}
                    placeholder="Min. 8 characters"
                    type="password"
                    value={form.password}
                    onChange={update("password")}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Confirm Password</label>
                  <input
                    style={fieldStyle}
                    placeholder="Re-enter password"
                    type="password"
                    value={form.confirmPassword}
                    onChange={update("confirmPassword")}
                  />
                </div>
              </div>
            )}
          </div>

          {isEdit && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 16,
                background: "#F9FAFB",
                border: `1px solid ${BORDER}`,
                borderRadius: 8,
                padding: "12px 16px",
                fontSize: 12.5,
                color: "#6B7280",
              }}
            >
              <div>
                Failed logins:{" "}
                <b style={{ color: "#111827" }}>{editingRow.failed_login_count || 0}</b>
              </div>
              <div>
                Locked until:{" "}
                <b style={{ color: "#111827" }}>
                  {editingRow.locked_until
                    ? new Date(editingRow.locked_until).toLocaleString("en-IN")
                    : "—"}
                </b>
              </div>
              <div>
                Created:{" "}
                <b style={{ color: "#111827" }}>
                  {editingRow.created_at
                    ? new Date(editingRow.created_at).toLocaleDateString("en-IN")
                    : "—"}
                </b>
              </div>
            </div>
          )}
        </div>

        <div
          style={{
            display: "flex",
            gap: 12,
            padding: "16px 26px 22px",
            borderTop: `1px solid ${BORDER}`,
            flexShrink: 0,
            flexWrap: "wrap",
          }}
        >
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              background: BLUE,
              color: "#fff",
              border: "none",
              padding: "11px 24px",
              borderRadius: 8,
              fontWeight: 600,
              fontSize: 13.5,
              cursor: saving ? "not-allowed" : "pointer",
              opacity: saving ? 0.7 : 1,
              boxShadow: "0 6px 14px rgba(29,78,216,0.3)",
            }}
          >
            {saving ? "Saving..." : isEdit ? "Update User" : "Create User"}
          </button>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              color: "#6B7280",
              border: `1.5px solid ${BORDER}`,
              padding: "11px 24px",
              borderRadius: 8,
              fontWeight: 600,
              fontSize: 13.5,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmDeleteModal({ row, onConfirm, onCancel }) {
  if (!row) return null;
  return (
    <div
      onClick={onCancel}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 14,
          width: "100%",
          maxWidth: 400,
          boxShadow: "0 25px 60px rgba(0,0,0,0.3)",
          padding: 26,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <div
            style={{
              background: "#FEE2E2",
              color: "#B91C1C",
              borderRadius: "50%",
              width: 40,
              height: 40,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <AlertTriangle size={20} />
          </div>
          <h3 style={{ margin: 0, fontSize: 16.5, color: "#111827" }}>Delete this user?</h3>
        </div>
        <p style={{ fontSize: 13.5, color: "#6B7280", margin: "0 0 20px" }}>
          This will permanently remove{" "}
          <b style={{ color: "#111827" }}>{row.name}</b> ({row.email}) and revoke their
          access. This action cannot be undone.
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            onClick={onCancel}
            style={{
              background: "#F3F4F6",
              color: "#111827",
              border: "none",
              padding: "9px 18px",
              borderRadius: 8,
              fontWeight: 600,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              background: "#B91C1C",
              color: "#fff",
              border: "none",
              padding: "9px 18px",
              borderRadius: 8,
              fontWeight: 600,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

const pillBtn = (bg, color) => ({
  background: bg,
  color,
  border: "none",
  padding: "9px 16px",
  borderRadius: 20,
  fontSize: 12.5,
  fontWeight: 600,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
});

function fmtDate(v) {
  if (!v) return "";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-IN");
}

export default function UserManagement({ currentUserRole = "super_admin", currentUserScreenOverrides }) {
  const permissions = useMemo(
    () => getPermissions(currentUserRole, currentUserScreenOverrides),
    [currentUserRole, currentUserScreenOverrides]
  );
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [deletingRow, setDeletingRow] = useState(null);
  const [toastMsg, setToastMsg] = useState("");
  const [quickFilter, setQuickFilter] = useState("");
  const [saving, setSaving] = useState(false);
  const gridRef = useRef(null);

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 2400);
  };

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const res = await fetch(`${API_BASE_URL}/users`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load users");
      const data = await res.json();
      setRows(data);
    } catch (err) {
      setLoadError("Could not load user data. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const openEdit = useCallback(
    (row) => {
      if (!permissions.canEdit) return;
      setEditingRow(row);
      setModalOpen(true);
    },
    [permissions.canEdit]
  );

  const toggleLock = useCallback(
    async (row) => {
      const locked = row.locked_until && new Date(row.locked_until) > new Date();
      try {
        const res = await fetch(`${API_BASE_URL}/users/${row.id}/lock`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ locked: !locked }),
        });
        if (!res.ok) throw new Error("Failed to update lock status.");
        showToast(locked ? `"${row.name}" unlocked` : `"${row.name}" locked`);
        await loadUsers();
      } catch (err) {
        showToast(err.message || "Something went wrong. Please try again.");
      }
    },
    [loadUsers]
  );

  const handleSaveUser = async (form) => {
    setSaving(true);
    try {
      if (editingRow) {
        const res = await fetch(`${API_BASE_URL}/users/${editingRow.id}`, {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to update user.");
        }
        showToast(`User "${form.name}" updated`);
      } else {
        const res = await fetch(`${API_BASE_URL}/users`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to create user.");
        }
        showToast(`User "${form.name}" created`);
      }
      setModalOpen(false);
      setEditingRow(null);
      await loadUsers();
    } catch (err) {
      showToast(err.message || "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!permissions.canDelete) return;
    const target = deletingRow;
    setDeletingRow(null);
    try {
      const res = await fetch(`${API_BASE_URL}/users/${target.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to delete user.");
      }
      showToast(`User "${target.name}" deleted`);
      await loadUsers();
    } catch (err) {
      showToast(err.message || "Something went wrong. Please try again.");
    }
  };

  const columnDefs = useMemo(
    () => [
      {
        field: "id",
        headerName: "#",
        width: 70,
        filter: "agNumberColumnFilter",
        floatingFilter: true,
        sortable: true,
      },
      {
        field: "name",
        headerName: "User",
        flex: 1.4,
        minWidth: 220,
        cellRenderer: NameCellRenderer,
        filter: "agTextColumnFilter",
        floatingFilter: true,
        sortable: true,
      },
      {
        field: "role",
        headerName: "Role",
        flex: 0.8,
        minWidth: 110,
        cellRenderer: RoleCellRenderer,
        filter: "agTextColumnFilter",
        floatingFilter: true,
        sortable: true,
      },
      {
        field: "is_active",
        headerName: "Status",
        flex: 0.9,
        minWidth: 120,
        cellRenderer: StatusCellRenderer,
        filter: "agTextColumnFilter",
        floatingFilter: true,
        sortable: true,
        valueGetter: (p) => (p.data?.is_active ? "Active" : "Inactive"),
      },
      {
        field: "failed_login_count",
        headerName: "Failed Logins",
        flex: 0.8,
        minWidth: 120,
        cellRenderer: FailedLoginsCellRenderer,
        filter: "agNumberColumnFilter",
        floatingFilter: true,
        sortable: true,
      },
      {
        field: "locked_until",
        headerName: "Locked Until",
        flex: 1,
        minWidth: 140,
        cellRenderer: DateCellRenderer,
        filter: "agTextColumnFilter",
        floatingFilter: true,
        sortable: true,
        valueGetter: (p) => fmtDate(p.data?.locked_until),
      },
      {
        field: "created_at",
        headerName: "Created",
        flex: 1,
        minWidth: 130,
        cellRenderer: DateCellRenderer,
        filter: "agTextColumnFilter",
        floatingFilter: true,
        sortable: true,
        valueGetter: (p) => fmtDate(p.data?.created_at),
      },
      {
        headerName: "Actions",
        width: 150,
        minWidth: 150,
        pinned: "right",
        sortable: false,
        filter: false,
        cellRenderer: ActionsCellRenderer,
        cellStyle: { display: "flex", alignItems: "center" },
      },
    ],
    []
  );

  const defaultColDef = useMemo(
    () => ({
      resizable: true,
      suppressMovable: false,
    }),
    []
  );

  const activeCount = rows.filter((r) => r.is_active).length;
  const lockedCount = rows.filter((r) => r.locked_until && new Date(r.locked_until) > new Date()).length;

  const exportCsv = () => {
    const headers = ["#", "Name", "Email", "Role", "Status", "Failed Logins", "Locked Until", "Created At"];
    const lines = [headers.join(",")];
    rows.forEach((r) =>
      lines.push(
        [
          r.id,
          r.name,
          r.email,
          r.role,
          r.is_active ? "Active" : "Inactive",
          r.failed_login_count || 0,
          fmtDate(r.locked_until),
          fmtDate(r.created_at),
        ]
          .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
          .join(",")
      )
    );
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "user_management.csv";
    a.click();
    URL.revokeObjectURL(url);
    showToast("CSV exported");
  };

  const exportExcel = () => {
    const data = rows.map((r) => ({
      "#": r.id,
      Name: r.name,
      Email: r.email,
      Role: r.role,
      Status: r.is_active ? "Active" : "Inactive",
      "Failed Logins": r.failed_login_count || 0,
      "Locked Until": fmtDate(r.locked_until),
      "Created At": fmtDate(r.created_at),
    }));
    const worksheet = XLSX.utils.json_to_sheet(data);
    worksheet["!cols"] = [
      { wch: 5 }, { wch: 22 }, { wch: 28 }, { wch: 12 },
      { wch: 10 }, { wch: 14 }, { wch: 16 }, { wch: 14 },
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Users");
    XLSX.writeFile(workbook, "user_management.xlsx");
    showToast("Excel exported");
  };

  const exportPdf = () => {
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(14);
    doc.text("PPM Chit Funds — User Management", 14, 16);
    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128);
    doc.text(
      `Total Users: ${rows.length}   |   Active: ${activeCount}   |   Locked: ${lockedCount}`,
      14,
      22
    );

    autoTable(doc, {
      startY: 28,
      head: [["#", "Name", "Email", "Role", "Status", "Failed Logins", "Locked Until", "Created At"]],
      body: rows.map((r) => [
        r.id,
        r.name,
        r.email,
        r.role,
        r.is_active ? "Active" : "Inactive",
        r.failed_login_count || 0,
        fmtDate(r.locked_until) || "-",
        fmtDate(r.created_at) || "-",
      ]),
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [29, 78, 216], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [249, 250, 251] },
    });

    doc.save("user_management.pdf");
    showToast("PDF exported");
  };

  return (
    <div
      style={{
        background: BG,
        fontFamily: "Inter, sans-serif",
        color: "#111827",
        minHeight: "100%",
      }}
    >
      <style>{gridThemeStyles}</style>

      <div style={{ padding: "28px 26px 60px" }}>
        <div
          style={{
            background: "#fff",
            borderRadius: 10,
            border: `1px solid ${BORDER}`,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "18px 32px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderBottom: `4px solid ${YELLOW}`,
            }}
          >
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: "#111827", display: "flex", alignItems: "center", gap: 8 }}>
              <ShieldCheck size={18} color={BLUE} />
              User Management
            </h2>
            <span
              style={{
                fontSize: 11,
                letterSpacing: "1.2px",
                textTransform: "uppercase",
                color: "#6B7280",
              }}
            >
              Accounts &amp; Access Control
            </span>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "18px 32px",
              gap: 16,
              flexWrap: "wrap",
              background: "#F9FAFB",
              borderBottom: `1px solid ${BORDER}`,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 220 }}>
              <Search size={16} color="#6B7280" />
              <input
                placeholder="Quick search by name, email, role…"
                value={quickFilter}
                onChange={(e) => setQuickFilter(e.target.value)}
                style={{
                  width: "100%",
                  maxWidth: 320,
                  padding: "9px 12px",
                  borderRadius: 20,
                  border: `1.5px solid ${BORDER}`,
                  fontSize: 13.5,
                  background: "#fff",
                }}
              />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              {permissions.canAdd && (
                <button
                  onClick={() => {
                    setEditingRow(null);
                    setModalOpen(true);
                  }}
                  style={pillBtn(BLUE, "#fff")}
                >
                  <Plus size={14} /> Add User
                </button>
              )}
              <button onClick={exportCsv} style={pillBtn("#EFF6FF", BLUE)}>
                <Download size={14} /> CSV
              </button>
              <button onClick={exportExcel} style={pillBtn("#FEFCE8", "#A16207")}>
                <FileSpreadsheet size={14} /> Excel
              </button>
              <button onClick={exportPdf} style={pillBtn("#FEF2F2", "#B91C1C")}>
                <FileText size={14} /> PDF
              </button>
            </div>
          </div>

          <div
            className="ppm-grid ag-theme-quartz"
            style={{ height: 560, width: "100%", position: "relative" }}
          >
            {loading && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "rgba(255,255,255,0.85)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 5,
                  fontSize: 13.5,
                  color: "#6B7280",
                }}
              >
                Loading users…
              </div>
            )}
            {loadError && !loading && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "#fff",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 5,
                  gap: 10,
                }}
              >
                <span style={{ fontSize: 13.5, color: "#B91C1C" }}>{loadError}</span>
                <button onClick={loadUsers} style={pillBtn(BLUE, "#fff")}>
                  Retry
                </button>
              </div>
            )}
            <AgGridReact
              theme="legacy"
              ref={gridRef}
              rowData={rows}
              columnDefs={columnDefs}
              defaultColDef={defaultColDef}
              quickFilterText={quickFilter}
              context={{ openEdit, setDeletingRow, toggleLock, permissions }}
              pagination={true}
              paginationPageSize={8}
              animateRows={true}
              rowHeight={52}
              headerHeight={46}
              getRowId={(params) => String(params.data.id)}
            />
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "14px 32px",
              fontSize: 12,
              color: "#6B7280",
              background: "#F9FAFB",
              borderTop: `1px solid ${BORDER}`,
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            <div>
              Total Users: <b style={{ color: BLUE }}>{rows.length}</b> &nbsp;·&nbsp; Active:{" "}
              <b style={{ color: "#15803D" }}>{activeCount}</b> &nbsp;·&nbsp; Locked:{" "}
              <b style={{ color: "#B91C1C" }}>{lockedCount}</b>
            </div>
          </div>
        </div>
      </div>

      <NewUserModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingRow(null);
        }}
        onSave={handleSaveUser}
        editingRow={editingRow}
        saving={saving}
        permissions={permissions}
      />
      <ConfirmDeleteModal
        row={deletingRow}
        onConfirm={confirmDelete}
        onCancel={() => setDeletingRow(null)}
      />
      <Toast message={toastMsg} />
    </div>
  );
}