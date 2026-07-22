const API_URL = import.meta.env.VITE_API_URL as string;

interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown[] };
}

function toDisplayString(detail: unknown): string {
  if (typeof detail === "string") return detail;
  if (detail && typeof detail === "object" && "message" in detail) {
    return String((detail as { message: unknown }).message);
  }
  return JSON.stringify(detail);
}

export class ApiError extends Error {
  code: string;
  details: string[];
  constructor(body: ApiErrorBody) {
    super(body.error?.message ?? "Something went wrong.");
    this.code = body.error?.code ?? "UNKNOWN_ERROR";
    this.details = (body.error?.details ?? []).map(toDisplayString);
  }
}

let accessToken: string | null = null;
let refreshInFlight: Promise<string | null> | null = null;
let refreshFn: (() => Promise<string | null>) | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

// Wired up once by AuthContext so apiFetch can silently refresh an expired
// access token using the httpOnly refresh cookie, keeping the user logged in
// across reloads and short expiries without surfacing a 401 to the caller.
export function registerRefreshHandler(fn: () => Promise<string | null>) {
  refreshFn = fn;
}

async function trySilentRefresh(): Promise<string | null> {
  if (!refreshFn) return null;
  if (!refreshInFlight) {
    refreshInFlight = refreshFn().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

function buildHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { ...extra };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  return headers;
}

export async function apiFetch<T>(path: string, options: RequestInit = {}, _retried = false): Promise<T> {
  const headers = buildHeaders({ "Content-Type": "application/json", ...(options.headers as Record<string, string> | undefined) });

  const res = await fetch(`${API_URL}${path}`, { ...options, headers, credentials: "include" });
  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    const isAuthEndpoint = path.startsWith("/auth/");
    if (res.status === 401 && !isAuthEndpoint && !_retried) {
      const newToken = await trySilentRefresh();
      if (newToken) return apiFetch<T>(path, options, true);
    }
    throw new ApiError(body as ApiErrorBody);
  }
  return body as T;
}

export async function apiFetchForm<T>(path: string, form: FormData, _retried = false): Promise<T> {
  const headers = buildHeaders();

  const res = await fetch(`${API_URL}${path}`, { method: "POST", headers, body: form, credentials: "include" });
  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    if (res.status === 401 && !_retried) {
      const newToken = await trySilentRefresh();
      if (newToken) return apiFetchForm<T>(path, form, true);
    }
    throw new ApiError(body as ApiErrorBody);
  }
  return body as T;
}
