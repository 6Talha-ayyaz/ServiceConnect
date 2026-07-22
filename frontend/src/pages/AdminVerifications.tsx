import { useEffect, useState } from "react";
import { fetchVerificationQueue, approveProvider, rejectProvider, type QueueEntry } from "../api/admin";
import { ApiError } from "../api/client";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";

const API_ORIGIN = (import.meta.env.VITE_API_URL as string).replace(/\/api\/v1$/, "");

export function AdminVerificationsPage() {
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reasonById, setReasonById] = useState<Record<string, string>>({});

  async function load() {
    setLoading(true);
    try {
      const res = await fetchVerificationQueue();
      setQueue(res.queue);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleApprove(id: string) {
    setError(null);
    try {
      await approveProvider(id);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    }
  }

  async function handleReject(id: string) {
    const reason = reasonById[id];
    if (!reason || reason.length < 3) {
      setError("Enter a rejection reason (min 3 characters) first.");
      return;
    }
    setError(null);
    try {
      await rejectProvider(id, reason);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    }
  }

  if (loading) return <p className="muted" style={{ textAlign: "center", marginTop: 40 }}>Loading...</p>;

  return (
    <div className="container" style={{ padding: "60px 0" }}>
      <h1 style={{ fontSize: 26 }}>Provider verification queue</h1>
      {error && <div className="error-text" style={{ marginBottom: 12 }}>{error}</div>}
      {queue.length === 0 && <p className="muted">No pending applications.</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {queue.map((p) => (
          <Card key={p.id} style={{ padding: 20 }}>
            <h3 style={{ marginBottom: 4 }}>{p.user.fullName} ({p.user.email})</h3>
            <p className="muted">Legal name: {p.legalName} | CNIC: {p.cnic}</p>
            <p className="muted">Base: {p.baseAddress} (radius {p.radiusKm} km)</p>
            <p className="muted">Services: {p.services.map((s) => s.subService.name).join(", ")}</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "10px 0" }}>
              {p.documents.map((d) => (
                <a
                  key={d.id}
                  href={`${API_ORIGIN}${d.fileUrl}`}
                  target="_blank"
                  rel="noreferrer"
                  className="badge"
                  style={{ textDecoration: "none" }}
                >
                  {d.type}
                </a>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
              <Button size="sm" onClick={() => handleApprove(p.id)}>Approve</Button>
              <input
                className="input"
                placeholder="Rejection reason"
                value={reasonById[p.id] ?? ""}
                onChange={(e) => setReasonById({ ...reasonById, [p.id]: e.target.value })}
                style={{ flex: 1, minWidth: 200 }}
              />
              <Button size="sm" variant="danger" onClick={() => handleReject(p.id)}>Reject</Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
