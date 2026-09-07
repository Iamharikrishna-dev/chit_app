import React from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import Sidebar from "../components/SideMenu";
import Header from "../components/Header";

const API_BASE_URL = import.meta.env?.VITE_API_BASE_URL || "/api";

const routeMap = {
  Dashboard: "/dashboard",
  "Party Master": "/party-master",
  "Chit Groups": "/chit-groups",
  Collections: "/collections",
  Payments: "/payments",
  Reports: "/reports",
  "User Management": "/user-management",
  Settings: "/settings",
};
const labelForPath = Object.fromEntries(Object.entries(routeMap).map(([k, v]) => [v, k]));

export default function AppLayout({ user }) {
  const navigate = useNavigate();
  const location = useLocation();

  async function handleLogout() {
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, { method: "POST", credentials: "include" });
    } finally {
      navigate("/login", { replace: true });
      window.location.reload();
    }
  }

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      <Sidebar
        activeItem={labelForPath[location.pathname] || "Dashboard"}
        onNavigate={(label) => routeMap[label] && navigate(routeMap[label])}
        onLogout={handleLogout}
        onCompanyChange={(c) => console.log("Switched to:", c)}
        allowedCompanies={user?.companies}
      />
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <Header user={user} />
        <div style={{ flex: 1, overflowY: "auto" }}>
          <Outlet context={{ user }} />
        </div>
      </div>
    </div>
  );
}