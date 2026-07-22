import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchAvailableRequests, acceptRequest, declineRequest, type ServiceRequestSummary } from "../api/requests";
import { ApiError } from "../api/client";
import { useSocket } from "../context/SocketContext";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";

export function AvailableRequestsPage() {
  const navigate = useNavigate();
  const { socket } = useSocket();
  const [requests, setRequests] = useState<ServiceRequestSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetchAvailableRequests();
    setRequests(res.requests);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // Poll as a fallback in case the socket connection drops; the "request:new"
    // listener below makes new jobs appear near-instantly in the common case.
    const interval = setInterval(load, 8000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!socket) return;
    socket.on("request:new", load);
    return () => {
      socket.off("request:new", load);
    };
  }, [socket]);

  async function handleAccept(id: string) {
    setError(null);
    try {
      await acceptRequest(id);
      navigate(`/requests/${id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
      await load();
    }
  }

  async function handleDecline(id: string) {
    setError(null);
    try {
      await declineRequest(id);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    }
  }

  return (
    <div className="container-narrow" style={{ padding: "60px 0" }}>
      <h1 style={{ fontSize: 26 }}>Available requests near you</h1>
      {error && <p className="error-text">{error}</p>}
      {loading && <p className="muted">Loading...</p>}
      {!loading && requests.length === 0 && (
        <p className="muted">
          No requests available right now. Make sure you're online and that your services & coverage area are set up
          — new jobs will pop up here the moment a customer nearby needs them.
        </p>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {requests.map((r) => (
          <Card key={r.id} style={{ padding: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <strong>{r.subService.name}</strong>
              {r.distanceKm !== undefined && <span className="muted">{r.distanceKm.toFixed(1)} km away</span>}
            </div>
            <p style={{ margin: "6px 0" }}>{r.address}</p>
            {r.description && <p className="muted" style={{ fontSize: 13 }}>{r.description}</p>}
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <Button size="sm" onClick={() => handleAccept(r.id)}>
                Accept
              </Button>
              <Button size="sm" variant="secondary" onClick={() => handleDecline(r.id)}>
                Decline
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
