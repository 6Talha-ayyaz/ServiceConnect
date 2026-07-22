import { prisma } from "../prisma";
import { Errors } from "../utils/errors";
import { haversineDistanceKm } from "../utils/geo";
import { RequestStatus } from "@prisma/client";
import crypto from "crypto";
import { emitToUsers } from "../realtime";
import { generateInvoiceForRequest } from "./invoiceService";

const MAX_PENDING_PER_CUSTOMER = 3; // FR-5.7

function generateReference(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const suffix = crypto.randomInt(0, 100000).toString().padStart(5, "0");
  return `SR-${date}-${suffix}`;
}

interface CreateRequestInput {
  subServiceId: string;
  description?: string;
  photos?: string[];
  urgency: "IMMEDIATE" | "SAME_DAY_SCHEDULED" | "FUTURE_SCHEDULED";
  scheduledAt?: string;
  lat: number;
  lng: number;
  address: string;
}

export async function createServiceRequest(customerId: string, input: CreateRequestInput) {
  const pendingCount = await prisma.serviceRequest.count({
    where: { customerId, status: "PENDING" },
  });
  if (pendingCount >= MAX_PENDING_PER_CUSTOMER) {
    throw Errors.validation(`You can have at most ${MAX_PENDING_PER_CUSTOMER} pending requests at a time.`);
  }

  const subService = await prisma.subService.findUnique({ where: { id: input.subServiceId } });
  if (!subService || !subService.active) throw Errors.validation("Selected service is not available.");

  const request = await prisma.serviceRequest.create({
    data: {
      reference: generateReference(),
      customerId,
      subServiceId: input.subServiceId,
      description: input.description,
      photos: input.photos?.join(","),
      urgency: input.urgency,
      scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
      lat: input.lat,
      lng: input.lng,
      address: input.address,
      status: "PENDING",
    },
  });

  await prisma.jobEvent.create({
    data: { serviceRequestId: request.id, actorUserId: customerId, toStatus: "PENDING", notes: "Request created" },
  });

  const eligibleProviders = await eligibleProvidersFor(request.subServiceId, request.lat, request.lng);
  if (eligibleProviders.length === 0) {
    await prisma.serviceRequest.update({ where: { id: request.id }, data: { status: "UNFULFILLED" } });
    await prisma.jobEvent.create({
      data: { serviceRequestId: request.id, toStatus: "UNFULFILLED", notes: "No eligible providers at creation time" },
    });
    return { request: { ...request, status: "UNFULFILLED" as RequestStatus }, eligibleCount: 0 };
  }

  // FR-6.2: dispatch over a persistent WebSocket connection to every eligible provider.
  emitToUsers(
    eligibleProviders.map((p) => p.userId),
    "request:new",
    { requestId: request.id, subServiceId: request.subServiceId, address: request.address }
  );
  emitToUsers(eligibleProviders.map((p) => p.userId), "notification", {
    type: "REQUEST_NEW",
    title: "New job nearby",
    body: `A new ${subService.name} request just came in near you.`,
    requestId: request.id,
  });

  return { request, eligibleCount: eligibleProviders.length };
}

// FR-6.1: eligibility = active + online + offers the sub-service + within radius.
async function eligibleProvidersFor(subServiceId: string, lat: number, lng: number) {
  const candidates = await prisma.providerProfile.findMany({
    where: {
      verificationStatus: "APPROVED",
      isOnline: true,
      user: { status: "ACTIVE" },
      services: { some: { subServiceId } },
      baseLat: { not: null },
      baseLng: { not: null },
      radiusKm: { not: null },
    },
    include: { user: true },
  });

  return candidates.filter((p) => {
    const distanceKm = haversineDistanceKm(lat, lng, p.baseLat!, p.baseLng!);
    return distanceKm <= p.radiusKm!;
  });
}

export async function listAvailableForProvider(providerUserId: string) {
  const profile = await prisma.providerProfile.findUnique({ where: { userId: providerUserId } });
  if (!profile || profile.verificationStatus !== "APPROVED" || !profile.baseLat || !profile.baseLng || !profile.radiusKm) {
    return [];
  }

  const myServiceIds = (
    await prisma.providerService.findMany({ where: { providerId: profile.id }, select: { subServiceId: true } })
  ).map((s) => s.subServiceId);

  const declined = (
    await prisma.providerDecline.findMany({ where: { providerId: profile.id }, select: { serviceRequestId: true } })
  ).map((d) => d.serviceRequestId);

  const requests = await prisma.serviceRequest.findMany({
    where: {
      status: "PENDING",
      subServiceId: { in: myServiceIds },
      id: { notIn: declined },
    },
    include: { subService: true },
    orderBy: { createdAt: "asc" },
  });

  return requests
    .map((r) => ({
      ...r,
      distanceKm: haversineDistanceKm(r.lat, r.lng, profile.baseLat!, profile.baseLng!),
    }))
    .filter((r) => r.distanceKm <= profile.radiusKm!);
}

const STATUS_MESSAGES: Partial<Record<RequestStatus, string>> = {
  ASSIGNED: "A provider accepted your request.",
  EN_ROUTE: "Your provider is on the way.",
  ARRIVED: "Your provider has arrived.",
  IN_PROGRESS: "Your job has started.",
  AWAITING_CONFIRMATION: "Your provider marked the job done — please confirm completion.",
  COMPLETED: "Job completed. Thanks for using ServiceConnect!",
  CANCELLED: "The request was cancelled.",
};

async function notifyRequestParties(request: Awaited<ReturnType<typeof getRequestDetail>>) {
  const recipients = [request.customerId];
  if (request.assignedProvider) recipients.push(request.assignedProvider.userId);

  emitToUsers(recipients, "request:updated", { requestId: request.id, status: request.status });

  const message = STATUS_MESSAGES[request.status];
  if (message) {
    emitToUsers(recipients, "notification", {
      type: "REQUEST_STATUS",
      title: request.subService.name,
      body: message,
      requestId: request.id,
    });
  }
}

export async function acceptRequest(requestId: string, providerUserId: string) {
  const profile = await prisma.providerProfile.findUnique({ where: { userId: providerUserId } });
  if (!profile || profile.verificationStatus !== "APPROVED") throw Errors.forbidden("Provider is not verified.");

  const result = await prisma.serviceRequest.updateMany({
    where: { id: requestId, status: "PENDING", assignedProviderId: null },
    data: { status: "ASSIGNED", assignedProviderId: profile.id, assignedAt: new Date() },
  });

  if (result.count === 0) {
    throw Errors.conflict("This request has already been taken or is no longer available.");
  }

  await prisma.jobEvent.create({
    data: { serviceRequestId: requestId, actorUserId: providerUserId, fromStatus: "PENDING", toStatus: "ASSIGNED" },
  });

  const detail = await getRequestDetail(requestId);
  await notifyRequestParties(detail);
  return detail;
}

export async function declineRequest(requestId: string, providerUserId: string, reason?: string) {
  const profile = await prisma.providerProfile.findUnique({ where: { userId: providerUserId } });
  if (!profile) throw Errors.notFound("Provider profile not found.");

  await prisma.providerDecline.upsert({
    where: { serviceRequestId_providerId: { serviceRequestId: requestId, providerId: profile.id } },
    update: { reason },
    create: { serviceRequestId: requestId, providerId: profile.id, reason },
  });
}

const TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  PENDING: ["ASSIGNED", "UNFULFILLED", "CANCELLED"],
  ASSIGNED: ["EN_ROUTE", "CANCELLED"],
  EN_ROUTE: ["ARRIVED", "CANCELLED"],
  ARRIVED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["AWAITING_CONFIRMATION"],
  AWAITING_CONFIRMATION: ["COMPLETED"],
  COMPLETED: [],
  UNFULFILLED: ["PENDING"],
  CANCELLED: [],
};

async function transition(requestId: string, actorUserId: string, toStatus: RequestStatus, notes?: string) {
  const request = await prisma.serviceRequest.findUnique({ where: { id: requestId } });
  if (!request) throw Errors.notFound("Request not found.");

  const allowed = TRANSITIONS[request.status];
  if (!allowed.includes(toStatus)) {
    throw Errors.validation(`Cannot move from ${request.status} to ${toStatus}.`);
  }

  await prisma.serviceRequest.update({ where: { id: requestId }, data: { status: toStatus } });
  await prisma.jobEvent.create({
    data: { serviceRequestId: requestId, actorUserId, fromStatus: request.status, toStatus, notes },
  });

  const detail = await getRequestDetail(requestId);
  await notifyRequestParties(detail);
  return detail;
}

async function assertProviderOwnsRequest(requestId: string, providerUserId: string) {
  const profile = await prisma.providerProfile.findUnique({ where: { userId: providerUserId } });
  const request = await prisma.serviceRequest.findUnique({ where: { id: requestId } });
  if (!profile || !request || request.assignedProviderId !== profile.id) {
    throw Errors.forbidden("You are not assigned to this request.");
  }
}

export async function markEnRoute(requestId: string, providerUserId: string) {
  await assertProviderOwnsRequest(requestId, providerUserId);
  return transition(requestId, providerUserId, "EN_ROUTE");
}

export async function markArrived(requestId: string, providerUserId: string) {
  await assertProviderOwnsRequest(requestId, providerUserId);
  return transition(requestId, providerUserId, "ARRIVED");
}

export async function startJob(requestId: string, providerUserId: string) {
  await assertProviderOwnsRequest(requestId, providerUserId);
  return transition(requestId, providerUserId, "IN_PROGRESS");
}

export async function markJobDone(requestId: string, providerUserId: string) {
  await assertProviderOwnsRequest(requestId, providerUserId);
  return transition(requestId, providerUserId, "AWAITING_CONFIRMATION");
}

export async function confirmCompletion(requestId: string, customerId: string) {
  const request = await prisma.serviceRequest.findUnique({ where: { id: requestId } });
  if (!request || request.customerId !== customerId) throw Errors.forbidden("Not your request.");
  const result = await transition(requestId, customerId, "COMPLETED");
  await generateInvoiceForRequest(requestId); // FR-9.2: itemised invoice on job completion
  return result;
}

export async function cancelRequest(requestId: string, actorUserId: string, reason?: string) {
  const request = await prisma.serviceRequest.findUnique({ where: { id: requestId } });
  if (!request) throw Errors.notFound("Request not found.");

  const profile = await prisma.providerProfile.findUnique({ where: { userId: actorUserId } });
  const isCustomer = request.customerId === actorUserId;
  const isAssignedProvider = profile && request.assignedProviderId === profile.id;
  if (!isCustomer && !isAssignedProvider) throw Errors.forbidden("You cannot cancel this request.");

  if (!TRANSITIONS[request.status]?.includes("CANCELLED")) {
    throw Errors.validation(`Cannot cancel a request in status ${request.status}.`);
  }

  await prisma.serviceRequest.update({
    where: { id: requestId },
    data: { status: "CANCELLED", cancelledBy: actorUserId, cancelReason: reason },
  });
  await prisma.jobEvent.create({
    data: { serviceRequestId: requestId, actorUserId, fromStatus: request.status, toStatus: "CANCELLED", notes: reason },
  });

  const detail = await getRequestDetail(requestId);
  await notifyRequestParties(detail);
  return detail;
}

export async function getRequestDetail(requestId: string) {
  const request = await prisma.serviceRequest.findUnique({
    where: { id: requestId },
    include: {
      subService: true,
      customer: true,
      assignedProvider: { include: { user: true } },
      events: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!request) throw Errors.notFound("Request not found.");
  return request;
}

export async function listMyRequests(customerId: string) {
  return prisma.serviceRequest.findMany({
    where: { customerId },
    include: { subService: true, assignedProvider: { include: { user: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function listMyActiveJobs(providerUserId: string) {
  const profile = await prisma.providerProfile.findUnique({ where: { userId: providerUserId } });
  if (!profile) return [];
  return prisma.serviceRequest.findMany({
    where: { assignedProviderId: profile.id, status: { notIn: ["COMPLETED", "CANCELLED"] } },
    include: { subService: true, customer: true },
    orderBy: { createdAt: "desc" },
  });
}
