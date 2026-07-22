import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { fetchMyProviderProfile, setOnlineStatus, fetchProviderEarnings, type ProviderProfile, type ProviderEarnings } from "../api/providers";
import { ApiError } from "../api/client";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge, statusTone } from "../components/ui/Badge";

export function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProviderProfile | null>(null);
  const [earnings, setEarnings] = useState<ProviderEarnings | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.role === "PROVIDER") {
      fetchMyProviderProfile().then((res) => setProfile(res.profile));
      fetchProviderEarnings().then((res) => setEarnings(res.earnings));
    }
  }, [user]);

  async function handleToggleOnline() {
    setError(null);
    try {
      const res = await setOnlineStatus(!profile?.isOnline);
      setProfile(res.profile);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    }
  }

  if (!user) return null;

  return (
    <div className="container-narrow" style={{ padding: "60px 0" }}>
      <h1 style={{ fontSize: 28 }}>
        Welcome, <span className="gradient-text">{user.fullName.split(" ")[0]}</span>
      </h1>
      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        <Badge>{user.role}</Badge>
        <Badge tone={statusTone(user.status)}>{user.status}</Badge>
      </div>

      {user.role === "CUSTOMER" && (
        <Card style={{ padding: 24, marginBottom: 16 }}>
          <h3 style={{ marginBottom: 6 }}>Requests</h3>
          <p>View or track the services you've requested.</p>
          <div style={{ display: "flex", gap: 10 }}>
            <Button onClick={() => navigate("/requests/mine")}>My requests</Button>
            <Button variant="secondary" onClick={() => navigate("/requests/new")}>
              + New request
            </Button>
          </div>
        </Card>
      )}

      {user.role === "ADMIN" && (
        <Card style={{ padding: 24, marginBottom: 16 }}>
          <h3 style={{ marginBottom: 6 }}>Admin console</h3>
          <p>Manage provider verification, the service catalogue, and platform analytics.</p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Button onClick={() => navigate("/admin/verifications")}>Verification queue</Button>
            <Button variant="secondary" onClick={() => navigate("/admin/analytics")}>
              Analytics
            </Button>
            <Button variant="secondary" onClick={() => navigate("/admin/catalogue")}>
              Catalogue
            </Button>
          </div>
        </Card>
      )}

      {user.role === "PROVIDER" && (
        <Card style={{ padding: 24, marginBottom: 16 }}>
          {!profile?.submittedAt && (
            <>
              <h3 style={{ marginBottom: 6 }}>Finish setting up</h3>
              <p>Complete onboarding to start receiving job requests.</p>
              <Button onClick={() => navigate("/provider/onboarding")}>Complete your provider onboarding</Button>
            </>
          )}
          {profile?.submittedAt && profile.verificationStatus === "PENDING_VERIFICATION" && (
            <>
              <h3 style={{ marginBottom: 6 }}>Application under review</h3>
              <p>An admin will review your documents shortly.</p>
            </>
          )}
          {profile?.verificationStatus === "REJECTED" && (
            <>
              <h3 style={{ marginBottom: 6, color: "var(--danger)" }}>Application rejected</h3>
              <p className="error-text">{profile.rejectionReason}</p>
            </>
          )}
          {profile?.verificationStatus === "APPROVED" && (
            <div>
              <h3 style={{ marginBottom: 6 }}>You're verified ✅</h3>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 4 }}>
                <Button variant={profile.isOnline ? "danger" : "primary"} onClick={handleToggleOnline}>
                  {profile.isOnline ? "Go offline" : "Go online"}
                </Button>
                <Button variant="secondary" onClick={() => navigate("/provider/available")}>
                  Available requests
                </Button>
                <Button variant="secondary" onClick={() => navigate("/provider/jobs")}>
                  My jobs
                </Button>
                <Button variant="secondary" onClick={() => navigate("/provider/services")}>
                  Services & coverage area
                </Button>
              </div>
              {earnings && (
                <div style={{ display: "flex", gap: 24, marginTop: 16, borderTop: "1px solid var(--border)", paddingTop: 16 }}>
                  <div>
                    <div className="muted" style={{ fontSize: 12 }}>Total earnings</div>
                    <div style={{ fontSize: 20, fontWeight: 700 }}>
                      PKR {(earnings.totalEarnings / 100).toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="muted" style={{ fontSize: 12 }}>Pending</div>
                    <div style={{ fontSize: 20, fontWeight: 700 }}>
                      PKR {(earnings.pendingEarnings / 100).toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="muted" style={{ fontSize: 12 }}>Jobs paid</div>
                    <div style={{ fontSize: 20, fontWeight: 700 }}>{earnings.jobsPaid}</div>
                  </div>
                </div>
              )}
            </div>
          )}
          {error && <p className="error-text">{error}</p>}
        </Card>
      )}
    </div>
  );
}
