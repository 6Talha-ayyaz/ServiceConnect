import { useEffect, useState } from "react";
import { fetchAnalyticsSummary, type AnalyticsSummary } from "../api/admin";
import { Card } from "../components/ui/Card";

function StatTile({ label, value, tone }: { label: string; value: string; tone?: "success" | "warning" | "danger" }) {
  const color = tone === "success" ? "var(--success)" : tone === "warning" ? "var(--warning)" : tone === "danger" ? "var(--danger)" : "var(--text-0)";
  return (
    <Card style={{ padding: 20 }}>
      <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color, fontFamily: "var(--font-display)" }}>{value}</div>
    </Card>
  );
}

function pct(value: number | null): string {
  return value === null ? "—" : `${(value * 100).toFixed(0)}%`;
}

function money(minorUnits: number): string {
  return `PKR ${(minorUnits / 100).toLocaleString()}`;
}

export function AdminAnalyticsPage() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);

  useEffect(() => {
    fetchAnalyticsSummary().then((res) => setSummary(res.summary));
  }, []);

  if (!summary) return <p className="muted" style={{ textAlign: "center", marginTop: 40 }}>Loading...</p>;

  return (
    <div className="container" style={{ padding: "60px 0" }}>
      <h1 style={{ fontSize: 26, marginBottom: 20 }}>Platform analytics</h1>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16 }}>
        <StatTile label="Requests today" value={String(summary.requestsToday)} />
        <StatTile label="Requests (30d)" value={String(summary.requestsLast30d)} />
        <StatTile label="Completed (30d)" value={String(summary.completedLast30d)} tone="success" />
        <StatTile label="Cancelled (30d)" value={String(summary.cancelledLast30d)} tone="danger" />
        <StatTile label="Unfulfilled (30d)" value={String(summary.unfulfilledLast30d)} tone="warning" />
        <StatTile
          label="Fulfilment rate (30d)"
          value={pct(summary.fulfilmentRate)}
          tone={summary.fulfilmentRate !== null && summary.fulfilmentRate >= 0.8 ? "success" : "warning"}
        />
        <StatTile label="Cancellation rate (30d)" value={pct(summary.cancellationRate)} tone="danger" />
        <StatTile
          label="Median time to accept"
          value={summary.medianTimeToAcceptMinutes !== null ? `${summary.medianTimeToAcceptMinutes.toFixed(1)} min` : "—"}
        />
        <StatTile label="Active providers" value={String(summary.activeProviders)} tone="success" />
        <StatTile label="Total providers" value={String(summary.totalProviders)} />
        <StatTile label="Total customers" value={String(summary.totalCustomers)} />
        <StatTile label="GMV (paid)" value={money(summary.gmv)} />
        <StatTile label="Commission revenue" value={money(summary.commissionRevenue)} tone="success" />
        <StatTile label="CSAT (avg rating)" value={summary.csat !== null ? summary.csat.toFixed(1) : "—"} />
      </div>
    </div>
  );
}
