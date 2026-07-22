import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { ApiError } from "../api/client";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";

interface LocationState {
  redirectTo?: string;
}

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(identifier, password);
      const state = location.state as LocationState | undefined;
      navigate(state?.redirectTo ?? "/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container-narrow" style={{ padding: "80px 0" }}>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <Card style={{ padding: 32 }}>
          <h1 style={{ fontSize: 26 }}>Welcome back</h1>
          <p style={{ marginBottom: 24 }}>Log in to manage your requests or jobs.</p>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <label className="label">
              Email or phone
              <input className="input" value={identifier} onChange={(e) => setIdentifier(e.target.value)} required />
            </label>
            <label className="label">
              Password
              <input
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>
            {error && <div className="error-text">{error}</div>}
            <Button type="submit" disabled={submitting} style={{ marginTop: 8 }}>
              {submitting ? "Logging in..." : "Log in"}
            </Button>
          </form>
          <p className="muted" style={{ marginTop: 20 }}>
            Don't have an account? <a href="/register" className="gradient-text" style={{ fontWeight: 600 }}>Sign up</a>
          </p>
        </Card>
      </motion.div>
    </div>
  );
}
