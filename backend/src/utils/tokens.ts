import crypto from "crypto";

export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("hex");
}

export function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function randomOtp(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
}
