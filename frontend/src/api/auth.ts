import { apiFetch } from "./client";

export type RegisterRole = "CUSTOMER" | "PROVIDER";
export type Role = "CUSTOMER" | "PROVIDER" | "ADMIN";

export interface AuthUser {
  id: string;
  fullName: string;
  email?: string;
  phone?: string;
  role: Role;
  status: string;
  phoneVerifiedAt?: string | null;
}

export function register(input: { fullName: string; phone: string; email: string; password: string; role: RegisterRole }) {
  return apiFetch<{ user: AuthUser; message: string; devOtp?: string }>("/auth/register", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function verifyOtp(input: { userId: string; code: string }) {
  return apiFetch<{ message: string; user: { id: string; status: string } }>("/auth/verify-otp", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function resendOtp(userId: string) {
  return apiFetch<{ message: string; expiresAt: string; devOtp?: string }>("/auth/resend-otp", {
    method: "POST",
    body: JSON.stringify({ userId }),
  });
}

export function login(identifier: string, password: string) {
  return apiFetch<{ accessToken: string; user: AuthUser }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ identifier, password }),
  });
}

export function logout() {
  return apiFetch<{ message: string }>("/auth/logout", { method: "POST" });
}

export function fetchMe() {
  return apiFetch<{ user: AuthUser }>("/auth/me");
}

export function refresh() {
  return apiFetch<{ accessToken: string; user: { id: string; role: Role } }>("/auth/refresh", { method: "POST" });
}
