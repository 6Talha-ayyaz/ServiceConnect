import { Router } from "express";
import { z } from "zod";
import {
  registerUser,
  confirmPhoneOtp,
  resendOtp,
  loginUser,
  refreshSession,
  revokeRefreshToken,
} from "../services/authService";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { prisma } from "../prisma";

export const authRouter = Router();

const REFRESH_COOKIE = "sc_refresh_token";
const isProd = process.env.NODE_ENV === "production";

function setRefreshCookie(res: import("express").Response, token: string, expiresAt: Date) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "strict",
    expires: expiresAt,
    path: "/api/v1/auth",
  });
}

const registerSchema = z.object({
  fullName: z.string().min(2).max(120),
  phone: z.string().min(7).max(20),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  role: z.enum(["CUSTOMER", "PROVIDER"]),
});

authRouter.post("/register", async (req, res, next) => {
  try {
    const input = registerSchema.parse(req.body);
    const { user, devOtp } = await registerUser(input);
    res.status(201).json({
      user: { id: user.id, fullName: user.fullName, phone: user.phone, email: user.email, role: user.role, status: user.status },
      message: "Registration successful. Please verify your phone number with the OTP sent via SMS.",
      devOtp,
    });
  } catch (err) {
    next(err);
  }
});

const verifyOtpSchema = z.object({
  userId: z.string().uuid(),
  code: z.string().length(6),
});

authRouter.post("/verify-otp", async (req, res, next) => {
  try {
    const input = verifyOtpSchema.parse(req.body);
    const user = await confirmPhoneOtp(input.userId, input.code);
    res.json({ message: "Phone verified.", user: { id: user.id, status: user.status } });
  } catch (err) {
    next(err);
  }
});

const resendOtpSchema = z.object({ userId: z.string().uuid() });

authRouter.post("/resend-otp", async (req, res, next) => {
  try {
    const input = resendOtpSchema.parse(req.body);
    const result = await resendOtp(input.userId);
    res.json({ message: "OTP resent.", expiresAt: result.expiresAt, devOtp: result.devOtp });
  } catch (err) {
    next(err);
  }
});

const loginSchema = z.object({
  identifier: z.string().min(3),
  password: z.string().min(1),
});

authRouter.post("/login", async (req, res, next) => {
  try {
    const input = loginSchema.parse(req.body);
    const { user, tokens } = await loginUser(input.identifier, input.password, {
      userAgent: req.headers["user-agent"],
      ipAddress: req.ip,
    });
    setRefreshCookie(res, tokens.refreshToken, tokens.refreshExpiresAt);
    res.json({
      accessToken: tokens.accessToken,
      user: { id: user.id, fullName: user.fullName, role: user.role, status: user.status },
    });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/refresh", async (req, res, next) => {
  try {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (!token) return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "No refresh token." } });

    const { user, tokens } = await refreshSession(token, {
      userAgent: req.headers["user-agent"],
      ipAddress: req.ip,
    });
    setRefreshCookie(res, tokens.refreshToken, tokens.refreshExpiresAt);
    res.json({ accessToken: tokens.accessToken, user: { id: user.id, role: user.role } });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/logout", async (req, res, next) => {
  try {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (token) await revokeRefreshToken(token);
    res.clearCookie(REFRESH_COOKIE, { path: "/api/v1/auth" });
    res.json({ message: "Logged out." });
  } catch (err) {
    next(err);
  }
});

authRouter.get("/me", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) return res.status(404).json({ error: { code: "NOT_FOUND", message: "User not found." } });
    res.json({
      user: {
        id: user.id, fullName: user.fullName, email: user.email, phone: user.phone,
        role: user.role, status: user.status, phoneVerifiedAt: user.phoneVerifiedAt,
      },
    });
  } catch (err) {
    next(err);
  }
});
