import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import LoginPage from "./pages/Login";
import PartyMaster from "./pages/Partymaster";
import DashboardPage from "./pages/DashboardPage";
import UserManagement from "./pages/Usermanagement";
import AppLayout from "./Layout/AppLayout";

const API_BASE_URL = import.meta.env?.VITE_API_BASE_URL || "/api";

/**
 * Checks whether the user has a valid session by calling /api/auth/me.
 * The access token lives in an httpOnly cookie, so we can't read it directly —
 * we just ask the server "am I logged in?" and it answers based on the cookie.
 */
function useAuth() {
  const [status, setStatus] = useState("checking"); // "checking" | "authed" | "guest"
  const [user, setUser] = useState(null);

  useEffect(() => {
    let cancelled = false;

    fetch(`${API_BASE_URL}/auth/me`, {
      credentials: "include",
    })
      .then((res) => {
        if (!res.ok) throw new Error("not authed");
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        setUser(data);
        setStatus("authed");
      })
      .catch(() => {
        if (cancelled) return;
        setStatus("guest");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { status, user, setUser, setStatus };
}

function ProtectedRoute({ status, children }) {
  if (status === "checking") {
    return (
      <div
        style={{
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#6B7280",
          fontFamily: "'Segoe UI', sans-serif",
        }}
      >
        Checking session...
      </div>
    );
  }

  if (status === "guest") {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export default function App() {
  const { status, user, setUser, setStatus } = useAuth();

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={
            status === "authed" ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <LoginPage
                onLoginSuccess={(loggedInUser) => {
                  setUser(loggedInUser);
                  setStatus("authed");
                }}
              />
            )
          }
        />

        <Route
          element={
            <ProtectedRoute status={status}>
              <AppLayout user={user} />
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard" element={<DashboardPage user={user} />} />
          <Route path="/party-master" element={<PartyMaster />} />
          <Route
           path="/user-management"
           element={
             <UserManagement
               currentUserRole={user?.role}
               currentUserScreenOverrides={user?.screen_overrides}
             />
           }
           />

          {/* Placeholder routes so sidebar navigation doesn't break —
              swap these for real page components as you build them out */}
          {["/chit-groups", "/collections", "/payments", "/reports", "/settings"].map(
            (path) => (
              <Route
                key={path}
                path={path}
                element={
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      minHeight: "60vh",
                      color: "#6B7280",
                      fontFamily: "'Segoe UI', sans-serif",
                      fontSize: 14,
                    }}
                  >
                    {path.slice(1).replace("-", " ")} — coming soon.
                  </div>
                }
              />
            )
          )}
        </Route>

        {/* Default route: send people to dashboard if logged in, login page otherwise */}
        <Route
          path="/"
          element={<Navigate to={status === "authed" ? "/dashboard" : "/login"} replace />}
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}