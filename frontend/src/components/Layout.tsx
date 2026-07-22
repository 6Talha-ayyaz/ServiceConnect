import { type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Button } from "./ui/Button";
import { NotificationBell } from "./NotificationBell";

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/");
  }

  return (
    <div style={{ minHeight: "100%", display: "flex", flexDirection: "column" }}>
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          background: "rgba(255, 250, 245, 0.85)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div
          className="container"
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 68, flexWrap: "wrap", gap: 8 }}
        >
          <Link to="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                width: 30,
                height: 30,
                borderRadius: 9,
                background: "var(--accent-gradient)",
                display: "inline-block",
              }}
            />
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18, color: "var(--text-0)" }}>
              Service<span className="gradient-text">Connect</span>
            </span>
          </Link>

          <nav style={{ display: "flex", alignItems: "center", gap: 20, fontSize: 14 }}>
            <Link to="/#categories" className="nav-link-secondary" style={{ textDecoration: "none", color: "var(--text-1)" }}>
              Browse services
            </Link>
            <Link to="/#how-it-works" className="nav-link-secondary" style={{ textDecoration: "none", color: "var(--text-1)" }}>
              How it works
            </Link>
            {!user && (
              <Link to="/register?role=PROVIDER" className="nav-link-secondary" style={{ textDecoration: "none", color: "var(--text-1)" }}>
                Become a provider
              </Link>
            )}

            {user ? (
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <NotificationBell />
                <Link to="/dashboard" style={{ textDecoration: "none" }}>
                  <Button variant="secondary" size="sm">
                    Dashboard
                  </Button>
                </Link>
                <Button variant="ghost" size="sm" onClick={handleLogout}>
                  Log out
                </Button>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Link to="/login" style={{ textDecoration: "none" }}>
                  <Button variant="ghost" size="sm">
                    Log in
                  </Button>
                </Link>
                <Link to="/register" style={{ textDecoration: "none" }}>
                  <Button variant="primary" size="sm">
                    Sign up
                  </Button>
                </Link>
              </div>
            )}
          </nav>
        </div>
      </header>

      <main style={{ flex: 1 }}>{children}</main>

      <footer style={{ borderTop: "1px solid var(--border)", padding: "28px 0", marginTop: 60 }}>
        <div className="container muted" style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <span>© {new Date().getFullYear()} ServiceConnect. All rights reserved.</span>
          <span>Built for local service providers and the customers who need them.</span>
        </div>
      </footer>
    </div>
  );
}
