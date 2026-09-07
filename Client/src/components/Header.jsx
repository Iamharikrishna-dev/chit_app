import React from "react";
import { Bell, UserCircle } from "lucide-react";

const NAVY = "#294b99ff";
const YELLOW = "#FBBF24";

export default function Header({ title = "PPM Chit Funds", user }) {
  return (
    <div style={{ position: "sticky", top: 0, zIndex: 20, flexShrink: 0 }}>
      <div
        style={{
          background: NAVY,
          color: "#fff",
          padding: "14px 26px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>{title}</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <Bell size={18} />
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <UserCircle size={20} />
            <span style={{ fontSize: 13.5, fontWeight: 500 }}>
              {user?.name ? `Hi, ${user.name}` : "Admin"}
            </span>
          </div>
        </div>
      </div>
      <div style={{ height: 4, background: YELLOW }} />
    </div>
  );
}