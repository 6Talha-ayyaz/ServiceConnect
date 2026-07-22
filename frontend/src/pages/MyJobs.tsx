import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchMyJobs, type ServiceRequestSummary } from "../api/requests";
import { Card } from "../components/ui/Card";
import { Badge, statusTone } from "../components/ui/Badge";

export function MyJobsPage() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<ServiceRequestSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMyJobs().then((res) => {
      setRequests(res.requests);
      setLoading(false);
    });
  }, []);

  return (
    <div className="container-narrow" style={{ padding: "60px 0" }}>
      <h1 style={{ fontSize: 26 }}>My active jobs</h1>
      {loading && <p className="muted">Loading...</p>}
      {!loading && requests.length === 0 && <p className="muted">No active jobs.</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {requests.map((r) => (
          <Card key={r.id} style={{ padding: 18, cursor: "pointer" }} onClick={() => navigate(`/requests/${r.id}`)}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <strong>{r.subService.name}</strong>
              <Badge tone={statusTone(r.status)}>{r.status}</Badge>
            </div>
            <p className="muted" style={{ margin: "6px 0 0" }}>{r.address}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
