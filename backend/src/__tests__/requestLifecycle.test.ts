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

async function fullyOnboardAndApproveProvider(accessToken: string, userId: string, subServiceId: string, lat: number, lng: number, radiusKm: number) {
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
    .send({ baseLat: lat, baseLng: lng, baseAddress: "Lahore", radiusKm });
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
  if (profile) {
    await prisma.serviceRequest.updateMany({ where: { assignedProviderId: profile.id }, data: { assignedProviderId: null } });
    await prisma.providerDecline.deleteMany({ where: { providerId: profile.id } });
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

describe("Service request creation and matching (FR-5, FR-6)", () => {
  const customerEmail = "customer.req@example.com";
  const providerEmail = "provider.req@example.com";
  const farProviderEmail = "provider.far@example.com";
  let customerToken: string;
  let customerUserId: string;
  let providerToken: string;
  let providerUserId: string;
  let subServiceId: string;

  const LAHORE = { lat: 31.5204, lng: 74.3587 };
  const FAR_AWAY = { lat: 24.8607, lng: 67.0011 }; // Karachi, >1000km away

  beforeAll(async () => {
    const category = await prisma.category.findFirstOrThrow({ where: { slug: "plumbing" } });
    subServiceId = (await prisma.subService.findFirstOrThrow({ where: { categoryId: category.id } })).id;

    const customer = await registerAndVerify("CUSTOMER", customerEmail);
    customerToken = customer.accessToken;
    customerUserId = customer.userId;

    const provider = await registerAndVerify("PROVIDER", providerEmail);
    providerToken = provider.accessToken;
    providerUserId = provider.userId;
    await fullyOnboardAndApproveProvider(providerToken, providerUserId, subServiceId, LAHORE.lat, LAHORE.lng, 15);

    const farProvider = await registerAndVerify("PROVIDER", farProviderEmail);
    await fullyOnboardAndApproveProvider(farProvider.accessToken, farProvider.userId, subServiceId, FAR_AWAY.lat, FAR_AWAY.lng, 15);
  });

  afterAll(async () => {
    await cleanupUser(customerEmail);
    await cleanupUser(providerEmail);
    await cleanupUser(farProviderEmail);
  });

  let requestId: string;

  it("creates a service request and finds eligible providers nearby", async () => {
    const res = await request(app)
      .post("/api/v1/requests")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        subServiceId,
        description: "Leaking tap in kitchen",
        urgency: "IMMEDIATE",
        lat: LAHORE.lat + 0.01,
        lng: LAHORE.lng + 0.01,
        address: "123 Main St, Lahore",
      });
    expect(res.status).toBe(201);
    expect(res.body.eligibleCount).toBe(1);
    expect(res.body.request.status).toBe("PENDING");
    requestId = res.body.request.id;
  });

  it("enforces the max 3 pending requests per customer", async () => {
    for (let i = 0; i < 3; i++) {
      await request(app)
        .post("/api/v1/requests")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({ subServiceId, urgency: "IMMEDIATE", lat: LAHORE.lat, lng: LAHORE.lng, address: "Somewhere" });
    }
    const res = await request(app)
      .post("/api/v1/requests")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ subServiceId, urgency: "IMMEDIATE", lat: LAHORE.lat, lng: LAHORE.lng, address: "Somewhere" });
    expect(res.status).toBe(400);
  });

  it("shows the request to the nearby provider but not implicitly to the far one", async () => {
    const res = await request(app).get("/api/v1/requests/available").set("Authorization", `Bearer ${providerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.requests.some((r: { id: string }) => r.id === requestId)).toBe(true);
  });

  it("lets the provider accept the request atomically", async () => {
    const res = await request(app)
      .post(`/api/v1/requests/${requestId}/accept`)
      .set("Authorization", `Bearer ${providerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.request.status).toBe("ASSIGNED");
  });

  it("rejects a second accept attempt on the same request", async () => {
    const res = await request(app)
      .post(`/api/v1/requests/${requestId}/accept`)
      .set("Authorization", `Bearer ${providerToken}`);
    expect(res.status).toBe(409);
  });
});

describe("Job lifecycle state machine (FR-7)", () => {
  const customerEmail = "customer.job@example.com";
  const providerEmail = "provider.job@example.com";
  let customerToken: string;
  let providerToken: string;
  let providerUserId: string;
  let subServiceId: string;
  let requestId: string;

  const LAHORE = { lat: 31.5204, lng: 74.3587 };

  beforeAll(async () => {
    const category = await prisma.category.findFirstOrThrow({ where: { slug: "electrical" } });
    subServiceId = (await prisma.subService.findFirstOrThrow({ where: { categoryId: category.id } })).id;

    const customer = await registerAndVerify("CUSTOMER", customerEmail);
    customerToken = customer.accessToken;

    const provider = await registerAndVerify("PROVIDER", providerEmail);
    providerToken = provider.accessToken;
    providerUserId = provider.userId;
    await fullyOnboardAndApproveProvider(providerToken, providerUserId, subServiceId, LAHORE.lat, LAHORE.lng, 15);

    const createRes = await request(app)
      .post("/api/v1/requests")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ subServiceId, urgency: "IMMEDIATE", lat: LAHORE.lat, lng: LAHORE.lng, address: "Lahore" });
    requestId = createRes.body.request.id;

    await request(app).post(`/api/v1/requests/${requestId}/accept`).set("Authorization", `Bearer ${providerToken}`);
  });

  afterAll(async () => {
    await cleanupUser(customerEmail);
    await cleanupUser(providerEmail);
  });

  it("walks through the full happy-path state machine", async () => {
    const enRoute = await request(app).post(`/api/v1/requests/${requestId}/en-route`).set("Authorization", `Bearer ${providerToken}`);
    expect(enRoute.body.request.status).toBe("EN_ROUTE");

    const arrived = await request(app).post(`/api/v1/requests/${requestId}/arrived`).set("Authorization", `Bearer ${providerToken}`);
    expect(arrived.body.request.status).toBe("ARRIVED");

    const started = await request(app).post(`/api/v1/requests/${requestId}/start`).set("Authorization", `Bearer ${providerToken}`);
    expect(started.body.request.status).toBe("IN_PROGRESS");

    const done = await request(app).post(`/api/v1/requests/${requestId}/job-done`).set("Authorization", `Bearer ${providerToken}`);
    expect(done.body.request.status).toBe("AWAITING_CONFIRMATION");

    const confirmed = await request(app).post(`/api/v1/requests/${requestId}/confirm`).set("Authorization", `Bearer ${customerToken}`);
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.request.status).toBe("COMPLETED");
  });

  it("rejects an invalid transition (e.g. re-confirming a completed job)", async () => {
    const res = await request(app).post(`/api/v1/requests/${requestId}/confirm`).set("Authorization", `Bearer ${customerToken}`);
    expect(res.status).toBe(400);
  });

  it("prevents a stranger provider from acting on someone else's job", async () => {
    const stranger = await registerAndVerify("PROVIDER", "stranger.job@example.com");
    const res = await request(app).post(`/api/v1/requests/${requestId}/en-route`).set("Authorization", `Bearer ${stranger.accessToken}`);
    expect(res.status).toBe(403);
    await cleanupUser("stranger.job@example.com");
  });
});
