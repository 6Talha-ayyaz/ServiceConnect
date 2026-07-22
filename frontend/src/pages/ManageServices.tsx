import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError } from "../api/client";
import {
  fetchCategories,
  fetchMyProviderProfile,
  saveServices,
  saveCoverage,
  type Category,
  type ProviderProfile,
} from "../api/providers";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { MapPicker } from "../components/map/MapPicker";

export function ManageServicesPage() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [profile, setProfile] = useState<ProviderProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const [selectedServices, setSelectedServices] = useState<Record<string, { checked: boolean; price: number }>>({});
  const [coverage, setCoverage] = useState({ baseLat: 31.5204, baseLng: 74.3587, baseAddress: "", radiusKm: 10 });
  const [recenterSignal, setRecenterSignal] = useState(0);

  const [servicesError, setServicesError] = useState<string | null>(null);
  const [servicesSaved, setServicesSaved] = useState(false);
  const [savingServices, setSavingServices] = useState(false);

  const [coverageError, setCoverageError] = useState<string | null>(null);
  const [coverageSaved, setCoverageSaved] = useState(false);
  const [savingCoverage, setSavingCoverage] = useState(false);

  useEffect(() => {
    (async () => {
      const [cats, prof] = await Promise.all([fetchCategories(), fetchMyProviderProfile()]);
      setCategories(cats.categories);
      setProfile(prof.profile);
      if (prof.profile) {
        const preset: Record<string, { checked: boolean; price: number }> = {};
        for (const s of prof.profile.services) {
          preset[s.subServiceId] = { checked: true, price: (s.basePrice ?? 0) / 100 };
        }
        setSelectedServices(preset);
        setCoverage({
          baseLat: prof.profile.baseLat ?? 31.5204,
          baseLng: prof.profile.baseLng ?? 74.3587,
          baseAddress: prof.profile.baseAddress ?? "",
          radiusKm: prof.profile.radiusKm ?? 10,
        });
      }
      setLoading(false);
    })();
  }, []);

  function useMyLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      setCoverage((c) => ({ ...c, baseLat: pos.coords.latitude, baseLng: pos.coords.longitude }));
      setRecenterSignal((s) => s + 1);
    });
  }

  function handleLocationChange(lat: number, lng: number, address?: string) {
    setCoverage((c) => ({ ...c, baseLat: lat, baseLng: lng, ...(address ? { baseAddress: address } : {}) }));
  }

  async function handleSaveServices() {
    setServicesError(null);
    setServicesSaved(false);
    const chosen = Object.entries(selectedServices)
      .filter(([, v]) => v.checked)
      .map(([subServiceId, v]) => ({ subServiceId, pricingModel: "FIXED", basePrice: Math.round(v.price * 100) }));
    if (chosen.length === 0) {
      setServicesError("Select at least one service.");
      return;
    }
    setSavingServices(true);
    try {
      const res = await saveServices(chosen);
      setProfile(res.profile);
      setServicesSaved(true);
    } catch (err) {
      setServicesError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSavingServices(false);
    }
  }

  async function handleSaveCoverage() {
    setCoverageError(null);
    setCoverageSaved(false);
    setSavingCoverage(true);
    try {
      const res = await saveCoverage(coverage);
      setProfile(res.profile);
      setCoverageSaved(true);
    } catch (err) {
      setCoverageError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSavingCoverage(false);
    }
  }

  if (loading) return <p className="muted" style={{ textAlign: "center", marginTop: 40 }}>Loading...</p>;

  return (
    <div className="container-narrow" style={{ padding: "60px 0" }}>
      <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")} style={{ marginBottom: 16 }}>
        ← Back to dashboard
      </Button>
      <h1 style={{ fontSize: 26 }}>Services & coverage area</h1>
      <p style={{ marginBottom: 20 }}>
        Choose every service you offer and set the area you cover. Customers requesting any of these services within
        your radius will notify you the moment they submit a request — first to accept gets the job.
      </p>

      <Card style={{ padding: 26, marginBottom: 20 }}>
        <h3 style={{ marginBottom: 4 }}>Services you offer</h3>
        <p className="muted" style={{ marginBottom: 14 }}>Select every service you provide and set your price for each.</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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
        </div>
        {servicesError && <p className="error-text" style={{ marginTop: 10 }}>{servicesError}</p>}
        {servicesSaved && <p className="success-text" style={{ marginTop: 10 }}>Services updated.</p>}
        <Button style={{ marginTop: 14 }} onClick={handleSaveServices} disabled={savingServices}>
          {savingServices ? "Saving..." : "Save services"}
        </Button>
      </Card>

      <Card style={{ padding: 26 }}>
        <h3 style={{ marginBottom: 4 }}>Coverage area</h3>
        <p className="muted" style={{ marginBottom: 14 }}>
          Set your base location and how far you're willing to travel (1–50 km). Only requests inside this radius
          will be sent to you.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <MapPicker
            lat={coverage.baseLat}
            lng={coverage.baseLng}
            radiusKm={coverage.radiusKm}
            onLocationChange={handleLocationChange}
            recenterSignal={recenterSignal}
          />
          <Button variant="secondary" onClick={useMyLocation}>
            📍 Use my current location
          </Button>
          <input
            className="input"
            placeholder="Base address"
            value={coverage.baseAddress}
            onChange={(e) => setCoverage({ ...coverage, baseAddress: e.target.value })}
          />
          <label className="label">
            Service radius: {coverage.radiusKm} km
            <input
              type="range"
              min={1}
              max={50}
              value={coverage.radiusKm}
              onChange={(e) => setCoverage({ ...coverage, radiusKm: Number(e.target.value) })}
            />
          </label>
        </div>
        {coverageError && <p className="error-text" style={{ marginTop: 10 }}>{coverageError}</p>}
        {coverageSaved && <p className="success-text" style={{ marginTop: 10 }}>Coverage updated.</p>}
        <Button style={{ marginTop: 14 }} onClick={handleSaveCoverage} disabled={savingCoverage}>
          {savingCoverage ? "Saving..." : "Save coverage area"}
        </Button>
      </Card>

      {profile && !profile.isOnline && (
        <p className="muted" style={{ marginTop: 16 }}>
          Remember: you need to be <strong>online</strong> (toggle on your dashboard) to actually receive requests.
        </p>
      )}
    </div>
  );
}
