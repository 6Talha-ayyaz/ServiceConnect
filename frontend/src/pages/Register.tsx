import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { register, type RegisterRole } from "../api/auth";
import { ApiError } from "../api/client";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";

export function RegisterPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialRole = searchParams.get("role") === "PROVIDER" ? "PROVIDER" : "CUSTOMER";
  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    email: "",
    password: "",
    role: initialRole as RegisterRole,
  });
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setDetails([]);
    setSubmitting(true);
    try {
      const res = await register(form);
      navigate("/verify-otp", { state: { userId: res.user.id, devOtp: res.devOtp } });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setDetails(err.details);
      } else {
        setError("Something went wrong.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container-narrow" style={{ padding: "80px 0" }}>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <Card style={{ padding: 32 }}>
          <h1 style={{ fontSize: 26 }}>Create your account</h1>
          <p style={{ marginBottom: 24 }}>Join as a customer or start getting jobs as a provider.</p>

          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            <button
              type="button"
              onClick={() => setForm({ ...form, role: "CUSTOMER" })}
              className={`btn ${form.role === "CUSTOMER" ? "btn-primary" : "btn-secondary"}`}
              style={{ flex: 1 }}
            >
              I need a service
            </button>
            <button
              type="button"
              onClick={() => setForm({ ...form, role: "PROVIDER" })}
              className={`btn ${form.role === "PROVIDER" ? "btn-primary" : "btn-secondary"}`}
              style={{ flex: 1 }}
            >
              I provide services
            </button>
          </div>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <label className="label">
              Full name
              <input
                className="input"
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                required
              />
            </label>
            <label className="label">
              Phone
              <input
                className="input"
                placeholder="+923001234567"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                required
              />
            </label>
            <label className="label">
              Email
              <input
                className="input"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </label>
            <label className="label">
              Password
              <input
                className="input"
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
              />
            </label>
            {error && (
              <div className="error-text">
                {error}
                {details.length > 0 && (
                  <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                    {details.map((d, i) => (
                      <li key={i}>{d}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            <Button type="submit" disabled={submitting} style={{ marginTop: 8 }}>
              {submitting ? "Creating..." : "Sign up"}
            </Button>
          </form>
          <p className="muted" style={{ marginTop: 20 }}>
            Already have an account? <a href="/login" className="gradient-text" style={{ fontWeight: 600 }}>Log in</a>
          </p>
        </Card>
      </motion.div>
    </div>
  );
}
