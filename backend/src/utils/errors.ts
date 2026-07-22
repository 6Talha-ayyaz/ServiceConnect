export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown[];

  constructor(status: number, code: string, message: string, details?: unknown[]) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const Errors = {
  validation: (message: string, details?: unknown[]) =>
    new ApiError(400, "VALIDATION_ERROR", message, details),
  unauthorized: (message = "Unauthorized") => new ApiError(401, "UNAUTHORIZED", message),
  forbidden: (message = "Forbidden") => new ApiError(403, "FORBIDDEN", message),
  notFound: (message = "Not found") => new ApiError(404, "NOT_FOUND", message),
  conflict: (message: string) => new ApiError(409, "CONFLICT", message),
  tooManyRequests: (message: string) => new ApiError(429, "TOO_MANY_REQUESTS", message),
  locked: (message: string) => new ApiError(423, "ACCOUNT_LOCKED", message),
};
