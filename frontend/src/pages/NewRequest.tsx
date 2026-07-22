import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { fetchCategories, type Category } from "../api/providers";
import { createRequest } from "../api/requests";
import { ApiError } from "../api/client";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { MapPicker } from "../components/map/MapPicker";

export function NewRequestPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [categories, setCategories] = useState<Category[]>([]);
  const [subServiceId, setSubServiceId] = useState(searchParams.get("subServiceId") ?? "");
  const [description, setDescription] = useState("");
  const [urgency, setUrgency] = useState<"IMMEDIATE" | "SAME_DAY_SCHEDULED" | "FUTURE_SCHEDULED">("IMMEDIATE");
  const [address, setAddress] = useState("Lahore, Pakistan");
  const [lat, setLat] = useState(31.5204);
  const [lng, setLng] = useState(74.3587);
  const [recenterSignal, setRecenterSignal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchCategories().then((res) => setCategories(res.categories));
  }, []);

  function handleLocationChange(newLat: number, newLng: number, newAddress?: string) {
    setLat(newLat);
    setLng(newLng);
    if (newAddress) setAddress(newAddress);
  }

  function useMyLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
        setRecenterSignal((s) => s + 1);
      },
      () => setError("Could not get your location. Please search or pin it manually on the map.")
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!subServiceId) {
      setError("Please select a service.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await createRequest({ subServiceId, description, urgency, lat, lng, address });
      if (res.eligibleCount === 0) {
        setInfo("We're not in your area yet, or no providers are online right now. You've been added to the queue.");
      }
      navigate(`/requests/${res.request.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? `${err.message} ${err.details.join(" ")}` : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container-narrow" style={{ padding: "60px 0" }}>
      <h1 style={{ fontSize: 26 }}>Request a service</h1>
      <p style={{ marginBottom: 20 }}>Tell us what you need and we'll match you with a nearby provider.</p>
      <Card style={{ padding: 28 }}>
        {info && <p className="success-text" style={{ marginBottom: 10 }}>{info}</p>}
        {error && <p className="error-text" style={{ marginBottom: 10 }}>{error}</p>}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <label className="label">
            Service
            <select className="input" value={subServiceId} onChange={(e) => setSubServiceId(e.target.value)} required>
              <option value="">-- Select --</option>
              {categories.map((cat) => (
                <optgroup key={cat.id} label={`${cat.icon ?? ""} ${cat.name}`}>
                  {cat.subServices.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <label className="label">
            Description
            <textarea
              className="input"
              rows={3}
              placeholder="Describe the problem"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <label className="label">
            When
            <select className="input" value={urgency} onChange={(e) => setUrgency(e.target.value as typeof urgency)}>
              <option value="IMMEDIATE">Right now</option>
              <option value="SAME_DAY_SCHEDULED">Later today</option>
              <option value="FUTURE_SCHEDULED">A future date</option>
            </select>
          </label>

          <label className="label">
            Location
            <MapPicker lat={lat} lng={lng} onLocationChange={handleLocationChange} recenterSignal={recenterSignal} />
          </label>
          <Button type="button" variant="secondary" onClick={useMyLocation}>
            📍 Use my current location
          </Button>
          <label className="label">
            Address
            <input className="input" required value={address} onChange={(e) => setAddress(e.target.value)} />
          </label>

          <Button type="submit" disabled={submitting}>
            {submitting ? "Submitting..." : "Submit request"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
