import { prisma } from "../prisma";
import { config } from "../config";
import { Errors } from "../utils/errors";
import { hashPassword, verifyPassword, validatePasswordStrength } from "../utils/password";
import { signAccessToken } from "../utils/jwt";
import { randomToken, sha256 } from "../utils/tokens";
import { issueOtp, verifyOtp } from "./otpService";
import { Role } from "@prisma/client";

interface RegisterInput {
  fullName: string;
  phone: string;
  email: string;
  password: string;
  role: Role;
}

export async function registerUser(input: RegisterInput) {
  const problems = validatePasswordStrength(input.password);
  if (problems.length > 0) throw Errors.validation("Password does not meet requirements.", problems);

  if (input.role === "ADMIN") throw Errors.forbidden("Cannot self-register as admin.");

  const existing = await prisma.user.findFirst({
    where: { OR: [{ phone: input.phone }, { email: input.email }] },
  });
  if (existing) throw Errors.conflict("An account with this phone or email already exists.");

  const passwordHash = await hashPassword(input.password);

  const user = await prisma.user.create({
    data: {
      fullName: input.fullName,
      phone: input.phone,
      email: input.email,
      passwordHash,
      role: input.role,
      status: input.role === "PROVIDER" ? "PENDING_VERIFICATION" : "ACTIVE",
    },
  });

  const otp = await issueOtp(user.id, user.phone, "PHONE_VERIFY");

  return { user, devOtp: otp.devOtp };
}

export async function confirmPhoneOtp(userId: string, code: string) {
  await verifyOtp(userId, "PHONE_VERIFY", code);
  return prisma.user.update({ where: { id: userId }, data: { phoneVerifiedAt: new Date() } });
}

export async function resendOtp(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw Errors.notFound("User not found.");
  return issueOtp(user.id, user.phone, "PHONE_VERIFY");
}

interface DeviceInfo {
  userAgent?: string;
  ipAddress?: string;
}

async function issueTokenPair(userId: string, role: Role, device: DeviceInfo) {
  const accessToken = signAccessToken({ sub: userId, role });

  const refreshToken = randomToken();
  const expiresAt = new Date(Date.now() + config.jwt.refreshTtlDays * 24 * 60 * 60 * 1000);
  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: sha256(refreshToken),
      expiresAt,
      userAgent: device.userAgent,
      ipAddress: device.ipAddress,
    },
  });

  return { accessToken, refreshToken, refreshExpiresAt: expiresAt };
}

export async function loginUser(identifier: string, password: string, device: DeviceInfo) {
  const user = await prisma.user.findFirst({
    where: { OR: [{ email: identifier }, { phone: identifier }] },
  });
  if (!user) throw Errors.unauthorized("Invalid credentials.");

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw Errors.locked(`Account is locked until ${user.lockedUntil.toISOString()}.`);
  }

  if (user.status === "SUSPENDED" || user.status === "DELETED") {
    throw Errors.forbidden("This account is not active.");
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    const failedCount = user.failedLoginCount + 1;
    const shouldLock = failedCount >= config.login.maxAttempts;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: shouldLock ? 0 : failedCount,
        lockedUntil: shouldLock
          ? new Date(Date.now() + config.login.lockoutMinutes * 60 * 1000)
          : null,
      },
    });
    if (shouldLock) {
      // FR-1.10: notify account owner of the lockout via SMS as a security alert.
      throw Errors.locked(
        `Account locked for ${config.login.lockoutMinutes} minutes after too many failed attempts.`
      );
    }
    throw Errors.unauthorized("Invalid credentials.");
  }

  if (user.failedLoginCount > 0 || user.lockedUntil) {
    await prisma.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null } });
  }

  const tokens = await issueTokenPair(user.id, user.role, device);
  return { user, tokens };
}

export async function refreshSession(refreshToken: string, device: DeviceInfo) {
  const tokenHash = sha256(refreshToken);
  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });
  if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
    throw Errors.unauthorized("Invalid or expired refresh token.");
  }

  const user = await prisma.user.findUnique({ where: { id: stored.userId } });
  if (!user) throw Errors.unauthorized("Invalid refresh token.");

  const newTokens = await issueTokenPair(user.id, user.role, device);
  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revokedAt: new Date(), replacedBy: sha256(newTokens.refreshToken) },
  });

  return { user, tokens: newTokens };
}

export async function revokeRefreshToken(refreshToken: string): Promise<void> {
  const tokenHash = sha256(refreshToken);
  await prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
