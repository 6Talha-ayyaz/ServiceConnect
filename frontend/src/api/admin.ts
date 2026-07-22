import { apiFetch } from "./client";
import type { ProviderProfile } from "./providers";

export interface QueueEntry extends ProviderProfile {
  user: { id: string; fullName: string; email: string; phone: string };
}

export function fetchVerificationQueue() {
  return apiFetch<{ queue: QueueEntry[] }>("/admin/verifications");
}

export function approveProvider(profileId: string) {
  return apiFetch<{ profile: ProviderProfile; message: string }>(`/admin/verifications/${profileId}/approve`, {
    method: "POST",
  });
}

export function rejectProvider(profileId: string, reason: string) {
  return apiFetch<{ profile: ProviderProfile; message: string }>(`/admin/verifications/${profileId}/reject`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export interface AnalyticsSummary {
  totalCustomers: number;
  totalProviders: number;
  activeProviders: number;
  requestsToday: number;
  requestsLast30d: number;
  completedLast30d: number;
  cancelledLast30d: number;
  unfulfilledLast30d: number;
  fulfilmentRate: number | null;
  cancellationRate: number | null;
  medianTimeToAcceptMinutes: number | null;
  gmv: number;
  commissionRevenue: number;
  csat: number | null;
}

export function fetchAnalyticsSummary() {
  return apiFetch<{ summary: AnalyticsSummary }>("/admin/analytics");
}

export interface AdminSubService {
  id: string;
  name: string;
  description?: string | null;
  defaultPricing: string;
  active: boolean;
}

export interface AdminCategory {
  id: string;
  name: string;
  icon?: string | null;
  description?: string | null;
  displayOrder: number;
  active: boolean;
  subServices: AdminSubService[];
}

export function fetchAllCategories() {
  return apiFetch<{ categories: AdminCategory[] }>("/admin/categories");
}

export function createCategory(input: { name: string; icon?: string; description?: string }) {
  return apiFetch<{ category: AdminCategory }>("/admin/categories", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function deactivateCategory(id: string) {
  return apiFetch<{ category: AdminCategory }>(`/admin/categories/${id}/deactivate`, { method: "POST" });
}

export function createSubService(input: { categoryId: string; name: string; defaultPricing: string }) {
  return apiFetch<{ subService: AdminSubService }>("/admin/sub-services", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function deactivateSubService(id: string) {
  return apiFetch<{ subService: AdminSubService }>(`/admin/sub-services/${id}/deactivate`, { method: "POST" });
}
