import { prisma } from "../prisma";
import { Errors } from "../utils/errors";
import { emitToUsers } from "../realtime";

async function assertParticipant(requestId: string, userId: string) {
  const request = await prisma.serviceRequest.findUnique({
    where: { id: requestId },
    include: { assignedProvider: true },
  });
  if (!request) throw Errors.notFound("Request not found.");

  const isCustomer = request.customerId === userId;
  const isProvider = request.assignedProvider?.userId === userId;
  if (!isCustomer && !isProvider) throw Errors.forbidden("You are not part of this job.");

  return request;
}

// FR-8.5: redact phone numbers and emails to discourage off-platform circumvention.
const PHONE_PATTERN = /(\+?\d[\d\s-]{7,}\d)/g;
const EMAIL_PATTERN = /[\w.+-]+@[\w-]+\.[a-zA-Z]{2,}/g;

function redact(body: string): { text: string; redacted: boolean } {
  let redacted = false;
  const text = body
    .replace(PHONE_PATTERN, () => {
      redacted = true;
      return "[hidden number]";
    })
    .replace(EMAIL_PATTERN, () => {
      redacted = true;
      return "[hidden email]";
    });
  return { text, redacted };
}

export async function sendMessage(requestId: string, senderId: string, body: string, imageUrl?: string) {
  const request = await assertParticipant(requestId, senderId);
  if (!request.assignedProviderId) {
    throw Errors.validation("Chat is only available once a provider has been assigned.");
  }

  const { text, redacted } = redact(body);

  const message = await prisma.message.create({
    data: { serviceRequestId: requestId, senderId, body: text, imageUrl },
  });

  const recipients = [request.customerId, request.assignedProvider!.userId];
  emitToUsers(recipients, "message:new", {
    requestId,
    message: { id: message.id, senderId, body: text, imageUrl, createdAt: message.createdAt },
  });

  return { message, redacted };
}

export async function listMessages(requestId: string, userId: string) {
  await assertParticipant(requestId, userId);
  return prisma.message.findMany({ where: { serviceRequestId: requestId }, orderBy: { createdAt: "asc" } });
}
