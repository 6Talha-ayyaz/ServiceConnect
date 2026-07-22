import { apiFetch, apiFetchForm } from "./client";

export interface SubService {
  id: string;
  name: string;
  defaultPricing: string;
}

export interface Category {
  id: string;
  name: string;
  icon?: string;
  subServices: SubService[];
}

export interface ProviderProfile {
  id: string;
  userId: string;
  legalName?: string | null;
  cnic?: string | null;
  dateOfBirth?: string | null;
  businessName?: string | null;
  bio?: string | null;
  yearsExperience?: number | null;
  baseLat?: number | null;
  baseLng?: number | null;
  baseAddress?: string | null;
  radiusKm?: number | null;
  verificationStatus: "PENDING_VERIFICATION" | "APPROVED" | "REJECTED";
  rejectionReason?: string | null;
  tosAcceptedAt?: string | null;
  isOnline: boolean;
  submittedAt?: string | null;
  services: { id: string; subServiceId: string; pricingModel: string; basePrice?: number | null; subService: SubService }[];
  documents: { id: string; type: string; fileUrl: string }[];
}

export function fetchCategories() {
  return apiFetch<{ categories: Category[] }>("/categories");
}

export function fetchMyProviderProfile() {
  return apiFetch<{ profile: ProviderProfile | null }>("/providers/me");
}

export function savePersonalDetails(input: {
  legalName: string;
  cnic: string;
  dateOfBirth: string;
  businessName?: string;
  yearsExperience?: number;
  bio?: string;
}) {
  return apiFetch<{ profile: ProviderProfile }>("/providers/me/personal-details", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function saveServices(services: { subServiceId: string; pricingModel: string; basePrice?: number }[]) {
  return apiFetch<{ profile: ProviderProfile }>("/providers/me/services", {
    method: "PUT",
    body: JSON.stringify({ services }),
  });
}

export function saveCoverage(input: { baseLat: number; baseLng: number; baseAddress: string; radiusKm: number }) {
  return apiFetch<{ profile: ProviderProfile }>("/providers/me/coverage", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function uploadDocument(type: string, file: File) {
  const form = new FormData();
  form.append("type", type);
  form.append("file", file);
  return apiFetchForm<{ document: { id: string; type: string; fileUrl: string } }>("/providers/me/documents", form);
}

export function acceptTerms() {
  return apiFetch<{ profile: ProviderProfile }>("/providers/me/accept-terms", { method: "POST" });
}

export function submitForVerification() {
  return apiFetch<{ profile: ProviderProfile; message: string }>("/providers/me/submit", { method: "POST" });
}

export function setOnlineStatus(online: boolean) {
  return apiFetch<{ profile: ProviderProfile }>("/providers/me/online-status", {
    method: "PATCH",
    body: JSON.stringify({ online }),
  });
}

export interface ProviderEarnings {
  totalEarnings: number;
  pendingEarnings: number;
  jobsPaid: number;
}

export function fetchProviderEarnings() {
  return apiFetch<{ earnings: ProviderEarnings }>("/providers/me/earnings");
}
