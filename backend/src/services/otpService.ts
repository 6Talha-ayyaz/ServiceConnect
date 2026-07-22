import { prisma } from "../prisma";
import { config } from "../config";
import { sha256, randomOtp } from "../utils/tokens";
import { sendSms } from "./smsGateway";
import { Errors } from "../utils/errors";

const RESEND_WINDOW_MS = 60 * 60 * 1000;

export async function issueOtp(userId: string, phone: string, purpose: string) {
  const since = new Date(Date.now() - RESEND_WINDOW_MS);
  const recentCount = await prisma.otp.count({
    where: { userId, purpose, createdAt: { gte: since } },
  });
  if (recentCount >= config.otp.maxResendsPerHour) {
    throw Errors.tooManyRequests("Too many OTP requests. Please try again later.");
  }

  const code = randomOtp();
  const expiresAt = new Date(Date.now() + config.otp.ttlMinutes * 60 * 1000);

  await prisma.otp.create({
    data: { userId, purpose, codeHash: sha256(code), expiresAt },
  });

  await sendSms(phone, `Your ServiceConnect verification code is ${code}. It expires in ${config.otp.ttlMinutes} minutes.`);

  // No real SMS provider is wired up (see smsGateway.ts) — the code is only ever
  // delivered via this field, in every environment, so it must not be suppressed in prod.
  return { expiresAt, devOtp: code };
}

export async function verifyOtp(userId: string, purpose: string, code: string): Promise<void> {
  const otp = await prisma.otp.findFirst({
    where: { userId, purpose, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });

  if (!otp) throw Errors.validation("No pending verification code found. Please request a new one.");
  if (otp.expiresAt < new Date()) throw Errors.validation("Verification code has expired.");
  if (otp.attempts >= 5) throw Errors.tooManyRequests("Too many incorrect attempts. Please request a new code.");

  if (otp.codeHash !== sha256(code)) {
    await prisma.otp.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
    throw Errors.validation("Incorrect verification code.");
  }

  await prisma.otp.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });
}
