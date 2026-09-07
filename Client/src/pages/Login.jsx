import React, { useState, useEffect } from "react";

/**
 * PPM GROUPS — Sign in
 * Palette: deep temple navy, aged gold, ivory, maroon ember accent
 * Signature: a slow, weighted "unveiling" entrance — the gold frame
 * draws itself in, then the card rises and settles like a held breath.
 */

const COLORS = {
  navy: "#101A3D",
  navyDeep: "#0A1230",
  gold: "#D4AF6A",
  goldSoft: "#E8CE9A",
  ivory: "#FBF6EC",
  ember: "#B0483E",
  teal: "#2E8B84",
  orchid: "#8C5CB8",
  rose: "#C9587A",
  ink: "#1B2340",
  muted: "#8A8FA8",
};

const CARD_WIDTH = 1080;
const CARD_HEIGHT = 640;
const MOBILE_BREAKPOINT = 720;

const API_BASE_URL = import.meta.env?.VITE_API_BASE_URL || "/api";

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth <= MOBILE_BREAKPOINT : false
  );
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= MOBILE_BREAKPOINT);
    window.addEventListener("resize", onResize);
    onResize();
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return isMobile;
}

function useMounted(delay = 0) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), delay);
    return () => clearTimeout(t);
  }, [delay]);
  return mounted;
}

const EASE_WEIGHTED = "cubic-bezier(0.16, 1, 0.3, 1)"; // slow start, settled landing

export default function LoginPage({ onLoginSuccess }) {
  const isMobile = useIsMobile();
  const mounted = useMounted(60);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [focusField, setFocusField] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMessage("");

    if (!email || !password) {
      setErrorMessage("Please enter both email and password.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setErrorMessage(data.error || "Unable to sign in. Please try again.");
        return;
      }

      if (onLoginSuccess) {
        onLoginSuccess(data.user);
      } else {
        window.location.href = "/dashboard";
      }
    } catch (err) {
      setErrorMessage("Could not reach the server. Please check your connection.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const fieldStyle = (name) => ({
    width: "100%",
    padding: "13px 16px",
    borderRadius: 10,
    border: `1.5px solid ${focusField === name ? COLORS.gold : "#E4E1D6"}`,
    fontSize: 14.5,
    outline: "none",
    boxSizing: "border-box",
    background: focusField === name ? "#FFFFFF" : "#FCFAF5",
    color: COLORS.ink,
    transition: "border-color 420ms " + EASE_WEIGHTED + ", background 420ms " + EASE_WEIGHTED,
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, Helvetica, Arial, sans-serif",
  });

  return (
    <div
      style={{
        minHeight: "100vh",
        height: isMobile ? "auto" : "100vh",
        overflow: isMobile ? "auto" : "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: isMobile ? "0 16px" : 24,
        background: `linear-gradient(160deg, #1B2559 0%, #241B4A 30%, ${COLORS.navyDeep} 60%, #2A1330 85%, #060A1C 100%)`,
        backgroundSize: "220% 220%",
        animation: "bgDrift 22s ease-in-out infinite",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, Helvetica, Arial, sans-serif",
        boxSizing: "border-box",
        position: "relative",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Inter:wght@400;500;600;700;800&display=swap');

        @keyframes cardRise {
          0% { opacity: 0; transform: translateY(28px) scale(0.985); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes frameDraw {
          0% { stroke-dashoffset: 620; opacity: 0.2; }
          100% { stroke-dashoffset: 0; opacity: 1; }
        }
        @keyframes fadeUp {
          0% { opacity: 0; transform: translateY(10px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes glowPulse {
          0%, 100% { opacity: 0.55; }
          50% { opacity: 1; }
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes bgDrift {
          0%   { background-position: 0% 30%; }
          50%  { background-position: 100% 70%; }
          100% { background-position: 0% 30%; }
        }
        @keyframes auraDrift1 {
          0%   { transform: translate(0, 0) scale(1); opacity: 0.5; }
          50%  { transform: translate(60px, 40px) scale(1.15); opacity: 0.75; }
          100% { transform: translate(0, 0) scale(1); opacity: 0.5; }
        }
        @keyframes auraDrift2 {
          0%   { transform: translate(0, 0) scale(1); opacity: 0.4; }
          50%  { transform: translate(-50px, -30px) scale(1.1); opacity: 0.6; }
          100% { transform: translate(0, 0) scale(1); opacity: 0.4; }
        }
        @keyframes raySpin {
          0%   { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes ringSpin {
          0%   { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes ringSpinReverse {
          0%   { transform: rotate(0deg); }
          100% { transform: rotate(-360deg); }
        }
        @keyframes moteRise {
          0%   { transform: translateY(0) translateX(0); opacity: 0; }
          10%  { opacity: 0.8; }
          90%  { opacity: 0.5; }
          100% { transform: translateY(-620px) translateX(20px); opacity: 0; }
        }
        @keyframes cardGlow {
          0%, 100% { box-shadow: 0 40px 90px rgba(3,6,20,0.55), 0 0 0 1px rgba(212,175,106,0.12), 0 0 40px rgba(212,175,106,0.0); }
          50%      { box-shadow: 0 40px 90px rgba(3,6,20,0.55), 0 0 0 1px rgba(212,175,106,0.28), 0 0 60px rgba(212,175,106,0.18); }
        }
        @keyframes cornerPulse {
          0%, 100% { opacity: 0.6; }
          50%      { opacity: 1; }
        }
        .ppm-field { transition: box-shadow 300ms ${EASE_WEIGHTED}; }
        .ppm-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 10px 24px rgba(212,175,106,0.35); }
        .ppm-btn:active:not(:disabled) { transform: translateY(0px) scale(0.99); }
        .ppm-link { position: relative; }
        .ppm-link::after {
          content: ""; position: absolute; left: 0; bottom: -2px; width: 100%; height: 1px;
          background: ${COLORS.gold}; transform: scaleX(0); transform-origin: right;
          transition: transform 320ms ${EASE_WEIGHTED};
        }
        .ppm-link:hover::after { transform: scaleX(1); transform-origin: left; }
        .ppm-mote {
          position: absolute;
          bottom: -20px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(232,206,154,0.9) 0%, rgba(232,206,154,0) 70%);
          animation-name: moteRise;
          animation-timing-function: ease-in;
          animation-iteration-count: infinite;
          pointer-events: none;
        }
        .ppm-mote--teal {
          background: radial-gradient(circle, rgba(90,190,182,0.85) 0%, rgba(90,190,182,0) 70%);
        }
        .ppm-mote--rose {
          background: radial-gradient(circle, rgba(214,120,150,0.85) 0%, rgba(214,120,150,0) 70%);
        }
        .ppm-mote--orchid {
          background: radial-gradient(circle, rgba(170,130,210,0.85) 0%, rgba(170,130,210,0) 70%);
        }
        @media (prefers-reduced-motion: reduce) {
          .ppm-anim, .ppm-anim *, .ppm-bg, .ppm-bg * { animation: none !important; transition: none !important; }
        }
      `}</style>

      {/* Ambient background layer — slow drifting aura, rotating rays, ornamental rings, rising motes */}
      <div className="ppm-bg" style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
        <div
          style={{
            position: "absolute", top: "-10%", left: "5%", width: 420, height: 420, borderRadius: "50%",
            background: "radial-gradient(circle, rgba(212,175,106,0.22) 0%, transparent 70%)",
            animation: "auraDrift1 16s ease-in-out infinite",
            filter: "blur(2px)",
          }}
        />
        <div
          style={{
            position: "absolute", bottom: "-15%", right: "8%", width: 500, height: 500, borderRadius: "50%",
            background: "radial-gradient(circle, rgba(176,72,62,0.2) 0%, transparent 70%)",
            animation: "auraDrift2 20s ease-in-out infinite",
            filter: "blur(2px)",
          }}
        />
        <div
          style={{
            position: "absolute", top: "20%", right: "-8%", width: 460, height: 460, borderRadius: "50%",
            background: "radial-gradient(circle, rgba(46,139,132,0.22) 0%, transparent 70%)",
            animation: "auraDrift1 24s ease-in-out infinite",
            animationDelay: "-6s",
            filter: "blur(2px)",
          }}
        />
        <div
          style={{
            position: "absolute", bottom: "10%", left: "-10%", width: 420, height: 420, borderRadius: "50%",
            background: "radial-gradient(circle, rgba(140,92,184,0.2) 0%, transparent 70%)",
            animation: "auraDrift2 18s ease-in-out infinite",
            animationDelay: "-4s",
            filter: "blur(2px)",
          }}
        />
        <div
          style={{
            position: "absolute", top: "50%", left: "40%", width: 380, height: 380, borderRadius: "50%",
            background: "radial-gradient(circle, rgba(201,88,122,0.16) 0%, transparent 70%)",
            animation: "auraDrift1 20s ease-in-out infinite",
            animationDelay: "-10s",
            filter: "blur(3px)",
          }}
        />

        {/* Slow-rotating gold sunburst rays, centered behind the card */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            width: 1400,
            height: 1400,
            marginLeft: -700,
            marginTop: -700,
            animation: "raySpin 90s linear infinite",
            opacity: 0.5,
          }}
        >
          <svg viewBox="0 0 1400 1400" width="1400" height="1400">
            <g opacity="0.35">
              {[...Array(24)].map((_, i) => (
                <line
                  key={i}
                  x1="700" y1="700"
                  x2={700 + 690 * Math.cos((i * Math.PI) / 12)}
                  y2={700 + 690 * Math.sin((i * Math.PI) / 12)}
                  stroke="url(#raygrad)"
                  strokeWidth="1.5"
                />
              ))}
            </g>
            <defs>
              <linearGradient id="raygrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="rgba(212,175,106,0.35)" />
                <stop offset="100%" stopColor="rgba(212,175,106,0)" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        {/* Two slow concentric ornamental rings drifting counter to each other */}
        <div
          style={{
            position: "absolute", top: "50%", left: "50%", width: 900, height: 900,
            marginLeft: -450, marginTop: -450,
            border: "1px solid rgba(212,175,106,0.14)",
            borderRadius: "50%",
            animation: "ringSpin 70s linear infinite",
          }}
        />
        <div
          style={{
            position: "absolute", top: "50%", left: "50%", width: 720, height: 720,
            marginLeft: -360, marginTop: -360,
            border: "1px dashed rgba(232,206,154,0.12)",
            borderRadius: "50%",
            animation: "ringSpinReverse 55s linear infinite",
          }}
        />

        {[...Array(14)].map((_, i) => {
          const left = (i * 7.3) % 100;
          const size = 2 + (i % 4);
          const duration = 9 + (i % 6) * 1.8;
          const delay = -(i * 1.7);
          const colorClass = ["", "ppm-mote--teal", "ppm-mote--rose", "ppm-mote--orchid"][i % 4];
          return (
            <span
              key={i}
              className={`ppm-mote ${colorClass}`}
              style={{
                left: `${left}%`,
                width: size,
                height: size,
                animationDuration: `${duration}s`,
                animationDelay: `${delay}s`,
              }}
            />
          );
        })}
      </div>

      <div
        style={{
          position: "relative",
          width: isMobile ? "92%" : CARD_WIDTH,
          maxWidth: "100%",
          margin: isMobile ? "32px 0" : 0,
        }}
      >
        <div
          className="ppm-anim"
          style={{
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            width: "100%",
            height: isMobile ? "auto" : CARD_HEIGHT,
            maxHeight: isMobile ? "none" : "100%",
            background: "#FFFFFF",
            borderRadius: 20,
            boxShadow: "0 40px 90px rgba(3,6,20,0.55), 0 0 0 1px rgba(212,175,106,0.12)",
            overflow: "hidden",
            flexShrink: 0,
            opacity: mounted ? 1 : 0,
            animation: mounted
              ? `cardRise 900ms ${EASE_WEIGHTED} both, cardGlow 6s ease-in-out 900ms infinite`
              : "none",
          }}
        >
        {/* Left panel — brand panel with ambient motion, no photo */}
        <div
          style={{
            width: isMobile ? "100%" : "40%",
            height: isMobile ? 220 : "100%",
            position: "relative",
            background: `linear-gradient(160deg, ${COLORS.navy} 0%, ${COLORS.navyDeep} 65%, #060A1C 100%)`,
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* ambient glow */}
          <div
            style={{
              position: "absolute",
              top: "-20%",
              left: "-10%",
              width: "70%",
              height: "70%",
              borderRadius: "50%",
              background: `radial-gradient(circle, rgba(212,175,106,0.35) 0%, transparent 70%)`,
              animation: mounted ? "glowPulse 5.5s ease-in-out infinite" : "none",
              pointerEvents: "none",
            }}
          />

          {/* Rotating gold sunburst — scaled to fit inside this panel, always visible */}
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              width: 900,
              height: 900,
              marginLeft: -450,
              marginTop: -450,
              animation: mounted ? "raySpin 70s linear infinite" : "none",
              opacity: 0.6,
              pointerEvents: "none",
            }}
          >
            <svg viewBox="0 0 900 900" width="900" height="900">
              <g opacity="0.6">
                {[...Array(20)].map((_, i) => (
                  <line
                    key={i}
                    x1="450" y1="450"
                    x2={450 + 440 * Math.cos((i * Math.PI) / 10)}
                    y2={450 + 440 * Math.sin((i * Math.PI) / 10)}
                    stroke="url(#panelraygrad)"
                    strokeWidth="1.4"
                  />
                ))}
              </g>
              <defs>
                <linearGradient id="panelraygrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="rgba(232,206,154,0.7)" />
                  <stop offset="100%" stopColor="rgba(232,206,154,0)" />
                </linearGradient>
              </defs>
            </svg>
          </div>

          {/* Counter-spinning ornamental ring */}
          <div
            style={{
              position: "absolute", top: "50%", left: "50%", width: 560, height: 560,
              marginLeft: -280, marginTop: -280,
              border: "1.5px dashed rgba(232,206,154,0.5)",
              borderRadius: "50%",
              animation: mounted ? "ringSpinReverse 45s linear infinite" : "none",
              pointerEvents: "none",
            }}
          />

          {/* A second, smaller counter-ring for depth */}
          <div
            style={{
              position: "absolute", top: "50%", left: "50%", width: 380, height: 380,
              marginLeft: -190, marginTop: -190,
              border: "1px solid rgba(212,175,106,0.35)",
              borderRadius: "50%",
              animation: mounted ? "ringSpin 32s linear infinite" : "none",
              pointerEvents: "none",
            }}
          />

          {/* Rising light motes, confined to this panel */}
          <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
            {[...Array(8)].map((_, i) => {
              const left = (i * 13 + 6) % 100;
              const size = 3 + (i % 3);
              const duration = 7 + (i % 4) * 1.6;
              const delay = -(i * 1.4);
              const colorClass = ["", "ppm-mote--teal", "ppm-mote--rose", "ppm-mote--orchid"][i % 4];
              return (
                <span
                  key={`panel-mote-${i}`}
                  className={`ppm-mote ${colorClass}`}
                  style={{
                    left: `${left}%`,
                    width: size,
                    height: size,
                    opacity: 0.9,
                    animationDuration: mounted ? `${duration}s` : "0s",
                    animationDelay: `${delay}s`,
                    animationPlayState: mounted ? "running" : "paused",
                  }}
                />
              );
            })}
          </div>

          {/* Drawn gold corner frame — the signature motion */}
          <svg
            viewBox="0 0 400 640"
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
          >
            <rect
              x="18" y="18" width="364" height="604" rx="6"
              fill="none" stroke={COLORS.gold} strokeWidth="1.4"
              strokeDasharray="620"
              style={{
                strokeDashoffset: mounted ? 0 : 620,
                opacity: mounted ? 1 : 0,
                transition: `stroke-dashoffset 1500ms ${EASE_WEIGHTED} 250ms, opacity 200ms linear 250ms`,
              }}
            />
          </svg>

          {/* Company name — now the panel's main content instead of a photo */}
          <div
            style={{
              position: "relative",
              zIndex: 1,
              textAlign: "center",
              padding: "0 28px",
              opacity: mounted ? 1 : 0,
              transform: mounted ? "translateY(0)" : "translateY(10px)",
              transition: `opacity 800ms ${EASE_WEIGHTED} 400ms, transform 800ms ${EASE_WEIGHTED} 400ms`,
            }}
          >
            <div
              style={{
                width: 46,
                height: 46,
                margin: "0 auto 18px",
                borderRadius: "50%",
                border: `1.5px solid ${COLORS.gold}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "'Cormorant Garamond', Georgia, serif",
                fontSize: 20,
                fontWeight: 700,
                color: COLORS.goldSoft,
              }}
            >
              P
            </div>
            <div
              style={{
                fontFamily: "'Cormorant Garamond', Georgia, serif",
                fontSize: isMobile ? 30 : 34,
                fontWeight: 700,
                color: COLORS.ivory,
                letterSpacing: 0.5,
                lineHeight: 1.15,
              }}
            >
              P.P.M Groups
            </div>
            <div
              style={{
                marginTop: 8,
                fontSize: 12,
                color: COLORS.goldSoft,
                letterSpacing: 2.2,
                textTransform: "uppercase",
                fontWeight: 600,
              }}
            >
              Trust · Service · Devotion
            </div>
            <div
              style={{
                marginTop: 16,
                fontSize: 13.5,
                color: "rgba(251,246,236,0.65)",
                lineHeight: 1.6,
                maxWidth: 280,
                marginLeft: "auto",
                marginRight: "auto",
              }}
            >
              Building lasting value for our members through integrity,
              craftsmanship, and community since our founding.
            </div>
          </div>
        </div>

        {/* Right panel — form */}
        <form
          onSubmit={handleSubmit}
          style={{
            width: isMobile ? "100%" : "60%",
            height: isMobile ? "auto" : "100%",
            padding: isMobile ? "32px 26px" : "44px 64px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            boxSizing: "border-box",
            overflowY: isMobile ? "visible" : "auto",
            background: "#FFFFFF",
          }}
        >
          <div
            style={{
              opacity: mounted ? 1 : 0,
              transform: mounted ? "translateY(0)" : "translateY(8px)",
              transition: `opacity 600ms ${EASE_WEIGHTED} 380ms, transform 600ms ${EASE_WEIGHTED} 380ms`,
            }}
          >
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                background: `linear-gradient(135deg, ${COLORS.navy}, ${COLORS.navyDeep})`,
                color: COLORS.goldSoft,
                fontWeight: 700,
                fontSize: 12.5,
                letterSpacing: 1.2,
                padding: "7px 16px",
                borderRadius: 100,
                marginBottom: 22,
                border: `1px solid rgba(212,175,106,0.4)`,
              }}
            >
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: COLORS.gold }} />
              MEMBER SIGN IN
            </div>

            <h1
              style={{
                fontFamily: "'Cormorant Garamond', Georgia, serif",
                fontSize: isMobile ? 30 : 36,
                fontWeight: 700,
                margin: "0 0 6px",
                color: COLORS.ink,
                letterSpacing: 0.2,
              }}
            >
              Welcome back
            </h1>
            <p style={{ color: COLORS.muted, margin: "0 0 28px", fontSize: 14.5 }}>
              Sign in to continue to your PPM Groups account.
            </p>
          </div>

          {errorMessage && (
            <div
              style={{
                width: "100%",
                background: "#FBEAEA",
                color: COLORS.ember,
                fontSize: 13,
                fontWeight: 600,
                borderRadius: 10,
                padding: "11px 14px",
                marginBottom: 16,
                boxSizing: "border-box",
                textAlign: "left",
                animation: `fadeUp 340ms ${EASE_WEIGHTED} both`,
                borderLeft: `3px solid ${COLORS.ember}`,
              }}
              role="alert"
            >
              {errorMessage}
            </div>
          )}

          <div
            style={{
              width: "100%",
              marginBottom: 16,
              opacity: mounted ? 1 : 0,
              transform: mounted ? "translateY(0)" : "translateY(8px)",
              transition: `opacity 600ms ${EASE_WEIGHTED} 460ms, transform 600ms ${EASE_WEIGHTED} 460ms`,
            }}
          >
            <label htmlFor="email" style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 6, color: COLORS.ink }}>
              Email address
            </label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onFocus={() => setFocusField("email")}
              onBlur={() => setFocusField(null)}
              disabled={isSubmitting}
              className="ppm-field"
              style={fieldStyle("email")}
              placeholder="you@company.com"
            />
          </div>

          <div
            style={{
              width: "100%",
              marginBottom: 16,
              opacity: mounted ? 1 : 0,
              transform: mounted ? "translateY(0)" : "translateY(8px)",
              transition: `opacity 600ms ${EASE_WEIGHTED} 540ms, transform 600ms ${EASE_WEIGHTED} 540ms`,
            }}
          >
            <label htmlFor="password" style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 6, color: COLORS.ink }}>
              Password
            </label>
            <div style={{ position: "relative" }}>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setFocusField("password")}
                onBlur={() => setFocusField(null)}
                disabled={isSubmitting}
                className="ppm-field"
                style={{ ...fieldStyle("password"), paddingRight: 46 }}
                placeholder="Enter your password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                style={{
                  position: "absolute",
                  right: 12,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: COLORS.muted,
                  fontSize: 12.5,
                  fontWeight: 600,
                  padding: 4,
                }}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <div
            style={{
              width: "100%",
              display: "flex",
              flexDirection: isMobile ? "column" : "row",
              alignItems: isMobile ? "flex-start" : "center",
              justifyContent: "space-between",
              gap: isMobile ? 10 : 0,
              fontSize: 13,
              marginBottom: 22,
              opacity: mounted ? 1 : 0,
              transition: `opacity 600ms ${EASE_WEIGHTED} 600ms`,
            }}
          >
            <label style={{ display: "flex", alignItems: "center", gap: 7, color: COLORS.ink, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                style={{ accentColor: COLORS.navy }}
              />
              Remember me
            </label>
            <a href="#" className="ppm-link" style={{ color: COLORS.navy, fontWeight: 700, textDecoration: "none" }}>
              Forgot password?
            </a>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="ppm-btn"
            style={{
              width: "100%",
              padding: 14,
              border: "none",
              borderRadius: 10,
              background: isSubmitting
                ? "#3A4694"
                : `linear-gradient(135deg, ${COLORS.navy}, ${COLORS.navyDeep})`,
              color: COLORS.ivory,
              fontWeight: 800,
              fontSize: 15,
              letterSpacing: 0.3,
              cursor: isSubmitting ? "not-allowed" : "pointer",
              boxSizing: "border-box",
              boxShadow: "0 6px 16px rgba(16,26,61,0.25)",
              transition: `transform 260ms ${EASE_WEIGHTED}, box-shadow 260ms ${EASE_WEIGHTED}, background 260ms`,
              opacity: mounted ? 1 : 0,
              transform: mounted ? "translateY(0)" : "translateY(8px)",
              transitionDelay: mounted ? "660ms" : "0ms",
            }}
          >
            {isSubmitting ? "Signing in…" : "Sign in"}
          </button>

          <div
            style={{
              marginTop: 18,
              fontSize: 12.5,
              color: COLORS.muted,
              textAlign: "center",
              opacity: mounted ? 1 : 0,
              transition: `opacity 600ms ${EASE_WEIGHTED} 720ms`,
            }}
          >
            Protected access for P.P.M Groups members only.
          </div>
        </form>
        </div>

        {/* Four animated corner ornaments framing the whole card, drawn in with a stagger */}
        {[
          { top: -10, left: -10, rotate: 0, delay: 900 },
          { top: -10, right: -10, rotate: 90, delay: 1000 },
          { bottom: -10, right: -10, rotate: 180, delay: 1100 },
          { bottom: -10, left: -10, rotate: 270, delay: 1200 },
        ].map((c, i) => (
          <svg
            key={i}
            viewBox="0 0 60 60"
            width="46"
            height="46"
            style={{
              position: "absolute",
              top: c.top,
              left: c.left,
              right: c.right,
              bottom: c.bottom,
              transform: `rotate(${c.rotate}deg)`,
              pointerEvents: "none",
              opacity: mounted ? 1 : 0,
              transition: `opacity 300ms linear ${c.delay}ms`,
            }}
          >
            <path
              d="M4 40 L4 12 Q4 4 12 4 L40 4"
              fill="none"
              stroke={COLORS.gold}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray="60"
              style={{
                strokeDashoffset: mounted ? 0 : 60,
                animation: mounted ? `cornerPulse 4.5s ease-in-out ${c.delay + 400}ms infinite` : "none",
                transition: `stroke-dashoffset 700ms ${EASE_WEIGHTED} ${c.delay}ms`,
              }}
            />
          </svg>
        ))}
      </div>

      {/* Foreground ambient layer — motes drifting over the whole viewport, including across the card */}
      <div
        className="ppm-bg"
        style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 5 }}
      >
        {[...Array(10)].map((_, i) => {
          const left = (i * 11.4 + 4) % 100;
          const size = 2 + (i % 3);
          const duration = 12 + (i % 5) * 2.2;
          const delay = -(i * 2.3);
          const colorClass = ["", "ppm-mote--teal", "ppm-mote--rose", "ppm-mote--orchid"][i % 4];
          return (
            <span
              key={`fg-${i}`}
              className={`ppm-mote ${colorClass}`}
              style={{
                left: `${left}%`,
                width: size,
                height: size,
                opacity: 0.7,
                animationDuration: `${duration}s`,
                animationDelay: `${delay}s`,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}