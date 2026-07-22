import "dotenv/config";

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 4000),
  nodeEnv: process.env.NODE_ENV ?? "development",
  databaseUrl: required("DATABASE_URL"),
  corsOrigins: (
    process.env.CORS_ORIGIN ?? "http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173,http://127.0.0.1:5174"
  )
    .split(",")
    .map((o) => o.trim()),
  jwt: {
    accessSecret: required("JWT_ACCESS_SECRET"),
    refreshSecret: required("JWT_REFRESH_SECRET"),
    accessTtl: process.env.JWT_ACCESS_TTL ?? "15m",
    refreshTtlDays: Number(process.env.JWT_REFRESH_TTL_DAYS ?? 30),
  },
  bcryptCost: Number(process.env.BCRYPT_COST ?? 12),
  otp: {
    ttlMinutes: Number(process.env.OTP_TTL_MINUTES ?? 10),
    maxResendsPerHour: Number(process.env.OTP_MAX_RESENDS_PER_HOUR ?? 3),
  },
  login: {
    maxAttempts: Number(process.env.LOGIN_MAX_ATTEMPTS ?? 5),
    lockoutMinutes: Number(process.env.LOGIN_LOCKOUT_MINUTES ?? 15),
  },
};
