import React, { useState, useMemo, useEffect } from "react";
import {
  X,
  Search,
  Plus,
  Download,
  FileSpreadsheet,
  FileText,
  ArrowUpDown,
  Menu,
  ChevronLeft,
  LayoutDashboard,
  Users,
  Wallet,
  CalendarDays,
  Receipt,
  BarChart3,
  Settings,
  Bell,
  UserCircle,
  Pencil,
  Trash2,
  AlertTriangle,
  SlidersHorizontal,
  ChevronDown,
  Loader2,
  DatabaseZap,
} from "lucide-react";

const STORAGE_KEY = "party-master-rows";

const BLUE = "#1D4ED8";
const YELLOW = "#FBBF24";
const BORDER = "#E5E7EB";
const BG = "#F5F8FC";

const seedData = [
  { id: 1, name: "Rajendran Muthu", relation: "S/o Muthusamy", address: "12 Gandhi St, Mylapore", city: "Chennai", phone: "9840012345", chitValue: 100000, status: "Active" },
  { id: 2, name: "Kalaivani Selvam", relation: "W/o Selvam R.", address: "45 Anna Nagar 2nd Ave", city: "Chennai", phone: "9884456123", chitValue: 200000, status: "Active" },
  { id: 3, name: "Pandiarajan K.", relation: "S/o Karuppiah", address: "7 Market Rd", city: "Madurai", phone: "9944778812", chitValue: 50000, status: "Hold" },
  { id: 4, name: "Meena Krishnan", relation: "W/o Krishnan V.", address: "23 Bazaar St", city: "Trichy", phone: "9003345567", chitValue: 150000, status: "Active" },
  { id: 5, name: "Suresh Babu", relation: "S/o Ramasamy", address: "9 East Car St", city: "Coimbatore", phone: "9791234567", chitValue: 300000, status: "Closed" },
  { id: 6, name: "Deepa Ravichandran", relation: "W/o Ravichandran S.", address: "18 Kamaraj Rd", city: "Salem", phone: "9865123490", chitValue: 100000, status: "Active" },
  { id: 7, name: "Anbarasu M.", relation: "S/o Manickam", address: "31 South St", city: "Chennai", phone: "9600112233", chitValue: 200000, status: "Active" },
  { id: 8, name: "Vijayalakshmi N.", relation: "W/o Natarajan", address: "5 Church Rd", city: "Tirunelveli", phone: "9944556677", chitValue: 75000, status: "Hold" },
  { id: 9, name: "Ganesan T.", relation: "S/o Thangavel", address: "14 North St", city: "Erode", phone: "9788990011", chitValue: 250000, status: "Active" },
  { id: 10, name: "Bhuvaneswari R.", relation: "W/o Ravi Kumar", address: "22 Temple St", city: "Chennai", phone: "9840099887", chitValue: 100000, status: "Active" },
  { id: 11, name: "Chandrasekaran P.", relation: "S/o Palanisamy", address: "3 West Mada St", city: "Madurai", phone: "9003211122", chitValue: 150000, status: "Closed" },
  { id: 12, name: "Latha Subramaniam", relation: "W/o Subramaniam K.", address: "27 Mount Rd", city: "Chennai", phone: "9884433221", chitValue: 200000, status: "Active" },
];

const PAGE_SIZE = 6;

// ---------------- Local IndexedDB "database" ----------------
// Lightweight wrapper so party data survives page reloads without any backend.
const DB_NAME = "partyMasterDB";
const STORE_NAME = "parties";

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbGetAll() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbPut(row) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(row);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function dbBulkPut(rows) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    rows.forEach((r) => store.put(r));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function dbDelete(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

const emptyForm = { name: "", relation: "", address: "", city: "", phone: "", chitValue: "", status: "Active" };

const menuItems = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "party", label: "Party Master", icon: Users },
  { key: "chit", label: "Chit Groups", icon: Wallet },
  { key: "collections", label: "Collections", icon: CalendarDays },
  { key: "payments", label: "Payments", icon: Receipt },
  { key: "reports", label: "Reports", icon: BarChart3 },
  { key: "settings", label: "Settings", icon: Settings },
];

function StatusPill({ status }) {
  const styles = {
    Active: { bg: "#DCFCE7", color: "#15803D" },
    Hold: { bg: "#FEF3C7", color: "#B45309" },
    Closed: { bg: "#FEE2E2", color: "#B91C1C" },
  }[status];
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
      {status}
    </span>
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
        animation: "riseIn .25s ease",
      }}
    >
      {message}
      <style>{`@keyframes riseIn{from{opacity:0;transform:translate(-50%,10px)}to{opacity:1;transform:translate(-50%,0)}}`}</style>
    </div>
  );
}

function FormRow({ label, children }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "150px 1fr", alignItems: "center", gap: 12 }}>
      <label style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>{label}</label>
      {children}
    </div>
  );
}

function NewPartyModal({ open, onClose, onSave, editingRow }) {
  const isEdit = !!editingRow;
  const [form, setForm] = useState(editingRow || emptyForm);
  const [error, setError] = useState("");

  React.useEffect(() => {
    if (open) setForm(editingRow || emptyForm);
  }, [open, editingRow]);

  if (!open) return null;

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSave = (andNew) => {
    if (!form.name.trim()) {
      setError("Name is required.");
      return;
    }
    onSave({ ...form, chitValue: Number(form.chitValue) || 0 }, andNew);
    if (andNew) {
      setForm(emptyForm);
      setError("");
    }
  };

  const handleClose = () => {
    setForm(emptyForm);
    setError("");
    onClose();
  };

  const fieldStyle = {
    padding: "10px 12px",
    border: `1.5px solid ${BORDER}`,
    borderRadius: 8,
    fontSize: 14,
    background: "#fff",
    width: "100%",
    fontFamily: "inherit",
  };

  return (
    <div
      onClick={handleClose}
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
          maxWidth: 580,
          boxShadow: "0 25px 60px rgba(0,0,0,0.3)",
          overflow: "hidden",
          animation: "popIn .18s ease",
        }}
      >
        <style>{`@keyframes popIn{from{opacity:0;transform:scale(0.96)}to{opacity:1;transform:scale(1)}}`}</style>

        <div
          style={{
            background: BLUE,
            color: "#fff",
            padding: "16px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: `4px solid ${YELLOW}`,
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>{isEdit ? "Edit Party" : "New Party Addition"}</h2>
            <div style={{ fontSize: 11, letterSpacing: "1.2px", textTransform: "uppercase", opacity: 0.85, marginTop: 2 }}>
              Form 1 — Subscriber Enrolment
            </div>
          </div>
          <button onClick={handleClose} style={{ background: "transparent", border: "none", color: "#fff", cursor: "pointer", padding: 4 }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: "24px 24px 20px", maxHeight: "70vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: 16 }}>
          {error && (
            <div style={{ background: "#FEE2E2", color: "#B91C1C", padding: "9px 14px", borderRadius: 8, fontSize: 13 }}>{error}</div>
          )}

          <FormRow label="Name">
            <input style={fieldStyle} placeholder="e.g. Rajendran Muthu" value={form.name} onChange={update("name")} autoFocus />
          </FormRow>
          <FormRow label="S/o or W/o">
            <input style={fieldStyle} placeholder="Father / Husband name" value={form.relation} onChange={update("relation")} />
          </FormRow>
          <FormRow label="Address">
            <input style={fieldStyle} placeholder="Door No, Street, Area" value={form.address} onChange={update("address")} />
          </FormRow>
          <FormRow label="City">
            <input style={fieldStyle} placeholder="e.g. Chennai" value={form.city} onChange={update("city")} />
          </FormRow>
          <FormRow label="Phone">
            <input style={fieldStyle} placeholder="10-digit mobile number" value={form.phone} onChange={update("phone")} />
          </FormRow>
          <FormRow label="Chit Value (₹)">
            <input style={fieldStyle} placeholder="e.g. 100000" value={form.chitValue} onChange={update("chitValue")} />
          </FormRow>
          <FormRow label="Status">
            <select style={fieldStyle} value={form.status} onChange={update("status")}>
              <option value="Active">Active</option>
              <option value="Hold">On Hold</option>
              <option value="Closed">Closed</option>
            </select>
          </FormRow>
        </div>

        <div style={{ display: "flex", gap: 12, padding: "16px 24px 24px", borderTop: `1px dashed ${BORDER}`, flexWrap: "wrap" }}>
          <button
            onClick={() => handleSave(false)}
            style={{
              background: BLUE,
              color: "#fff",
              border: "none",
              padding: "11px 22px",
              borderRadius: 8,
              fontWeight: 600,
              fontSize: 13.5,
              cursor: "pointer",
              boxShadow: "0 6px 14px rgba(29,78,216,0.3)",
            }}
          >
            {isEdit ? "Update Party" : "Save Party"}
          </button>
          {!isEdit && (
            <button
              onClick={() => handleSave(true)}
              style={{
                background: "#FFFBEB",
                color: "#A16207",
                border: "1.5px solid #FDE68A",
                padding: "11px 22px",
                borderRadius: 8,
                fontWeight: 600,
                fontSize: 13.5,
                cursor: "pointer",
              }}
            >
              + Save &amp; Add New
            </button>
          )}
          <button
            onClick={handleClose}
            style={{
              background: "transparent",
              color: "#B91C1C",
              border: "1.5px solid rgba(185,28,28,0.35)",
              padding: "11px 22px",
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
          <h3 style={{ margin: 0, fontSize: 16.5, color: "#111827" }}>Delete this party?</h3>
        </div>
        <p style={{ fontSize: 13.5, color: "#6B7280", margin: "0 0 20px" }}>
          This will permanently remove <b style={{ color: "#111827" }}>{row.name}</b> from the register. This action cannot be undone.
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            onClick={onCancel}
            style={{ background: "#F3F4F6", color: "#111827", border: "none", padding: "9px 18px", borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: "pointer" }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{ background: "#B91C1C", color: "#fff", border: "none", padding: "9px 18px", borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: "pointer" }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function ColFilterPopover({ colKey, filterType, colFilters, setColFilters, cities, onClose }) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const fieldStyle = {
    padding: "8px 10px",
    border: `1.5px solid ${BORDER}`,
    borderRadius: 7,
    fontSize: 13,
    background: "#fff",
    width: "100%",
    fontFamily: "inherit",
    color: "#111827",
  };

  const options = colKey === "status" ? ["Active", "Hold", "Closed"] : colKey === "city" ? cities : [];

  return (
    <div
      ref={ref}
      onClick={(e) => e.stopPropagation()}
      style={{
        position: "absolute",
        top: "calc(100% + 6px)",
        left: 0,
        background: "#fff",
        border: `1px solid ${BORDER}`,
        borderRadius: 10,
        boxShadow: "0 14px 32px rgba(15,23,42,0.2)",
        padding: 14,
        width: filterType === "range" || filterType === "text" ? 210 : 190,
        zIndex: 80,
        textTransform: "none",
        letterSpacing: "normal",
        fontWeight: 400,
        color: "#111827",
      }}
    >
      {filterType === "text" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <select
            value={colFilters[`${colKey}Op`]}
            onChange={(e) => setColFilters((f) => ({ ...f, [`${colKey}Op`]: e.target.value }))}
            style={fieldStyle}
          >
            <option value="contains">Contains</option>
            <option value="equals">Equals</option>
            <option value="startsWith">Starts with</option>
          </select>
          <input
            autoFocus
            placeholder="Filter value…"
            value={colFilters[colKey]}
            onChange={(e) => setColFilters((f) => ({ ...f, [colKey]: e.target.value }))}
            style={fieldStyle}
          />
        </div>
      )}

      {filterType === "range" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <select
            value={colFilters.chitOp}
            onChange={(e) => setColFilters((f) => ({ ...f, chitOp: e.target.value }))}
            style={fieldStyle}
          >
            <option value="between">Between (min–max)</option>
            <option value="equals">Equals</option>
            <option value="gt">Greater than</option>
            <option value="lt">Less than</option>
          </select>
          <input
            type="number"
            placeholder={colFilters.chitOp === "equals" || colFilters.chitOp === "gt" ? "Value ₹" : "Min ₹"}
            value={colFilters.minValue}
            onChange={(e) => setColFilters((f) => ({ ...f, minValue: e.target.value }))}
            style={fieldStyle}
            disabled={colFilters.chitOp === "lt"}
          />
          {colFilters.chitOp === "between" && (
            <input
              type="number"
              placeholder="Max ₹"
              value={colFilters.maxValue}
              onChange={(e) => setColFilters((f) => ({ ...f, maxValue: e.target.value }))}
              style={fieldStyle}
            />
          )}
          {colFilters.chitOp === "lt" && (
            <input
              type="number"
              placeholder="Value ₹"
              value={colFilters.maxValue}
              onChange={(e) => setColFilters((f) => ({ ...f, maxValue: e.target.value }))}
              style={fieldStyle}
            />
          )}
        </div>
      )}

      {filterType === "multiselect" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 180, overflowY: "auto" }}>
          {options.length === 0 && <span style={{ fontSize: 12.5, color: "#9CA3AF" }}>No options</span>}
          {options.map((opt) => {
            const checked = colFilters[colKey].includes(opt);
            return (
              <label key={opt} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => {
                    setColFilters((f) => ({
                      ...f,
                      [colKey]: e.target.checked ? [...f[colKey], opt] : f[colKey].filter((x) => x !== opt),
                    }));
                  }}
                />
                {opt}
              </label>
            );
          })}
        </div>
      )}

      <button
        onClick={() => {
          setColFilters((f) =>
            filterType === "range"
              ? { ...f, minValue: "", maxValue: "", chitOp: "between" }
              : filterType === "multiselect"
              ? { ...f, [colKey]: [] }
              : { ...f, [colKey]: "", [`${colKey}Op`]: "contains" }
          );
        }}
        style={{
          marginTop: 10,
          width: "100%",
          background: "#F3F4F6",
          color: "#374151",
          border: "none",
          padding: "6px 10px",
          borderRadius: 7,
          fontSize: 12,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Clear
      </button>
    </div>
  );
}


function Sidebar({ collapsed, setCollapsed, active, setActive, mobileOpen, closeMobile }) {
  return (
    <>
      {mobileOpen && (
        <div
          onClick={closeMobile}
          className="pm-sidebar-backdrop"
          style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", zIndex: 90 }}
        />
      )}
      <div
        className={`pm-sidebar${mobileOpen ? " pm-sidebar-open" : ""}`}
        style={{
          width: collapsed ? 70 : 240,
          transition: "width .18s ease, transform .2s ease",
          background: "#0F172A",
          color: "#fff",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: collapsed ? "center" : "space-between",
            padding: "18px 16px",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          {!collapsed && <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: "0.4px" }}>PPM Chits</span>}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="pm-collapse-btn"
            style={{ background: "transparent", border: "none", color: "#fff", cursor: "pointer", padding: 4 }}
          >
            {collapsed ? <Menu size={20} /> : <ChevronLeft size={20} />}
          </button>
        </div>

        <nav style={{ padding: "12px 0", display: "flex", flexDirection: "column", gap: 2 }}>
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = active === item.key;
            return (
              <button
                key={item.key}
                onClick={() => {
                  setActive(item.key);
                  closeMobile();
                }}
                title={collapsed ? item.label : undefined}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: collapsed ? "12px 0" : "12px 20px",
                  justifyContent: collapsed ? "center" : "flex-start",
                  background: isActive ? "rgba(251,191,36,0.12)" : "transparent",
                  borderLeft: isActive ? `4px solid ${YELLOW}` : "4px solid transparent",
                  border: "none",
                  borderLeftWidth: 4,
                  color: isActive ? YELLOW : "#CBD5E1",
                  cursor: "pointer",
                  fontSize: 13.5,
                  fontWeight: isActive ? 600 : 500,
                  textAlign: "left",
                  width: "100%",
                }}
              >
                <Icon size={18} />
                {!collapsed && item.label}
              </button>
            );
          })}
        </nav>
      </div>
    </>
  );
}

function Navbar({ onMenuClick }) {
  return (
    <div>
      <div
        style={{
          background: BLUE,
          color: "#fff",
          padding: "14px 26px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button
            onClick={onMenuClick}
            className="pm-hamburger"
            style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", cursor: "pointer", padding: 6, borderRadius: 6, display: "none" }}
          >
            <Menu size={18} />
          </button>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>PPM Chit Funds</h1>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <Bell size={18} />
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <UserCircle size={20} />
            <span style={{ fontSize: 13.5, fontWeight: 500 }}>Admin</span>
          </div>
        </div>
      </div>
      <div style={{ height: 4, background: YELLOW }} />
    </div>
  );
}

export default function PartyMaster() {
  const [rows, setRows] = useState(seedData);
  const [dbReady, setDbReady] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  React.useEffect(() => {
    (async () => {
      try {
        const existing = await dbGetAll();
        if (existing && existing.length) {
          setRows(existing);
        } else {
          await dbBulkPut(seedData);
        }
      } catch (e) {
        console.error("IndexedDB init failed, using in-memory data only:", e);
      } finally {
        setDbReady(true);
      }
    })();
  }, []);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [deletingRow, setDeletingRow] = useState(null);
  const [toastMsg, setToastMsg] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState("asc");
  const [collapsed, setCollapsed] = useState(false);
  const [active, setActive] = useState("party");
  const [openFilterCol, setOpenFilterCol] = useState(null);
  const emptyColFilters = {
    name: "", nameOp: "contains",
    relation: "", relationOp: "contains",
    address: "", addressOp: "contains",
    city: [],
    phone: "", phoneOp: "contains",
    minValue: "", maxValue: "", chitOp: "between",
    status: [],
  };
  const [colFilters, setColFilters] = useState(emptyColFilters);

  const activeColFilterCount = ["name", "relation", "address", "city", "phone", "status"].filter((k) =>
    Array.isArray(colFilters[k]) ? colFilters[k].length > 0 : colFilters[k] !== ""
  ).length + (colFilters.minValue || colFilters.maxValue ? 1 : 0);

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 2400);
  };

  const handleSaveParty = (form, andNew) => {
    if (editingRow) {
      const updated = { ...editingRow, ...form };
      setRows((r) => r.map((row) => (row.id === editingRow.id ? updated : row)));
      dbPut(updated).catch((e) => console.error("DB update failed:", e));
      showToast(`Party "${form.name}" updated`);
      setModalOpen(false);
      setEditingRow(null);
      return;
    }
    const newRow = { id: rows.length ? Math.max(...rows.map((r) => r.id)) + 1 : 1, ...form };
    setRows((r) => [...r, newRow]);
    dbPut(newRow).catch((e) => console.error("DB insert failed:", e));
    setPage(1);
    showToast(`Party "${form.name}" saved to register`);
    if (!andNew) setModalOpen(false);
  };

  const openEdit = (row) => {
    setEditingRow(row);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingRow(null);
  };

  const confirmDelete = () => {
    setRows((r) => r.filter((row) => row.id !== deletingRow.id));
    dbDelete(deletingRow.id).catch((e) => console.error("DB delete failed:", e));
    showToast(`Party "${deletingRow.name}" deleted`);
    setDeletingRow(null);
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    let data = rows;
    if (statusFilter !== "All") {
      data = data.filter((r) => r.status === statusFilter);
    }
    if (q) {
      data = data.filter((r) =>
        [r.name, r.relation, r.address, r.city, r.phone, r.status].some((v) => String(v).toLowerCase().includes(q))
      );
    }
    const matchText = (value, filterVal, op) => {
      if (!filterVal) return true;
      const v = String(value).toLowerCase();
      const f = filterVal.toLowerCase();
      if (op === "equals") return v === f;
      if (op === "startsWith") return v.startsWith(f);
      return v.includes(f); // contains (default)
    };

    if (colFilters.name) data = data.filter((r) => matchText(r.name, colFilters.name, colFilters.nameOp));
    if (colFilters.relation) data = data.filter((r) => matchText(r.relation, colFilters.relation, colFilters.relationOp));
    if (colFilters.address) data = data.filter((r) => matchText(r.address, colFilters.address, colFilters.addressOp));
    if (colFilters.phone) data = data.filter((r) => matchText(r.phone, colFilters.phone, colFilters.phoneOp));
    if (colFilters.city.length) data = data.filter((r) => colFilters.city.includes(r.city));
    if (colFilters.status.length) data = data.filter((r) => colFilters.status.includes(r.status));
    if (colFilters.chitOp === "equals" && colFilters.minValue) {
      data = data.filter((r) => r.chitValue === Number(colFilters.minValue));
    } else if (colFilters.chitOp === "gt" && colFilters.minValue) {
      data = data.filter((r) => r.chitValue > Number(colFilters.minValue));
    } else if (colFilters.chitOp === "lt" && colFilters.maxValue) {
      data = data.filter((r) => r.chitValue < Number(colFilters.maxValue));
    } else {
      if (colFilters.minValue) data = data.filter((r) => r.chitValue >= Number(colFilters.minValue));
      if (colFilters.maxValue) data = data.filter((r) => r.chitValue <= Number(colFilters.maxValue));
    }
    if (sortKey) {
      data = [...data].sort((a, b) => {
        const av = a[sortKey], bv = b[sortKey];
        if (typeof av === "number") return sortDir === "asc" ? av - bv : bv - av;
        return sortDir === "asc" ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
      });
    }
    return data;
  }, [rows, search, statusFilter, sortKey, sortDir, colFilters]);

  const cities = useMemo(() => [...new Set(rows.map((r) => r.city))].sort(), [rows]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalValue = filtered.reduce((s, r) => s + Number(r.chitValue || 0), 0);

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const exportCsv = () => {
    const headers = ["#", "Name", "S/o or W/o", "Address", "City", "Phone", "Chit Value", "Status"];
    const lines = [headers.join(",")];
    filtered.forEach((r) =>
      lines.push([r.id, r.name, r.relation, r.address, r.city, r.phone, r.chitValue, r.status].map((v) => `"${v}"`).join(","))
    );
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "party_register.csv";
    a.click();
    URL.revokeObjectURL(url);
    showToast("CSV exported");
  };

  const ColHeader = ({ label, colKey, filterType }) => {
    const isFilterOpen = openFilterCol === colKey;
    const hasFilter = filterType === "multiselect" ? colFilters[colKey].length > 0 : filterType === "range" ? colFilters.minValue || colFilters.maxValue : colFilters[colKey];

    return (
      <th
        style={{
          padding: "14px 18px",
          textAlign: "left",
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: "0.4px",
          textTransform: "uppercase",
          color: "#fff",
          userSelect: "none",
          whiteSpace: "nowrap",
          position: "relative",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span onClick={() => toggleSort(colKey)} style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5 }}>
            {label} <ArrowUpDown size={12} opacity={sortKey === colKey ? 1 : 0.4} />
          </span>
          {filterType && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setOpenFilterCol(isFilterOpen ? null : colKey);
              }}
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: hasFilter ? YELLOW : "rgba(255,255,255,0.65)",
                display: "flex",
                alignItems: "center",
                padding: 2,
              }}
              title="Filter"
            >
              <SlidersHorizontal size={12} />
            </button>
          )}
        </div>

        {isFilterOpen && (
          <ColFilterPopover
            colKey={colKey}
            filterType={filterType}
            colFilters={colFilters}
            setColFilters={setColFilters}
            cities={cities}
            onClose={() => setOpenFilterCol(null)}
          />
        )}
      </th>
    );
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: BG, fontFamily: "Inter, sans-serif", color: "#111827" }}>
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} active={active} setActive={setActive} />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <Navbar />

        <div style={{ padding: "28px 26px 60px" }}>
          <div style={{ background: "#fff", borderRadius: 10, border: `1px solid ${BORDER}`, overflow: "hidden" }}>
            <div
              style={{
                padding: "18px 32px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                borderBottom: `4px solid ${YELLOW}`,
              }}
            >
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: "#111827" }}>Party Register</h2>
              <span style={{ fontSize: 11, letterSpacing: "1.2px", textTransform: "uppercase", color: "#6B7280" }}>
                Live Ledger — All Subscribers
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
                  placeholder="Search name, city, phone…"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
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
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setPage(1);
                  }}
                  style={{
                    padding: "9px 12px",
                    borderRadius: 20,
                    border: `1.5px solid ${BORDER}`,
                    fontSize: 13.5,
                    background: "#fff",
                    color: "#374151",
                    fontWeight: 600,
                  }}
                >
                  <option value="All">All Statuses</option>
                  <option value="Active">Active</option>
                  <option value="Hold">On Hold</option>
                  <option value="Closed">Closed</option>
                </select>
                {activeColFilterCount > 0 && (
                  <button
                    onClick={() => setColFilters(emptyColFilters)}
                    style={{ background: "transparent", border: "none", color: BLUE, fontSize: 12.5, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}
                  >
                    Clear {activeColFilterCount} column filter{activeColFilterCount > 1 ? "s" : ""}
                  </button>
                )}
              </div>
              <div style={{ display: "flex", gap: 10, position: "relative" }}>
                <button onClick={() => setModalOpen(true)} style={pillBtn(BLUE, "#fff")}>
                  <Plus size={14} /> Add Party
                </button>
                <button onClick={exportCsv} style={pillBtn("#EFF6FF", BLUE)}>
                  <Download size={14} /> CSV
                </button>
                <button onClick={() => showToast("Excel export wired up server-side in full build")} style={pillBtn("#FEFCE8", "#A16207")}>
                  <FileSpreadsheet size={14} /> Excel
                </button>
                <button onClick={() => showToast("PDF export wired up server-side in full build")} style={pillBtn("#FEF2F2", "#B91C1C")}>
                  <FileText size={14} /> PDF
                </button>
              </div>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead style={{ background: BLUE }}>
                  <tr>
                    <ColHeader label="#" colKey="id" />
                    <ColHeader label="Name" colKey="name" filterType="text" />
                    <ColHeader label="S/o or W/o" colKey="relation" filterType="text" />
                    <ColHeader label="Address" colKey="address" filterType="text" />
                    <ColHeader label="City" colKey="city" filterType="multiselect" />
                    <ColHeader label="Phone" colKey="phone" filterType="text" />
                    <ColHeader label="Chit Value" colKey="chitValue" filterType="range" />
                    <ColHeader label="Status" colKey="status" filterType="multiselect" />
                    <th style={{ padding: "14px 18px", color: "#fff" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((r, i) => (
                    <tr key={r.id} style={{ background: i % 2 ? "#F9FAFB" : "#fff", borderBottom: `1px solid ${BORDER}` }}>
                      <td style={td}>{r.id}</td>
                      <td style={{ ...td, fontWeight: 500 }}>{r.name}</td>
                      <td style={td}>{r.relation}</td>
                      <td style={td}>{r.address}</td>
                      <td style={td}>{r.city}</td>
                      <td style={td}>{r.phone}</td>
                      <td style={{ ...td, fontFamily: "monospace", fontWeight: 600 }}>₹{Number(r.chitValue).toLocaleString("en-IN")}</td>
                      <td style={{ padding: "14px 18px" }}>
                        <StatusPill status={r.status} />
                      </td>
                      <td style={{ padding: "14px 18px" }}>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button
                            onClick={() => openEdit(r)}
                            title="Edit party"
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
                            }}
                          >
                            <Pencil size={13} /> Edit
                          </button>
                          <button
                            onClick={() => setDeletingRow(r)}
                            title="Delete party"
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
                            }}
                          >
                            <Trash2 size={13} /> Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {paged.length === 0 && (
                    <tr>
                      <td colSpan={9} style={{ padding: "24px", textAlign: "center", color: "#9CA3AF", fontSize: 13.5 }}>
                        No matching parties found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
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
                gap: 10,
              }}
            >
              <div>
                Total Parties: <b style={{ color: BLUE }}>{filtered.length}</b> &nbsp;·&nbsp; Total Chit Value:{" "}
                <b style={{ color: BLUE }}>₹{totalValue.toLocaleString("en-IN")}</b>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  style={{ border: `1px solid ${BORDER}`, background: "#fff", borderRadius: 6, padding: "5px 10px", cursor: page === 1 ? "default" : "pointer", opacity: page === 1 ? 0.5 : 1 }}
                >
                  ←
                </button>
                <span>
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  style={{ border: `1px solid ${BORDER}`, background: "#fff", borderRadius: 6, padding: "5px 10px", cursor: page === totalPages ? "default" : "pointer", opacity: page === totalPages ? 0.5 : 1 }}
                >
                  →
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <NewPartyModal open={modalOpen} onClose={closeModal} onSave={handleSaveParty} editingRow={editingRow} />
      <ConfirmDeleteModal row={deletingRow} onConfirm={confirmDelete} onCancel={() => setDeletingRow(null)} />
      <Toast message={toastMsg} />
    </div>
  );
}

const td = { padding: "14px 18px", fontSize: 13.5 };

function pillBtn(bg, color) {
  return {
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
  };
}