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
  ChevronRight,
  UserCircle,
  Pencil,
  Trash2,
  AlertTriangle,
  UserPlus,
} from "lucide-react";

// AG Grid v36 requires explicit module registration. AllCommunityModule
// covers pagination, quick filter, and all community column filters
// (text/number). Note: agSetColumnFilter is an ENTERPRISE-only filter —
// we use agTextColumnFilter for City/Status below since this app only
// registers Community modules.
ModuleRegistry.registerModules([AllCommunityModule, ValidationModule]);

const BLUE = "#1D4ED8";
const YELLOW = "#FBBF24";
const BORDER = "#E5E7EB";
const BG = "#F5F8FC";

const API_BASE_URL = import.meta.env?.VITE_API_BASE_URL || "/api";

/* ============================================================
   AG Grid theme override — matches PPM Chits navy/blue/yellow
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
.ppm-grid .ag-row-group-expanded,
.ppm-grid .ag-row-group {
  background: #EFF6FF;
}
.ppm-grid .ag-pinned-right-cols-container,
.ppm-grid .ag-pinned-right-header {
  border-left: 1px solid ${BORDER};
}
`;

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

/* Name cell: shows the name, a "+N" badge if multiple members,
   and an expand chevron to reveal the member list below the row.
   Expand state is tracked in the parent component (expandedIds)
   and passed through context — this works in AG Grid Community,
   no Enterprise tree/master-detail features required. */
function NameCellRenderer(props) {
  const { data } = props;
  const { expandedIds, toggleExpand } = props.context;
  const memberCount = data.members?.length || 1;
  const expanded = expandedIds.has(data.id);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, height: "100%" }}>
      {memberCount > 1 ? (
        <button
          onClick={() => toggleExpand(data.id)}
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: BLUE,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 2,
            flexShrink: 0,
          }}
        >
          <ChevronRight
            size={14}
            style={{
              transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
              transition: "transform .12s ease",
            }}
          />
        </button>
      ) : (
        <span style={{ width: 18, flexShrink: 0 }} />
      )}
      <span style={{ fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {data.name}
      </span>
      {memberCount > 1 && (
        <span
          style={{
            background: "#FEF3C7",
            color: "#A16207",
            fontSize: 10.5,
            fontWeight: 700,
            padding: "2px 7px",
            borderRadius: 100,
            flexShrink: 0,
            whiteSpace: "nowrap",
          }}
        >
          +{memberCount - 1} member{memberCount - 1 > 1 ? "s" : ""}
        </span>
      )}
    </div>
  );
}

/* Full-width detail row listing every member of an expanded party */
function MemberDetailRenderer(props) {
  const members = props.data.members || [];
  return (
    <div
      style={{
        background: "#F9FAFB",
        borderTop: `1px dashed ${BORDER}`,
        borderBottom: `1px solid ${BORDER}`,
        padding: "12px 24px 12px 56px",
        display: "flex",
        flexWrap: "wrap",
        gap: 10,
      }}
    >
      {members.map((m, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: "#fff",
            border: `1px solid ${BORDER}`,
            borderRadius: 8,
            padding: "8px 14px",
            fontSize: 12.5,
          }}
        >
          <UserCircle size={16} color={BLUE} />
          <div>
            <div style={{ fontWeight: 600 }}>{m.name}</div>
            <div style={{ color: "#6B7280", fontSize: 11.5 }}>
              {m.role}
              {m.phone ? ` · ${m.phone}` : ""}
              {m.chitShare ? ` · ₹${Number(m.chitShare).toLocaleString("en-IN")}` : ""}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ActionsCellRenderer(props) {
  const { openEdit, setDeletingRow } = props.context;
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", height: "100%" }}>
      <button
        onClick={() => openEdit(props.data)}
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
        <Pencil size={13} /> Edit
      </button>
      <button
        onClick={() => setDeletingRow(props.data)}
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
        <Trash2 size={13} /> Delete
      </button>
    </div>
  );
}

function StatusCellRenderer(props) {
  return <StatusPill status={props.value} />;
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

const emptyMember = { name: "", role: "", phone: "", chitShare: "" };
const emptyForm = {
  name: "",
  relation: "",
  address: "",
  city: "",
  phone: "",
  chitValue: "",
  status: "Active",
  members: [], // additional members are entirely optional
};

function NewPartyModal({ open, onClose, onSave, editingRow, saving }) {
  const isEdit = !!editingRow;
  const [form, setForm] = useState(editingRow || emptyForm);
  const [error, setError] = useState("");

  React.useEffect(() => {
    if (open) {
      setForm(
        editingRow
          ? {
              ...editingRow,
              members:
                editingRow.members?.filter(
                  (m) => m.name.trim() && m.name.trim() !== editingRow.name?.trim()
                ) || [],
            }
          : emptyForm
      );
      setError("");
    }
  }, [open, editingRow]);

  if (!open) return null;

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const updateMember = (idx, key) => (e) => {
    setForm((f) => {
      const members = [...f.members];
      members[idx] = { ...members[idx], [key]: e.target.value };
      return { ...f, members };
    });
  };

  const addMember = () =>
    setForm((f) => ({ ...f, members: [...f.members, { ...emptyMember }] }));

  const removeMember = (idx) =>
    setForm((f) => ({ ...f, members: f.members.filter((_, i) => i !== idx) }));

  const extraMembersTotal = form.members.reduce(
    (sum, m) => sum + (Number(m.chitShare) || 0),
    0
  );
  const primaryShare = Math.max((Number(form.chitValue) || 0) - extraMembersTotal, 0);

  const buildPayload = () => {
    const cleanExtraMembers = form.members.filter((m) => m.name.trim());
    const allMembers = [
      { name: form.name, role: "Primary Subscriber", phone: form.phone, chitShare: primaryShare },
      ...cleanExtraMembers,
    ];
    return {
      ...form,
      chitValue: Number(form.chitValue) || 0,
      members: allMembers,
    };
  };

  const handleSave = (keepOpen = false) => {
    if (!form.name.trim()) {
      setError("Name is required.");
      return;
    }
    if (Number(form.chitValue) > 0 && extraMembersTotal > Number(form.chitValue)) {
      setError(
        `Member shares (₹${extraMembersTotal.toLocaleString("en-IN")}) can't exceed the total Chit Value (₹${Number(form.chitValue).toLocaleString("en-IN")}).`
      );
      return;
    }
    onSave(buildPayload(), keepOpen);
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
          maxWidth: 680,
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
              {isEdit ? "Edit Party" : "New Party Addition"}
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
              Form 1 — Subscriber Enrolment
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
            <div style={sectionLabelStyle}>Primary Subscriber Details</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={labelStyle}>Name</label>
                <input
                  style={fieldStyle}
                  placeholder="e.g. Rajendran Muthu"
                  value={form.name}
                  onChange={update("name")}
                  autoFocus
                />
              </div>
              <div>
                <label style={labelStyle}>S/o or W/o</label>
                <input
                  style={fieldStyle}
                  placeholder="Father / Husband name"
                  value={form.relation}
                  onChange={update("relation")}
                />
              </div>
              <div>
                <label style={labelStyle}>Phone</label>
                <input
                  style={fieldStyle}
                  placeholder="10-digit mobile number"
                  value={form.phone}
                  onChange={update("phone")}
                />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={labelStyle}>Address</label>
                <input
                  style={fieldStyle}
                  placeholder="Door No, Street, Area"
                  value={form.address}
                  onChange={update("address")}
                />
              </div>
              <div>
                <label style={labelStyle}>City</label>
                <input
                  style={fieldStyle}
                  placeholder="e.g. Chennai"
                  value={form.city}
                  onChange={update("city")}
                />
              </div>
              <div>
                <label style={labelStyle}>Chit Value (₹)</label>
                <input
                  style={{ ...fieldStyle, fontFamily: "monospace", fontWeight: 600 }}
                  placeholder="e.g. 100000"
                  type="number"
                  value={form.chitValue}
                  onChange={update("chitValue")}
                />
                {extraMembersTotal > 0 && (
                  <div
                    style={{
                      fontSize: 11,
                      marginTop: 4,
                      color:
                        Number(form.chitValue) > 0 && extraMembersTotal > Number(form.chitValue)
                          ? "#B91C1C"
                          : "#6B7280",
                    }}
                  >
                    Members claim ₹{extraMembersTotal.toLocaleString("en-IN")} of this
                  </div>
                )}
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={labelStyle}>Status</label>
                <select style={fieldStyle} value={form.status} onChange={update("status")}>
                  <option value="Active">Active</option>
                  <option value="Hold">On Hold</option>
                  <option value="Closed">Closed</option>
                </select>
              </div>
            </div>
          </div>

          <div style={{ borderTop: `1px dashed ${BORDER}`, paddingTop: 18 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 4,
              }}
            >
              <div style={{ ...sectionLabelStyle, marginBottom: 0 }}>
                Additional Members{" "}
                <span style={{ textTransform: "none", fontWeight: 400, color: "#9CA3AF" }}>
                  (optional)
                </span>
              </div>
              <button
                onClick={addMember}
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
                <UserPlus size={13} /> Add member
              </button>
            </div>
            <p style={{ fontSize: 12, color: "#9CA3AF", margin: "0 0 12px" }}>
              {form.name.trim() || "The primary subscriber"} is already recorded as the
              primary member above. Only add someone here if there's a guarantor or
              co-subscriber on this ticket.
            </p>

            {form.members.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "2fr 1.6fr 1.3fr 1.1fr 28px",
                    gap: 8,
                    padding: "0 2px",
                  }}
                >
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#9CA3AF" }}>
                    Member name
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#9CA3AF" }}>Role</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#9CA3AF" }}>Phone</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#9CA3AF" }}>
                    Share (₹)
                  </span>
                  <span />
                </div>

                {form.members.map((m, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "2fr 1.6fr 1.3fr 1.1fr 28px",
                      gap: 8,
                      alignItems: "center",
                      background: "#F9FAFB",
                      border: `1px solid ${BORDER}`,
                      borderRadius: 8,
                      padding: 8,
                    }}
                  >
                    <input
                      style={fieldStyle}
                      placeholder="Name"
                      value={m.name}
                      onChange={updateMember(idx, "name")}
                    />
                    <input
                      style={fieldStyle}
                      placeholder="Guarantor, etc."
                      value={m.role}
                      onChange={updateMember(idx, "role")}
                    />
                    <input
                      style={fieldStyle}
                      placeholder="Phone"
                      value={m.phone}
                      onChange={updateMember(idx, "phone")}
                    />
                    <input
                      style={{ ...fieldStyle, fontFamily: "monospace", fontWeight: 600 }}
                      placeholder="0"
                      type="number"
                      value={m.chitShare}
                      onChange={updateMember(idx, "chitShare")}
                    />
                    <button
                      onClick={() => removeMember(idx)}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "#B91C1C",
                        cursor: "pointer",
                        padding: 4,
                        display: "flex",
                        justifyContent: "center",
                      }}
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {Number(form.chitValue) > 0 && (
              <div
                style={{
                  marginTop: 14,
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  background: "#EFF6FF",
                  border: `1px solid #BFDBFE`,
                  borderRadius: 8,
                  padding: "12px 16px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12.5, color: "#1E3A8A" }}>
                    {form.name.trim() || "Primary subscriber"}'s share
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#1E3A8A", fontFamily: "monospace" }}>
                    ₹{primaryShare.toLocaleString("en-IN")}
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    borderTop: "1px solid #BFDBFE",
                    paddingTop: 6,
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#1E3A8A" }}>
                    Total Chit Value
                  </span>
                  <span style={{ fontSize: 17, fontWeight: 700, color: BLUE, fontFamily: "monospace" }}>
                    ₹{(Number(form.chitValue) || 0).toLocaleString("en-IN")}
                  </span>
                </div>
              </div>
            )}
          </div>
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
            onClick={() => handleSave(false)}
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
            {saving ? "Saving..." : isEdit ? "Update Party" : "Save Party"}
          </button>
          {!isEdit && (
            <button
              onClick={() => handleSave(true)}
              disabled={saving}
              style={{
                background: "#EFF6FF",
                color: BLUE,
                border: `1.5px solid #BFDBFE`,
                padding: "11px 24px",
                borderRadius: 8,
                fontWeight: 600,
                fontSize: 13.5,
                cursor: saving ? "not-allowed" : "pointer",
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? "Saving..." : "Save & Add New"}
            </button>
          )}
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
          <h3 style={{ margin: 0, fontSize: 16.5, color: "#111827" }}>Delete this party?</h3>
        </div>
        <p style={{ fontSize: 13.5, color: "#6B7280", margin: "0 0 20px" }}>
          This will permanently remove{" "}
          <b style={{ color: "#111827" }}>{row.name}</b> from the register. This action
          cannot be undone.
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

// Flattens each party's members into a single readable string, used by
// all three export formats so CSV/Excel/PDF stay consistent.
function membersSummary(row) {
  const members = row.members?.length
    ? row.members
    : [{ name: row.name, role: "Primary Subscriber", phone: row.phone, chitShare: row.chitValue }];
  return members
    .map((m) => {
      const share = m.chitShare ? ` ₹${Number(m.chitShare).toLocaleString("en-IN")}` : "";
      const phone = m.phone ? ` (${m.phone})` : "";
      return `${m.name}${m.role ? ` – ${m.role}` : ""}${phone}${share}`;
    })
    .join("; ");
}

export default function PartyMaster() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [deletingRow, setDeletingRow] = useState(null);
  const [toastMsg, setToastMsg] = useState("");
  const [quickFilter, setQuickFilter] = useState("");
  const [expandedIds, setExpandedIds] = useState(() => new Set());
  const [saving, setSaving] = useState(false);
  const gridRef = useRef(null);

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 2400);
  };

  const loadParties = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const res = await fetch(`${API_BASE_URL}/parties`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load parties");
      const data = await res.json();
      setRows(data);
    } catch (err) {
      setLoadError("Could not load party data. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadParties();
  }, [loadParties]);

  const toggleExpand = useCallback((id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const displayRows = useMemo(() => {
    const out = [];
    rows.forEach((r) => {
      out.push(r);
      if (expandedIds.has(r.id) && (r.members?.length || 1) > 1) {
        out.push({ id: `detail-${r.id}`, isDetail: true, parentData: r });
      }
    });
    return out;
  }, [rows, expandedIds]);

  const openEdit = useCallback((row) => {
    setEditingRow(row);
    setModalOpen(true);
  }, []);

  const [resetKey, setResetKey] = useState(0);

  const handleSaveParty = async (form, keepOpen = false) => {
    setSaving(true);
    try {
      if (editingRow) {
        const res = await fetch(`${API_BASE_URL}/parties/${editingRow.id}`, {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to update party.");
        }
        showToast(`Party "${form.name}" updated`);
      } else {
        const res = await fetch(`${API_BASE_URL}/parties`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to save party.");
        }
        showToast(`Party "${form.name}" saved to register`);
      }
      if (keepOpen) {
        setResetKey((k) => k + 1);
      } else {
        setModalOpen(false);
        setEditingRow(null);
      }
      await loadParties();
    } catch (err) {
      showToast(err.message || "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    const target = deletingRow;
    setDeletingRow(null);
    try {
      const res = await fetch(`${API_BASE_URL}/parties/${target.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to delete party.");
      }
      showToast(`Party "${target.name}" deleted`);
      await loadParties();
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
        headerName: "Name",
        flex: 1.4,
        minWidth: 220,
        cellRenderer: NameCellRenderer,
        filter: "agTextColumnFilter",
        floatingFilter: true,
        sortable: true,
      },
      {
        field: "relation",
        headerName: "S/o or W/o",
        flex: 1.1,
        minWidth: 130,
        filter: "agTextColumnFilter",
        floatingFilter: true,
        sortable: true,
      },
      {
        field: "address",
        headerName: "Address",
        flex: 1.3,
        minWidth: 160,
        filter: "agTextColumnFilter",
        floatingFilter: true,
        sortable: true,
      },
      {
        field: "city",
        headerName: "City",
        flex: 0.9,
        minWidth: 110,
        filter: "agTextColumnFilter",
        floatingFilter: true,
        sortable: true,
      },
      {
        field: "phone",
        headerName: "Phone",
        flex: 1,
        minWidth: 130,
        filter: "agTextColumnFilter",
        floatingFilter: true,
        sortable: true,
      },
      {
        field: "chitValue",
        headerName: "Chit Value",
        flex: 1,
        minWidth: 130,
        filter: "agNumberColumnFilter",
        floatingFilter: true,
        sortable: true,
        valueFormatter: (p) => `₹${Number(p.value).toLocaleString("en-IN")}`,
        cellStyle: { fontFamily: "monospace", fontWeight: 600 },
      },
      {
        field: "status",
        headerName: "Status",
        flex: 0.9,
        minWidth: 110,
        cellRenderer: StatusCellRenderer,
        filter: "agTextColumnFilter",
        floatingFilter: true,
        sortable: true,
      },
      {
        headerName: "Actions",
        width: 180,
        minWidth: 180,
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

  const isFullWidthRow = useCallback((params) => !!params.rowNode.data?.isDetail, []);
  const fullWidthCellRenderer = useCallback(
    (params) => <MemberDetailRenderer data={params.data.parentData} />,
    []
  );

  const totalValue = rows.reduce((s, r) => s + Number(r.chitValue || 0), 0);

  const exportCsv = () => {
    const headers = ["#", "Name", "S/o or W/o", "Address", "City", "Phone", "Chit Value", "Status", "Members"];
    const lines = [headers.join(",")];
    rows.forEach((r) =>
      lines.push(
        [r.id, r.name, r.relation, r.address, r.city, r.phone, r.chitValue, r.status, membersSummary(r)]
          .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
          .join(",")
      )
    );
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "party_register.csv";
    a.click();
    URL.revokeObjectURL(url);
    showToast("CSV exported");
  };

  const exportExcel = () => {
    const data = rows.map((r) => ({
      "#": r.id,
      Name: r.name,
      "S/o or W/o": r.relation,
      Address: r.address,
      City: r.city,
      Phone: r.phone,
      "Chit Value": r.chitValue,
      Status: r.status,
      Members: membersSummary(r),
    }));
    const worksheet = XLSX.utils.json_to_sheet(data);
    worksheet["!cols"] = [
      { wch: 5 }, { wch: 22 }, { wch: 18 }, { wch: 28 },
      { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 45 },
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Party Register");
    XLSX.writeFile(workbook, "party_register.xlsx");
    showToast("Excel exported");
  };

  const exportPdf = () => {
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(14);
    doc.text("PPM Chit Funds — Party Register", 14, 16);
    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128);
    doc.text(
      `Total Parties: ${rows.length}   |   Total Chit Value: Rs.${totalValue.toLocaleString("en-IN")}`,
      14,
      22
    );

    autoTable(doc, {
      startY: 28,
      head: [["#", "Name", "S/o or W/o", "Address", "City", "Phone", "Chit Value", "Status", "Members"]],
      body: rows.map((r) => [
        r.id,
        r.name,
        r.relation || "",
        r.address || "",
        r.city || "",
        r.phone || "",
        `Rs.${Number(r.chitValue || 0).toLocaleString("en-IN")}`,
        r.status,
        membersSummary(r),
      ]),
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [29, 78, 216], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      columnStyles: { 8: { cellWidth: 70 } },
    });

    doc.save("party_register.pdf");
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
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: "#111827" }}>
              Party Register
            </h2>
            <span
              style={{
                fontSize: 11,
                letterSpacing: "1.2px",
                textTransform: "uppercase",
                color: "#6B7280",
              }}
            >
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
                placeholder="Quick search across all columns…"
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
              <button
                onClick={() => {
                  setEditingRow(null);
                  setModalOpen(true);
                }}
                style={pillBtn(BLUE, "#fff")}
              >
                <Plus size={14} /> Add Party
              </button>
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
                Loading party register…
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
                <button onClick={loadParties} style={pillBtn(BLUE, "#fff")}>
                  Retry
                </button>
              </div>
            )}
            <AgGridReact
              theme="legacy"
              ref={gridRef}
              rowData={displayRows}
              columnDefs={columnDefs}
              defaultColDef={defaultColDef}
              quickFilterText={quickFilter}
              context={{ openEdit, setDeletingRow, expandedIds, toggleExpand }}
              pagination={true}
              paginationPageSize={8}
              animateRows={true}
              rowHeight={52}
              headerHeight={46}
              isFullWidthRow={isFullWidthRow}
              fullWidthCellRenderer={fullWidthCellRenderer}
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
            }}
          >
            <div>
              Total Parties: <b style={{ color: BLUE }}>{rows.length}</b> &nbsp;·&nbsp; Total
              Chit Value: <b style={{ color: BLUE }}>₹{totalValue.toLocaleString("en-IN")}</b>
            </div>
          </div>
        </div>
      </div>

      <NewPartyModal
        key={resetKey}
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingRow(null);
        }}
        onSave={handleSaveParty}
        editingRow={editingRow}
        saving={saving}
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