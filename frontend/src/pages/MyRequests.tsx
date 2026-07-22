import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchMyRequests, type ServiceRequestSummary } from "../api/requests";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge, statusTone } from "../components/ui/Badge";

export function MyRequestsPage() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<ServiceRequestSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMyRequests().then((res) => {
      setRequests(res.requests);
      setLoading(false);
    });
  }, []);

  return (
    <div className="container-narrow" style={{ padding: "60px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1 style={{ fontSize: 26, margin: 0 }}>My requests</h1>
        <Button onClick={() => navigate("/requests/new")}>+ New request</Button>
      </div>
      {loading && <p className="muted">Loading...</p>}
      {!loading && requests.length === 0 && <p className="muted">No requests yet.</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {requests.map((r) => (
          <Card
            key={r.id}
            style={{ padding: 18, cursor: "pointer" }}
            onClick={() => navigate(`/requests/${r.id}`)}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong>{r.subService.name}</strong>
              <Badge tone={statusTone(r.status)}>{r.status}</Badge>
            </div>
            <p className="muted" style={{ margin: "6px 0 0" }}>{r.reference}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
