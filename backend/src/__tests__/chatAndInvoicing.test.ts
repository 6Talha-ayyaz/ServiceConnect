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

async function fullyOnboardAndApproveProvider(accessToken: string, userId: string, subServiceId: string, basePrice: number) {
  await request(app)
    .patch("/api/v1/providers/me/personal-details")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ legalName: "Ali Khan", cnic: "3520112223334", dateOfBirth: "1990-01-01" });
  await request(app)
    .put("/api/v1/providers/me/services")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ services: [{ subServiceId, pricingModel: "FIXED", basePrice }] });
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

  return adminLogin.body.accessToken as string;
}

async function cleanupUser(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return;
  const profile = await prisma.providerProfile.findUnique({ where: { userId: user.id } });
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
  await prisma.review.deleteMany({ where: { OR: [{ authorId: user.id }, { revieweeId: user.id }] } });
  await prisma.serviceRequest.deleteMany({ where: { customerId: user.id } });
  await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
  await prisma.otp.deleteMany({ where: { userId: user.id } });
  await prisma.user.delete({ where: { id: user.id } });
}

afterAll(async () => {
  await prisma.$disconnect();
});

describe("Chat and invoicing (FR-8, FR-9)", () => {
  const customerEmail = "customer.chat@example.com";
  const providerEmail = "provider.chat@example.com";
  let customerToken: string;
  let providerToken: string;
  let requestId: string;
  const BASE_PRICE = 200000; // 2000.00 in minor units

  beforeAll(async () => {
    const category = await prisma.category.findFirstOrThrow({ where: { slug: "appliance-repair" } });
    const subServiceId = (await prisma.subService.findFirstOrThrow({ where: { categoryId: category.id } })).id;

    const customer = await registerAndVerify("CUSTOMER", customerEmail);
    customerToken = customer.accessToken;

    const provider = await registerAndVerify("PROVIDER", providerEmail);
    providerToken = provider.accessToken;
    await fullyOnboardAndApproveProvider(provider.accessToken, provider.userId, subServiceId, BASE_PRICE);

    const createRes = await request(app)
      .post("/api/v1/requests")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ subServiceId, urgency: "IMMEDIATE", lat: 31.5204, lng: 74.3587, address: "Lahore" });
    requestId = createRes.body.request.id;

    await request(app).post(`/api/v1/requests/${requestId}/accept`).set("Authorization", `Bearer ${providerToken}`);
  });

  afterAll(async () => {
    await cleanupUser(customerEmail);
    await cleanupUser(providerEmail);
  });

  it("lets the customer send a chat message once a provider is assigned", async () => {
    const res = await request(app)
      .post(`/api/v1/requests/${requestId}/messages`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ body: "Hi, when can you come?" });
    expect(res.status).toBe(201);
    expect(res.body.message.body).toBe("Hi, when can you come?");
    expect(res.body.redacted).toBe(false);
  });

  it("redacts a phone number shared in chat", async () => {
    const res = await request(app)
      .post(`/api/v1/requests/${requestId}/messages`)
      .set("Authorization", `Bearer ${providerToken}`)
      .send({ body: "Call me at 03001234567 directly" });
    expect(res.status).toBe(201);
    expect(res.body.redacted).toBe(true);
    expect(res.body.message.body).toContain("[hidden number]");
  });

  it("lists messages to both participants but blocks a stranger", async () => {
    const res = await request(app)
      .get(`/api/v1/requests/${requestId}/messages`)
      .set("Authorization", `Bearer ${customerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.messages.length).toBe(2);

    const stranger = await registerAndVerify("CUSTOMER", "stranger.chat@example.com");
    const blocked = await request(app)
      .get(`/api/v1/requests/${requestId}/messages`)
      .set("Authorization", `Bearer ${stranger.accessToken}`);
    expect(blocked.status).toBe(403);
    await cleanupUser("stranger.chat@example.com");
  });

  it("has no invoice before job completion", async () => {
    const res = await request(app)
      .get(`/api/v1/requests/${requestId}/invoice`)
      .set("Authorization", `Bearer ${customerToken}`);
    expect(res.status).toBe(404);
  });

  it("auto-generates an invoice on job completion with correct commission math", async () => {
    await request(app).post(`/api/v1/requests/${requestId}/en-route`).set("Authorization", `Bearer ${providerToken}`);
    await request(app).post(`/api/v1/requests/${requestId}/arrived`).set("Authorization", `Bearer ${providerToken}`);
    await request(app).post(`/api/v1/requests/${requestId}/start`).set("Authorization", `Bearer ${providerToken}`);
    await request(app).post(`/api/v1/requests/${requestId}/job-done`).set("Authorization", `Bearer ${providerToken}`);
    await request(app).post(`/api/v1/requests/${requestId}/confirm`).set("Authorization", `Bearer ${customerToken}`);

    const res = await request(app)
      .get(`/api/v1/requests/${requestId}/invoice`)
      .set("Authorization", `Bearer ${customerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.invoice.subtotal).toBe(BASE_PRICE);
    expect(res.body.invoice.commissionAmount).toBe(Math.round((BASE_PRICE * 1500) / 10000));
    expect(res.body.invoice.total).toBe(BASE_PRICE);
    expect(res.body.invoice.paidAt).toBeNull();
  });

  it("marks the invoice as paid and rejects a second payment", async () => {
    const res = await request(app)
      .post(`/api/v1/requests/${requestId}/invoice/pay`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ paymentMethod: "CASH" });
    expect(res.status).toBe(200);
    expect(res.body.invoice.paidAt).toBeTruthy();

    const second = await request(app)
      .post(`/api/v1/requests/${requestId}/invoice/pay`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ paymentMethod: "CASH" });
    expect(second.status).toBe(409);
  });

  it("reflects the paid invoice in provider earnings", async () => {
    const res = await request(app).get("/api/v1/providers/me/earnings").set("Authorization", `Bearer ${providerToken}`);
    expect(res.status).toBe(200);
    const expectedCommission = Math.round((BASE_PRICE * 1500) / 10000);
    expect(res.body.earnings.totalEarnings).toBe(BASE_PRICE - expectedCommission);
    expect(res.body.earnings.jobsPaid).toBe(1);
  });
});

describe("Admin analytics and catalogue management (FR-14.9, FR-3.5)", () => {
  let adminToken: string;

  beforeAll(async () => {
    const adminLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({ identifier: "admin@serviceconnect.local", password: "Admin!2026Strong" });
    adminToken = adminLogin.body.accessToken;
  });

  it("rejects analytics access for non-admins", async () => {
    const res = await request(app).get("/api/v1/admin/analytics");
    expect(res.status).toBe(401);
  });

  it("returns a platform analytics summary to admins", async () => {
    const res = await request(app).get("/api/v1/admin/analytics").set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(typeof res.body.summary.totalCustomers).toBe("number");
    expect(typeof res.body.summary.gmv).toBe("number");
  });

  it("creates, updates and deactivates a category without a code deployment", async () => {
    const create = await request(app)
      .post("/api/v1/admin/categories")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Test Category XYZ", icon: "🧪" });
    expect(create.status).toBe(201);
    const categoryId = create.body.category.id;

    const update = await request(app)
      .patch(`/api/v1/admin/categories/${categoryId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ description: "A test category" });
    expect(update.status).toBe(200);
    expect(update.body.category.description).toBe("A test category");

    const subService = await request(app)
      .post("/api/v1/admin/sub-services")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ categoryId, name: "Test Sub-service", defaultPricing: "FIXED" });
    expect(subService.status).toBe(201);

    const deactivate = await request(app)
      .post(`/api/v1/admin/categories/${categoryId}/deactivate`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(deactivate.status).toBe(200);
    expect(deactivate.body.category.active).toBe(false);

    // cleanup
    await prisma.subService.deleteMany({ where: { categoryId } });
    await prisma.category.delete({ where: { id: categoryId } });
  });
});
