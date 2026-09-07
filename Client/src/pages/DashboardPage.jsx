import React from "react";
import { useOutletContext } from "react-router-dom";

export default function DashboardPage() {
  useOutletContext(); // user already shown in the shared Header

  return (
    <div
      style={{
        padding: 24,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh",
        color: "#9aa0af",
        fontSize: 14,
        fontFamily: "'Segoe UI', -apple-system, sans-serif",
        background: "#F5F6FA",
      }}
    >
      Content coming soon.
    </div>
  );
}