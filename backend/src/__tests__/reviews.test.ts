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
  return { userId: reg.body.user.id, accessToken: login.body.accessToken as string };
}

async function fullyOnboardAndApproveProvider(accessToken: string, userId: string, subServiceId: string) {
  await request(app)
    .patch("/api/v1/providers/me/personal-details")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ legalName: "Ali Khan", cnic: "3520112223334", dateOfBirth: "1990-01-01" });
  await request(app)
    .put("/api/v1/providers/me/services")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ services: [{ subServiceId, pricingModel: "FIXED", basePrice: 150000 }] });
  await request(app)
    .patch("/api/v1/providers/me/coverage")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ baseLat: 31.5204, baseLng: 74.3587, baseAddress: "Lahore", radiusKm: 15 });
  await request(app)
    .post("/api/v1/providers/me/documents")
    .set("Authorization", `Bearer ${accessToken}`)
    .field("type", "ID_FRONT")
    .attach("file", Buffer.from("fake"), { filename: "id.jpg", contentType: "image/jpeg" });
  await request(app).post("/api/v1/providers/me/accept-terms").set("Authorization", `Bearer ${accessToken}`);
  await request(app).post("/api/v1/providers/me/submit").set("Authorization", `Bearer ${accessToken}`);

  const adminLogin = await request(app)
    .post("/api/v1/auth/login")
    .send({ identifier: "admin@serviceconnect.local", password: "Admin!2026Strong" });
  const profile = await prisma.providerProfile.findUniqueOrThrow({ where: { userId } });
  await request(app)
    .post(`/api/v1/admin/verifications/${profile.id}/approve`)
    .set("Authorization", `Bearer ${adminLogin.body.accessToken}`);

  await request(app)
    .patch("/api/v1/providers/me/online-status")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ online: true });
}

async function cleanupUser(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return;
  const profile = await prisma.providerProfile.findUnique({ where: { userId: user.id } });
  await prisma.review.deleteMany({ where: { OR: [{ authorId: user.id }, { revieweeId: user.id }] } });
  if (profile) {
    await prisma.serviceRequest.updateMany({ where: { assignedProviderId: profile.id }, data: { assignedProviderId: null } });
    await prisma.providerService.deleteMany({ where: { providerId: profile.id } });
    await prisma.providerDocument.deleteMany({ where: { providerId: profile.id } });
    await prisma.providerAvailability.deleteMany({ where: { providerId: profile.id } });
    await prisma.providerProfile.delete({ where: { id: profile.id } });
  }
  await prisma.jobEvent.deleteMany({ where: { serviceRequest: { customerId: user.id } } });
  await prisma.message.deleteMany({ where: { serviceRequest: { customerId: user.id } } });
  await prisma.invoice.deleteMany({ where: { serviceRequest: { customerId: user.id } } });
  await prisma.serviceRequest.deleteMany({ where: { customerId: user.id } });
  await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
  await prisma.otp.deleteMany({ where: { userId: user.id } });
  await prisma.user.delete({ where: { id: user.id } });
}

afterAll(async () => {
  await prisma.$disconnect();
});

describe("Ratings and reviews (FR-10)", () => {
  const customerEmail = "customer.review@example.com";
  const providerEmail = "provider.review@example.com";
  let customerToken: string;
  let providerUserId: string;
  let requestId: string;

  beforeAll(async () => {
    const category = await prisma.category.findFirstOrThrow({ where: { slug: "painting" } });
    const subServiceId = (await prisma.subService.findFirstOrThrow({ where: { categoryId: category.id } })).id;

    const customer = await registerAndVerify("CUSTOMER", customerEmail);
    customerToken = customer.accessToken;

    const provider = await registerAndVerify("PROVIDER", providerEmail);
    providerUserId = provider.userId;
    await fullyOnboardAndApproveProvider(provider.accessToken, provider.userId, subServiceId);

    const createRes = await request(app)
      .post("/api/v1/requests")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ subServiceId, urgency: "IMMEDIATE", lat: 31.5204, lng: 74.3587, address: "Lahore" });
    requestId = createRes.body.request.id;

    await request(app).post(`/api/v1/requests/${requestId}/accept`).set("Authorization", `Bearer ${provider.accessToken}`);
    await request(app).post(`/api/v1/requests/${requestId}/en-route`).set("Authorization", `Bearer ${provider.accessToken}`);
    await request(app).post(`/api/v1/requests/${requestId}/arrived`).set("Authorization", `Bearer ${provider.accessToken}`);
    await request(app).post(`/api/v1/requests/${requestId}/start`).set("Authorization", `Bearer ${provider.accessToken}`);
    await request(app).post(`/api/v1/requests/${requestId}/job-done`).set("Authorization", `Bearer ${provider.accessToken}`);
    await request(app).post(`/api/v1/requests/${requestId}/confirm`).set("Authorization", `Bearer ${customerToken}`);
  });

  afterAll(async () => {
    await cleanupUser(customerEmail);
    await cleanupUser(providerEmail);
  });

  it("rejects a review on a non-completed job", async () => {
    const pendingCategory = await prisma.category.findFirstOrThrow({ where: { slug: "carpentry" } });
    const pendingSub = (await prisma.subService.findFirstOrThrow({ where: { categoryId: pendingCategory.id } })).id;
    const pendingReq = await request(app)
      .post("/api/v1/requests")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ subServiceId: pendingSub, urgency: "IMMEDIATE", lat: 31.5204, lng: 74.3587, address: "Lahore" });

    const res = await request(app)
      .post(`/api/v1/requests/${pendingReq.body.request.id}/review`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ rating: 5 });
    expect(res.status).toBe(400);
  });

  it("lets the customer review the provider after completion", async () => {
    const res = await request(app)
      .post(`/api/v1/requests/${requestId}/review`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ rating: 5, punctuality: 5, workQuality: 4, professionalism: 5, priceFairness: 4, comment: "Great work!" });
    expect(res.status).toBe(201);
    expect(res.body.review.revieweeId).toBe(providerUserId);
  });

  it("prevents a duplicate review from the same author", async () => {
    const res = await request(app)
      .post(`/api/v1/requests/${requestId}/review`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ rating: 3 });
    expect(res.status).toBe(409);
  });

  it("shows the review in the public provider profile only once a badge threshold discussion applies (isNewProvider true under 5 ratings)", async () => {
    const res = await request(app).get(`/api/v1/providers/public/${providerUserId}`);
    expect(res.status).toBe(200);
    expect(res.body.provider.rating.count).toBe(1);
    expect(res.body.provider.rating.isNewProvider).toBe(true);
    expect(res.body.provider.rating.average).toBeNull();
  });
});
