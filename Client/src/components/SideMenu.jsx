import React, { useState } from "react";
import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  Layers,
  Wallet,
  CreditCard,
  BarChart3,
  Settings,
  ChevronDown,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";

const NAVY = "#0F1740";
const BLUE = "#2354E6";

const navItems = [
  { label: "Dashboard", Icon: LayoutDashboard },
  { label: "Party Master", Icon: Users },
  { label: "Chit Groups", Icon: Layers },
  { label: "Collections", Icon: Wallet },
  { label: "Payments", Icon: CreditCard },
  { label: "Reports", Icon: BarChart3 },
  { label: "User Management", Icon: ShieldCheck },
  { label: "Settings", Icon: Settings },
];

/**
 * Sidebar navigation.
 *
 * Props:
 *  - activeItem: string — which label is currently highlighted (defaults to "Dashboard")
 *  - onNavigate: (label: string) => void — called when a nav item is clicked
 *  - onLogout: () => void — called when the logout button is clicked
 *  - onCompanyChange: (company: string) => void — called when a different company is selected
 *  - allowedCompanies: string[] — companies the logged-in user is permitted to access.
 *      super_admin users should be passed the full company list; everyone
 *      else gets only what was granted to them in User Management.
 */
export default function Sidebar({
  activeItem = "Dashboard",
  onNavigate,
  onLogout,
  onCompanyChange,
  allowedCompanies,
}) {
  // Fall back to a single safe default if nothing was passed in, so the
  // dropdown never silently shows companies the user isn't allowed to see.
  const companies =
    Array.isArray(allowedCompanies) && allowedCompanies.length > 0
      ? allowedCompanies
      : ["Company 1"];

  const [selectedCompany, setSelectedCompany] = useState(companies[0]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  function handleSelectCompany(company) {
    setSelectedCompany(company);
    setDropdownOpen(false);
    onCompanyChange && onCompanyChange(company);
  }

  return (
    <div
      style={{
        width: collapsed ? 68 : 220,
        flexShrink: 0,
        minHeight: "100vh",
        background: NAVY,
        color: "#c7cbe3",
        padding: "20px 12px",
        boxSizing: "border-box",
        fontFamily: "'Segoe UI', -apple-system, sans-serif",
        display: "flex",
        flexDirection: "column",
        transition: "width .15s ease",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: collapsed ? "center" : "space-between",
          padding: "6px 8px 22px",
        }}
      >
        {!collapsed && (
          <div style={{ color: "#fff", fontWeight: 800, fontSize: 18 }}>
            PPM Chits
          </div>
        )}
        <div
          onClick={() => setCollapsed((v) => !v)}
          title={collapsed ? "Expand" : "Collapse"}
          style={{
            color: "#aeb3d1",
            cursor: "pointer",
            display: "flex",
            padding: 4,
            borderRadius: 6,
          }}
        >
          {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
        </div>
      </div>

      {navItems.map(({ label, Icon }) => {
        const active = label === activeItem;
        return (
          <div
            key={label}
            onClick={() => onNavigate && onNavigate(label)}
            title={collapsed ? label : undefined}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: collapsed ? "center" : "flex-start",
              gap: 10,
              padding: "10px 12px",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: active ? 700 : 500,
              marginBottom: 2,
              cursor: "pointer",
              background: active ? BLUE : "transparent",
              color: active ? "#fff" : "#aeb3d1",
            }}
          >
            <Icon size={18} strokeWidth={2} style={{ flexShrink: 0 }} />
            {!collapsed && label}
          </div>
        );
      })}

      {/* Spacer pushes company selector + logout to the bottom */}
      <div style={{ flex: 1 }} />

      {/* Company selector dropdown */}
      <div style={{ position: "relative", marginBottom: 8 }}>
        <div
          onClick={() => companies.length > 1 && setDropdownOpen((v) => !v)}
          title={collapsed ? selectedCompany : undefined}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: collapsed ? "center" : "space-between",
            padding: "9px 10px",
            borderRadius: 8,
            background: "rgba(255,255,255,.06)",
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 600,
            color: "#e2e4f0",
          }}
        >
          {!collapsed && (
            <span
              style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {selectedCompany}
            </span>
          )}
          {!collapsed && companies.length > 1 && (
            <ChevronDown
              size={15}
              style={{
                flexShrink: 0,
                transform: dropdownOpen ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform .15s ease",
              }}
            />
          )}
        </div>

        {dropdownOpen && !collapsed && (
          <div
            style={{
              position: "absolute",
              bottom: "calc(100% + 4px)",
              left: 0,
              right: 0,
              background: "#1B2350",
              borderRadius: 8,
              overflow: "hidden",
              boxShadow: "0 -4px 16px rgba(0,0,0,.25)",
              zIndex: 10,
            }}
          >
            {companies.map((company) => (
              <div
                key={company}
                onClick={() => handleSelectCompany(company)}
                style={{
                  padding: "9px 12px",
                  fontSize: 13,
                  fontWeight: company === selectedCompany ? 700 : 500,
                  color: company === selectedCompany ? "#fff" : "#c7cbe3",
                  background: company === selectedCompany ? BLUE : "transparent",
                  cursor: "pointer",
                }}
              >
                {company}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Compact logout button */}
      <div
        onClick={onLogout}
        title={collapsed ? "Logout" : undefined}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: collapsed ? "center" : "flex-start",
          gap: 8,
          padding: "8px 10px",
          borderRadius: 8,
          fontSize: 13,
          fontWeight: 600,
          color: "#f1a4a4",
          cursor: "pointer",
        }}
      >
        <LogOut size={16} strokeWidth={2} />
        {!collapsed && "Logout"}
      </div>
    </div>
  );
}