import { apiFetch } from "./client";

export type RequestStatus =
  | "PENDING"
  | "ASSIGNED"
  | "EN_ROUTE"
  | "ARRIVED"
  | "IN_PROGRESS"
  | "AWAITING_CONFIRMATION"
  | "COMPLETED"
  | "UNFULFILLED"
  | "CANCELLED";

export interface ServiceRequestSummary {
  id: string;
  reference: string;
  status: RequestStatus;
  description?: string | null;
  address: string;
  createdAt: string;
  subService: { id: string; name: string };
  assignedProvider?: { id: string; user: { fullName: string } } | null;
  distanceKm?: number;
}

export interface JobEvent {
  id: string;
  fromStatus?: RequestStatus | null;
  toStatus: RequestStatus;
  notes?: string | null;
  createdAt: string;
}

export interface ServiceRequestDetail extends ServiceRequestSummary {
  lat: number;
  lng: number;
  customer: { id: string; fullName: string; phone: string };
  events: JobEvent[];
}

export function createRequest(input: {
  subServiceId: string;
  description?: string;
  urgency: "IMMEDIATE" | "SAME_DAY_SCHEDULED" | "FUTURE_SCHEDULED";
  lat: number;
  lng: number;
  address: string;
}) {
  return apiFetch<{ request: ServiceRequestSummary; eligibleCount: number }>("/requests", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function fetchMyRequests() {
  return apiFetch<{ requests: ServiceRequestSummary[] }>("/requests/mine");
}

export function fetchAvailableRequests() {
  return apiFetch<{ requests: ServiceRequestSummary[] }>("/requests/available");
}

export function fetchMyJobs() {
  return apiFetch<{ requests: ServiceRequestSummary[] }>("/requests/my-jobs");
}

export function fetchRequestDetail(id: string) {
  return apiFetch<{ request: ServiceRequestDetail }>(`/requests/${id}`);
}

export function acceptRequest(id: string) {
  return apiFetch<{ request: ServiceRequestDetail }>(`/requests/${id}/accept`, { method: "POST" });
}

export function declineRequest(id: string, reason?: string) {
  return apiFetch<{ message: string }>(`/requests/${id}/decline`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

function postAction(id: string, action: string) {
  return apiFetch<{ request: ServiceRequestDetail }>(`/requests/${id}/${action}`, { method: "POST" });
}

export const markEnRoute = (id: string) => postAction(id, "en-route");
export const markArrived = (id: string) => postAction(id, "arrived");
export const startJob = (id: string) => postAction(id, "start");
export const markJobDone = (id: string) => postAction(id, "job-done");
export const confirmCompletion = (id: string) => postAction(id, "confirm");

export function cancelRequest(id: string, reason?: string) {
  return apiFetch<{ request: ServiceRequestDetail }>(`/requests/${id}/cancel`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export interface Review {
  id: string;
  authorId: string;
  revieweeId: string;
  rating: number;
  punctuality?: number | null;
  workQuality?: number | null;
  professionalism?: number | null;
  priceFairness?: number | null;
  comment?: string | null;
}

export function submitReview(
  id: string,
  input: { rating: number; punctuality?: number; workQuality?: number; professionalism?: number; priceFairness?: number; comment?: string }
) {
  return apiFetch<{ review: Review }>(`/requests/${id}/review`, { method: "POST", body: JSON.stringify(input) });
}

export function fetchReviews(id: string) {
  return apiFetch<{ reviews: Review[] }>(`/requests/${id}/reviews`);
}

export interface ChatMessage {
  id: string;
  senderId: string;
  body: string;
  imageUrl?: string | null;
  createdAt: string;
}

export function fetchMessages(id: string) {
  return apiFetch<{ messages: ChatMessage[] }>(`/requests/${id}/messages`);
}

export function sendChatMessage(id: string, body: string) {
  return apiFetch<{ message: ChatMessage; redacted: boolean }>(`/requests/${id}/messages`, {
    method: "POST",
    body: JSON.stringify({ body }),
  });
}

export interface Invoice {
  id: string;
  subtotal: number;
  commissionRateBp: number;
  commissionAmount: number;
  total: number;
  paymentMethod: "CASH" | "CARD" | "WALLET";
  paidAt?: string | null;
}

export function fetchInvoice(id: string) {
  return apiFetch<{ invoice: Invoice }>(`/requests/${id}/invoice`);
}

export function payInvoice(id: string, paymentMethod: "CASH" | "CARD" | "WALLET" = "CASH") {
  return apiFetch<{ invoice: Invoice }>(`/requests/${id}/invoice/pay`, {
    method: "POST",
    body: JSON.stringify({ paymentMethod }),
  });
}
