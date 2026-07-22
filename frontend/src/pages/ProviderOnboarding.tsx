import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ApiError } from "../api/client";
import {
  fetchCategories,
  fetchMyProviderProfile,
  savePersonalDetails,
  saveServices,
  saveCoverage,
  uploadDocument,
  acceptTerms,
  submitForVerification,
  type Category,
  type ProviderProfile,
} from "../api/providers";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge, statusTone } from "../components/ui/Badge";
import { MapPicker } from "../components/map/MapPicker";

const STEPS = ["Personal Details", "Services & Pricing", "Coverage Area", "Documents", "Review & Submit"];

export function ProviderOnboardingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [profile, setProfile] = useState<ProviderProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [personal, setPersonal] = useState({ legalName: "", cnic: "", dateOfBirth: "", yearsExperience: 0, bio: "" });
  const [selectedServices, setSelectedServices] = useState<Record<string, { checked: boolean; price: number }>>({});
  const [coverage, setCoverage] = useState({ baseLat: 31.5204, baseLng: 74.3587, baseAddress: "Lahore, Pakistan", radiusKm: 10 });
  const [recenterSignal, setRecenterSignal] = useState(0);
  const [documentUploaded, setDocumentUploaded] = useState(false);
  const [tosAccepted, setTosAccepted] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [cats, prof] = await Promise.all([fetchCategories(), fetchMyProviderProfile()]);
        setCategories(cats.categories);
        setProfile(prof.profile);
        if (prof.profile) {
          setDocumentUploaded(prof.profile.documents.length > 0);
          setTosAccepted(!!prof.profile.tosAcceptedAt);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <p className="muted" style={{ textAlign: "center", marginTop: 40 }}>Loading...</p>;

  if (profile?.submittedAt) {
    return (
      <div className="container-narrow" style={{ padding: "60px 0" }}>
        <Card style={{ padding: 32 }}>
          <h1 style={{ fontSize: 24 }}>Application submitted</h1>
          <div style={{ margin: "10px 0" }}>
            <Badge tone={statusTone(profile.verificationStatus)}>{profile.verificationStatus}</Badge>
          </div>
          {profile.verificationStatus === "REJECTED" && profile.rejectionReason && (
            <p className="error-text">Reason: {profile.rejectionReason}</p>
          )}
          {profile.verificationStatus === "PENDING_VERIFICATION" && <p>An admin will review your application shortly.</p>}
          {profile.verificationStatus === "APPROVED" && (
            <Button onClick={() => navigate("/dashboard")}>Go to dashboard</Button>
          )}
        </Card>
      </div>
    );
  }

  async function handlePersonalSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await savePersonalDetails(personal);
      setStep(1);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    }
  }

  async function handleServicesSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const chosen = Object.entries(selectedServices)
      .filter(([, v]) => v.checked)
      .map(([subServiceId, v]) => ({ subServiceId, pricingModel: "FIXED", basePrice: Math.round(v.price * 100) }));
    if (chosen.length === 0) {
      setError("Select at least one service.");
      return;
    }
    try {
      await saveServices(chosen);
      setStep(2);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    }
  }

  async function handleCoverageSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await saveCoverage(coverage);
      setStep(3);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      await uploadDocument("ID_FRONT", file);
      setDocumentUploaded(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Upload failed.");
    }
  }

  async function handleAcceptTerms() {
    setError(null);
    try {
      await acceptTerms();
      setTosAccepted(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    }
  }

  async function handleFinalSubmit() {
    setError(null);
    try {
      const res = await submitForVerification();
      setProfile(res.profile);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(`${err.message}${err.details.length ? " " + err.details.join(" ") : ""}`);
      } else {
        setError("Something went wrong.");
      }
    }
  }

  return (
    <div className="container-narrow" style={{ padding: "60px 0" }}>
      <h1 style={{ fontSize: 26 }}>Become a provider</h1>
      <p style={{ marginBottom: 20 }}>Welcome, {user?.fullName}. Just a few steps to start getting jobs.</p>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 24 }}>
        {STEPS.map((s, i) => (
          <div key={s} style={{ display: "flex", alignItems: "center", flex: i < STEPS.length - 1 ? 1 : "0 0 auto" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 13,
                  fontWeight: 700,
                  background: i < step ? "var(--success)" : i === step ? "var(--accent-gradient)" : "var(--bg-1)",
                  color: i <= step ? "#ffffff" : "var(--text-2)",
                  border: i === step ? "none" : "1px solid var(--border)",
                }}
              >
                {i < step ? "✓" : i + 1}
              </div>
              <span
                className="muted"
                style={{ fontSize: 11, textAlign: "center", maxWidth: 80, color: i === step ? "var(--text-0)" : undefined, fontWeight: i === step ? 600 : undefined }}
              >
                {s}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div style={{ flex: 1, height: 2, background: i < step ? "var(--success)" : "var(--border)", margin: "0 6px 18px" }} />
            )}
          </div>
        ))}
      </div>

      <Card style={{ padding: 28 }}>
        {error && <div className="error-text" style={{ marginBottom: 12 }}>{error}</div>}

        {step === 0 && (
          <form onSubmit={handlePersonalSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <input className="input" placeholder="Legal name" required value={personal.legalName} onChange={(e) => setPersonal({ ...personal, legalName: e.target.value })} />
            <input className="input" placeholder="CNIC / National ID" required value={personal.cnic} onChange={(e) => setPersonal({ ...personal, cnic: e.target.value })} />
            <label className="label">
              Date of birth
              <input className="input" type="date" required value={personal.dateOfBirth} onChange={(e) => setPersonal({ ...personal, dateOfBirth: e.target.value })} />
            </label>
            <input className="input" type="number" placeholder="Years of experience" value={personal.yearsExperience} onChange={(e) => setPersonal({ ...personal, yearsExperience: Number(e.target.value) })} />
            <textarea className="input" placeholder="Short bio (max 500 chars)" maxLength={500} value={personal.bio} onChange={(e) => setPersonal({ ...personal, bio: e.target.value })} />
            <Button type="submit">Next</Button>
          </form>
        )}

        {step === 1 && (
          <form onSubmit={handleServicesSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {categories.map((cat) => (
              <fieldset key={cat.id} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 14 }}>
                <legend style={{ padding: "0 6px" }}>{cat.icon} {cat.name}</legend>
                {cat.subServices.map((s) => {
                  const entry = selectedServices[s.id] ?? { checked: false, price: 0 };
                  return (
                    <div key={s.id} style={{ display: "flex", gap: 8, alignItems: "center", margin: "6px 0" }}>
                      <label style={{ flex: 1, display: "flex", alignItems: "center", gap: 8 }}>
                        <input
                          type="checkbox"
                          checked={entry.checked}
                          onChange={(e) =>
                            setSelectedServices({ ...selectedServices, [s.id]: { ...entry, checked: e.target.checked } })
                          }
                        />
                        {s.name}
                      </label>
                      {entry.checked && (
                        <input
                          className="input"
                          type="number"
                          placeholder="Price (PKR)"
                          value={entry.price}
                          onChange={(e) =>
                            setSelectedServices({ ...selectedServices, [s.id]: { ...entry, price: Number(e.target.value) } })
                          }
                          style={{ width: 110 }}
                        />
                      )}
                    </div>
                  );
                })}
              </fieldset>
            ))}
            <Button type="submit">Next</Button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={handleCoverageSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <MapPicker
              lat={coverage.baseLat}
              lng={coverage.baseLng}
              radiusKm={coverage.radiusKm}
              recenterSignal={recenterSignal}
              onLocationChange={(lat, lng, address) =>
                setCoverage((c) => ({ ...c, baseLat: lat, baseLng: lng, ...(address ? { baseAddress: address } : {}) }))
              }
            />
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                if (!navigator.geolocation) return;
                navigator.geolocation.getCurrentPosition((pos) => {
                  setCoverage((c) => ({ ...c, baseLat: pos.coords.latitude, baseLng: pos.coords.longitude }));
                  setRecenterSignal((s) => s + 1);
                });
              }}
            >
              📍 Use my current location
            </Button>
            <input className="input" placeholder="Base address" required value={coverage.baseAddress} onChange={(e) => setCoverage({ ...coverage, baseAddress: e.target.value })} />
            <label className="label">
              Service radius: {coverage.radiusKm} km
              <input type="range" min={1} max={50} value={coverage.radiusKm} onChange={(e) => setCoverage({ ...coverage, radiusKm: Number(e.target.value) })} />
            </label>
            <Button type="submit">Next</Button>
          </form>
        )}

        {step === 3 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <label className="label">
              Upload National ID (front) — JPG/PNG/PDF, max 5MB
              <input type="file" accept="image/jpeg,image/png,application/pdf" onChange={handleFileChange} />
            </label>
            {documentUploaded && <p className="success-text">Document uploaded.</p>}
            <Button disabled={!documentUploaded} onClick={() => setStep(4)}>
              Next
            </Button>
          </div>
        )}

        {step === 4 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <h3>Review & submit</h3>
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="checkbox" checked={tosAccepted} onChange={handleAcceptTerms} disabled={tosAccepted} />
              I accept the Provider Terms of Service and commission structure.
            </label>
            <Button disabled={!tosAccepted} onClick={handleFinalSubmit}>
              Submit for verification
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
