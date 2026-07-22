import request from "supertest";
import { createApp } from "../app";
import { prisma } from "../prisma";

const app = createApp();

function uniquePhone() {
  return "+9231" + Math.floor(10000000 + Math.random() * 89999999);
}

async function registerAndVerify(role: "PROVIDER" | "CUSTOMER", email: string) {
  const phone = uniquePhone();
  const reg = await request(app).post("/api/v1/auth/register").send({
    fullName: "Test User",
    phone,
    email,
    password: "Str0ng!Passw0rd",
    role,
  });
  await request(app).post("/api/v1/auth/verify-otp").send({ userId: reg.body.user.id, code: reg.body.devOtp });
  const login = await request(app).post("/api/v1/auth/login").send({ identifier: email, password: "Str0ng!Passw0rd" });
  return { userId: reg.body.user.id, accessToken: login.body.accessToken as string, phone };
}

async function cleanupUser(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return;
  const profile = await prisma.providerProfile.findUnique({ where: { userId: user.id } });
  if (profile) {
    await prisma.providerService.deleteMany({ where: { providerId: profile.id } });
    await prisma.providerDocument.deleteMany({ where: { providerId: profile.id } });
    await prisma.providerAvailability.deleteMany({ where: { providerId: profile.id } });
    await prisma.providerProfile.delete({ where: { id: profile.id } });
  }
  await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
  await prisma.otp.deleteMany({ where: { userId: user.id } });
  await prisma.user.delete({ where: { id: user.id } });
}

afterAll(async () => {
  await prisma.$disconnect();
});

describe("Provider onboarding and admin verification (FR-2)", () => {
  const providerEmail = "provider.onboard@example.com";
  let providerToken: string;
  let providerUserId: string;
  let subServiceId: string;
  let adminToken: string;

  beforeAll(async () => {
    const category = await prisma.category.findFirstOrThrow({ where: { slug: "plumbing" } });
    subServiceId = (await prisma.subService.findFirstOrThrow({ where: { categoryId: category.id } })).id;

    const provider = await registerAndVerify("PROVIDER", providerEmail);
    providerToken = provider.accessToken;
    providerUserId = provider.userId;

    const adminLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({ identifier: "admin@serviceconnect.local", password: "Admin!2026Strong" });
    adminToken = adminLogin.body.accessToken;
  });

  afterAll(async () => cleanupUser(providerEmail));

  it("registers a provider with PENDING_VERIFICATION status", async () => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: providerUserId } });
    expect(user.status).toBe("PENDING_VERIFICATION");
  });

  it("lists the public catalogue", async () => {
    const res = await request(app).get("/api/v1/categories");
    expect(res.status).toBe(200);
    expect(res.body.categories.length).toBeGreaterThan(0);
  });

  it("rejects submission when onboarding is incomplete", async () => {
    const res = await request(app)
      .post("/api/v1/providers/me/submit")
      .set("Authorization", `Bearer ${providerToken}`);
    expect(res.status).toBe(400);
    expect(res.body.error.details.length).toBeGreaterThan(0);
  });

  it("saves personal details", async () => {
    const res = await request(app)
      .patch("/api/v1/providers/me/personal-details")
      .set("Authorization", `Bearer ${providerToken}`)
      .send({ legalName: "Ali Khan", cnic: "3520112223334", dateOfBirth: "1990-01-01", yearsExperience: 5 });
    expect(res.status).toBe(200);
    expect(res.body.profile.legalName).toBe("Ali Khan");
  });

  it("saves services and pricing", async () => {
    const res = await request(app)
      .put("/api/v1/providers/me/services")
      .set("Authorization", `Bearer ${providerToken}`)
      .send({ services: [{ subServiceId, pricingModel: "FIXED", basePrice: 150000 }] });
    expect(res.status).toBe(200);
    expect(res.body.profile.services).toHaveLength(1);
  });

  it("rejects a coverage radius outside 1-50km", async () => {
    const res = await request(app)
      .patch("/api/v1/providers/me/coverage")
      .set("Authorization", `Bearer ${providerToken}`)
      .send({ baseLat: 31.5, baseLng: 74.3, baseAddress: "Lahore", radiusKm: 100 });
    expect(res.status).toBe(400);
  });

  it("saves valid coverage", async () => {
    const res = await request(app)
      .patch("/api/v1/providers/me/coverage")
      .set("Authorization", `Bearer ${providerToken}`)
      .send({ baseLat: 31.5, baseLng: 74.3, baseAddress: "Lahore", radiusKm: 10 });
    expect(res.status).toBe(200);
  });

  it("uploads a verification document", async () => {
    const res = await request(app)
      .post("/api/v1/providers/me/documents")
      .set("Authorization", `Bearer ${providerToken}`)
      .field("type", "ID_FRONT")
      .attach("file", Buffer.from("fake-image-content"), { filename: "id.jpg", contentType: "image/jpeg" });
    expect(res.status).toBe(201);
    expect(res.body.document.fileUrl).toMatch(/^\/uploads\//);
  });

  it("accepts terms of service", async () => {
    const res = await request(app)
      .post("/api/v1/providers/me/accept-terms")
      .set("Authorization", `Bearer ${providerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.profile.tosAcceptedAt).toBeTruthy();
  });

  it("submits for verification once complete", async () => {
    const res = await request(app)
      .post("/api/v1/providers/me/submit")
      .set("Authorization", `Bearer ${providerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.profile.submittedAt).toBeTruthy();
  });

  it("prevents going online before verification", async () => {
    const res = await request(app)
      .patch("/api/v1/providers/me/online-status")
      .set("Authorization", `Bearer ${providerToken}`)
      .send({ online: true });
    expect(res.status).toBe(403);
  });

  it("rejects non-admin access to the verification queue", async () => {
    const res = await request(app)
      .get("/api/v1/admin/verifications")
      .set("Authorization", `Bearer ${providerToken}`);
    expect(res.status).toBe(403);
  });

  it("shows the provider in the admin verification queue", async () => {
    const res = await request(app).get("/api/v1/admin/verifications").set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.queue.some((p: { userId: string }) => p.userId === providerUserId)).toBe(true);
  });

  it("approves the provider, activating the account", async () => {
    const profile = await prisma.providerProfile.findUniqueOrThrow({ where: { userId: providerUserId } });
    const res = await request(app)
      .post(`/api/v1/admin/verifications/${profile.id}/approve`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);

    const user = await prisma.user.findUniqueOrThrow({ where: { id: providerUserId } });
    expect(user.status).toBe("ACTIVE");
  });

  it("allows going online after approval", async () => {
    const res = await request(app)
      .patch("/api/v1/providers/me/online-status")
      .set("Authorization", `Bearer ${providerToken}`)
      .send({ online: true });
    expect(res.status).toBe(200);
    expect(res.body.profile.isOnline).toBe(true);
  });
});
