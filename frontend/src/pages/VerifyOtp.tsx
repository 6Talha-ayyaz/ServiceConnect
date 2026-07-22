import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { verifyOtp, resendOtp } from "../api/auth";
import { ApiError } from "../api/client";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";

interface LocationState {
  userId: string;
  devOtp?: string;
}

export function VerifyOtpPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as LocationState | undefined;

  const [code, setCode] = useState(state?.devOtp ?? "");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(state?.devOtp ? `Dev mode: your OTP is ${state.devOtp}` : null);
  const [submitting, setSubmitting] = useState(false);

  if (!state?.userId) {
    return (
      <div className="container-narrow" style={{ padding: "80px 0" }}>
        <Card style={{ padding: 32 }}>
          <p>
            No pending verification. Please <a href="/register" className="gradient-text">register</a> first.
          </p>
        </Card>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await verifyOtp({ userId: state!.userId, code });
      navigate("/login");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    setError(null);
    try {
      const res = await resendOtp(state!.userId);
      setInfo(res.devOtp ? `Dev mode: your new OTP is ${res.devOtp}` : "A new code has been sent.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    }
  }

  return (
    <div className="container-narrow" style={{ padding: "80px 0" }}>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <Card style={{ padding: 32 }}>
          <h1 style={{ fontSize: 24 }}>Verify your phone</h1>
          <p style={{ marginBottom: 20 }}>Enter the 6-digit code sent to your phone.</p>
          {info && <p className="success-text" style={{ marginBottom: 10 }}>{info}</p>}
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <input
              className="input"
              placeholder="6-digit code"
              value={code}
              maxLength={6}
              onChange={(e) => setCode(e.target.value)}
              required
              style={{ textAlign: "center", fontSize: 20, letterSpacing: 6 }}
            />
            {error && <div className="error-text">{error}</div>}
            <Button type="submit" disabled={submitting}>
              {submitting ? "Verifying..." : "Verify"}
            </Button>
            <Button type="button" variant="secondary" onClick={handleResend}>
              Resend code
            </Button>
          </form>
        </Card>
      </motion.div>
    </div>
  );
}
