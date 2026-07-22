import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import { ApiError } from "../api/client";
import {
  fetchRequestDetail,
  markEnRoute,
  markArrived,
  startJob,
  markJobDone,
  confirmCompletion,
  cancelRequest,
  submitReview,
  fetchReviews,
  fetchInvoice,
  payInvoice,
  type ServiceRequestDetail,
  type Review,
  type Invoice,
} from "../api/requests";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge, statusTone } from "../components/ui/Badge";
import { StarRating } from "../components/ui/StarRating";
import { ChatPanel } from "../components/ChatPanel";

const CANCELLABLE = new Set(["PENDING", "ASSIGNED", "EN_ROUTE", "ARRIVED"]);

function formatMoney(minorUnits: number): string {
  return `PKR ${(minorUnits / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

export function RequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { socket } = useSocket();
  const navigate = useNavigate();
  const [req, setReq] = useState<ServiceRequestDetail | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [myRating, setMyRating] = useState(5);
  const [comment, setComment] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);

  async function load() {
    if (!id) return;
    try {
      const res = await fetchRequestDetail(id);
      setReq(res.request);
      if (res.request.status === "COMPLETED") {
        const [revRes, invRes] = await Promise.all([
          fetchReviews(id),
          fetchInvoice(id).catch(() => null),
        ]);
        setReviews(revRes.reviews);
        if (invRes) setInvoice(invRes.invoice);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 8000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!socket || !id) return;
    function handleUpdate(payload: { requestId: string }) {
      if (payload.requestId === id) load();
    }
    socket.on("request:updated", handleUpdate);
    return () => {
      socket.off("request:updated", handleUpdate);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, id]);

  async function runAction(action: (id: string) => Promise<unknown>) {
    if (!id) return;
    setError(null);
    try {
      await action(id);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    }
  }

  async function handleSubmitReview() {
    if (!id) return;
    setReviewError(null);
    setReviewSubmitting(true);
    try {
      await submitReview(id, { rating: myRating, comment: comment || undefined });
      await load();
    } catch (err) {
      setReviewError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setReviewSubmitting(false);
    }
  }

  async function handlePay() {
    if (!id) return;
    setPaying(true);
    setError(null);
    try {
      const res = await payInvoice(id, "CASH");
      setInvoice(res.invoice);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setPaying(false);
    }
  }

  if (loading && !req) return <p style={{ textAlign: "center", marginTop: 40 }} className="muted">Loading...</p>;
  if (!req) return <p className="muted">Not found.</p>;

  const isProvider = user?.role === "PROVIDER";
  const isCustomer = user?.role === "CUSTOMER";
  const alreadyReviewed = reviews.some((r) => r.authorId === user?.id);
  const chatAvailable = !!req.assignedProvider;

  return (
    <div className="container-narrow" style={{ padding: "60px 0" }}>
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)} style={{ marginBottom: 16 }}>
        ← Back
      </Button>

      <Card style={{ padding: 26, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <h1 style={{ fontSize: 24, margin: 0 }}>{req.subService.name}</h1>
          <Badge tone={statusTone(req.status)}>{req.status}</Badge>
        </div>
        <p className="muted" style={{ margin: "4px 0 14px" }}>{req.reference}</p>
        <p>📍 {req.address}</p>
        {req.description && <p>{req.description}</p>}
        {req.assignedProvider && <p>👷 Provider: {req.assignedProvider.user.fullName}</p>}
        {isProvider && <p>👤 Customer: {req.customer.fullName} ({req.customer.phone})</p>}
        {error && <p className="error-text">{error}</p>}

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 16 }}>
          {isProvider && req.status === "ASSIGNED" && (
            <Button size="sm" onClick={() => runAction(markEnRoute)}>Mark: On my way</Button>
          )}
          {isProvider && req.status === "EN_ROUTE" && (
            <Button size="sm" onClick={() => runAction(markArrived)}>Mark: Arrived</Button>
          )}
          {isProvider && req.status === "ARRIVED" && (
            <Button size="sm" onClick={() => runAction(startJob)}>Start job</Button>
          )}
          {isProvider && req.status === "IN_PROGRESS" && (
            <Button size="sm" onClick={() => runAction(markJobDone)}>Mark job done</Button>
          )}
          {isCustomer && req.status === "AWAITING_CONFIRMATION" && (
            <Button size="sm" onClick={() => runAction(confirmCompletion)}>Confirm completion</Button>
          )}
          {CANCELLABLE.has(req.status) && (
            <Button size="sm" variant="danger" onClick={() => runAction((id) => cancelRequest(id, "Cancelled by user"))}>
              Cancel
            </Button>
          )}
        </div>
      </Card>

      {chatAvailable && (
        <div style={{ marginBottom: 16 }}>
          <ChatPanel requestId={req.id} />
        </div>
      )}

      {req.status === "COMPLETED" && invoice && (
        <Card style={{ padding: 22, marginBottom: 16 }}>
          <h3 style={{ marginBottom: 10 }}>Invoice</h3>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span className="muted">Subtotal</span>
            <span>{formatMoney(invoice.subtotal)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span className="muted">Platform commission ({(invoice.commissionRateBp / 100).toFixed(0)}%, provider-side)</span>
            <span className="muted">-{formatMoney(invoice.commissionAmount)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, marginTop: 8, borderTop: "1px solid var(--border)", paddingTop: 8 }}>
            <span>Total due</span>
            <span>{formatMoney(invoice.total)}</span>
          </div>
          <div style={{ marginTop: 14 }}>
            {invoice.paidAt ? (
              <Badge tone="success">Paid via {invoice.paymentMethod} on {new Date(invoice.paidAt).toLocaleDateString()}</Badge>
            ) : isCustomer ? (
              <Button size="sm" onClick={handlePay} disabled={paying}>
                {paying ? "Processing..." : "Pay now (cash on completion)"}
              </Button>
            ) : (
              <Badge tone="warning">Awaiting payment from customer</Badge>
            )}
          </div>
        </Card>
      )}

      {req.status === "COMPLETED" && (
        <Card style={{ padding: 22, marginBottom: 16 }}>
          <h3 style={{ marginBottom: 10 }}>Reviews</h3>
          {reviews.length === 0 && <p className="muted">No reviews yet.</p>}
          {reviews.map((r) => (
            <div key={r.id} style={{ marginBottom: 10 }}>
              <StarRating value={r.rating} />
              {r.comment && <p style={{ margin: "4px 0 0" }}>{r.comment}</p>}
            </div>
          ))}
          {!alreadyReviewed && (
            <div style={{ marginTop: 14, borderTop: "1px solid var(--border)", paddingTop: 14 }}>
              <p style={{ marginBottom: 8 }}>Leave a review</p>
              <StarRating value={myRating} onChange={setMyRating} />
              <textarea
                className="input"
                rows={2}
                placeholder="How was it?"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                style={{ margin: "10px 0" }}
              />
              {reviewError && <p className="error-text">{reviewError}</p>}
              <Button size="sm" onClick={handleSubmitReview} disabled={reviewSubmitting}>
                {reviewSubmitting ? "Submitting..." : "Submit review"}
              </Button>
            </div>
          )}
        </Card>
      )}

      <Card style={{ padding: 22 }}>
        <h3 style={{ marginBottom: 10 }}>Timeline</h3>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          {req.events.map((e) => (
            <li key={e.id} className="muted" style={{ marginBottom: 4 }}>
              {new Date(e.createdAt).toLocaleString()} — {e.fromStatus ? `${e.fromStatus} → ` : ""}
              {e.toStatus}
              {e.notes ? ` (${e.notes})` : ""}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
