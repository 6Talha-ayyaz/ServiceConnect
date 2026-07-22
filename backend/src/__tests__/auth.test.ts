import request from "supertest";
import { createApp } from "../app";
import { prisma } from "../prisma";

const app = createApp();

function uniquePhone() {
  return "+9231" + Math.floor(10000000 + Math.random() * 89999999);
}

async function cleanupUser(email: string, phone: string) {
  const user = await prisma.user.findFirst({ where: { OR: [{ email }, { phone }] } });
  if (!user) return;
  await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
  await prisma.otp.deleteMany({ where: { userId: user.id } });
  await prisma.user.delete({ where: { id: user.id } });
}

afterAll(async () => {
  await prisma.$disconnect();
});

describe("Auth: registration and OTP verification (FR-1.1 - FR-1.3)", () => {
  const email = "customer.test@example.com";
  const phone = uniquePhone();

  afterAll(async () => cleanupUser(email, phone));

  it("rejects a weak/common password", async () => {
    const res = await request(app).post("/api/v1/auth/register").send({
      fullName: "Test Customer",
      phone,
      email,
      password: "password",
      role: "CUSTOMER",
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("registers a new customer and issues an OTP", async () => {
    const res = await request(app).post("/api/v1/auth/register").send({
      fullName: "Test Customer",
      phone,
      email,
      password: "Str0ng!Passw0rd",
      role: "CUSTOMER",
    });
    expect(res.status).toBe(201);
    expect(res.body.user.status).toBe("ACTIVE");
    expect(res.body.devOtp).toHaveLength(6);
  });

  it("rejects duplicate registration with same phone/email", async () => {
    const res = await request(app).post("/api/v1/auth/register").send({
      fullName: "Dup",
      phone,
      email,
      password: "Str0ng!Passw0rd",
      role: "CUSTOMER",
    });
    expect(res.status).toBe(409);
  });

  it("verifies phone with correct OTP", async () => {
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    const otp = await prisma.otp.findFirstOrThrow({ where: { userId: user.id }, orderBy: { createdAt: "desc" } });
    // Re-issue via resend so we know the plaintext code in a test-safe way
    const resend = await request(app).post("/api/v1/auth/resend-otp").send({ userId: user.id });
    expect(resend.status).toBe(200);

    const res = await request(app).post("/api/v1/auth/verify-otp").send({ userId: user.id, code: resend.body.devOtp });
    expect(res.status).toBe(200);
    expect(res.body.user.status).toBe("ACTIVE");
    void otp;
  });
});

describe("Auth: login, lockout, refresh (FR-1.8 - FR-1.10)", () => {
  const email = "login.test@example.com";
  const phone = uniquePhone();
  const password = "Str0ng!Passw0rd";

  beforeAll(async () => {
    await request(app).post("/api/v1/auth/register").send({
      fullName: "Login Test",
      phone,
      email,
      password,
      role: "CUSTOMER",
    });
  });

  afterAll(async () => cleanupUser(email, phone));

  it("rejects invalid credentials", async () => {
    const res = await request(app).post("/api/v1/auth/login").send({ identifier: email, password: "wrong" });
    expect(res.status).toBe(401);
  });

  it("logs in with correct credentials and returns an access token + refresh cookie", async () => {
    const res = await request(app).post("/api/v1/auth/login").send({ identifier: email, password });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.headers["set-cookie"]?.[0]).toMatch(/sc_refresh_token/);
  });

  it("locks the account after 5 consecutive failed attempts", async () => {
    for (let i = 0; i < 5; i++) {
      await request(app).post("/api/v1/auth/login").send({ identifier: email, password: "wrong" });
    }
    const res = await request(app).post("/api/v1/auth/login").send({ identifier: email, password });
    expect(res.status).toBe(423);
  });

  it("allows access to /me with a valid access token", async () => {
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    await prisma.user.update({ where: { id: user.id }, data: { lockedUntil: null, failedLoginCount: 0 } });

    const login = await request(app).post("/api/v1/auth/login").send({ identifier: email, password });
    const me = await request(app).get("/api/v1/auth/me").set("Authorization", `Bearer ${login.body.accessToken}`);
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe(email);
  });

  it("rejects /me without a token", async () => {
    const res = await request(app).get("/api/v1/auth/me");
    expect(res.status).toBe(401);
  });
});
