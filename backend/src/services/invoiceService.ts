import { prisma } from "../prisma";
import { Errors } from "../utils/errors";

const DEFAULT_COMMISSION_BP = 1500; // 15% (FR-9.5), configurable per category in a future release

export async function generateInvoiceForRequest(requestId: string) {
  const existing = await prisma.invoice.findUnique({ where: { serviceRequestId: requestId } });
  if (existing) return existing;

  const request = await prisma.serviceRequest.findUnique({
    where: { id: requestId },
    include: { assignedProvider: true },
  });
  if (!request || !request.assignedProviderId) throw Errors.notFound("Request or assigned provider not found.");

  const providerService = await prisma.providerService.findUnique({
    where: { providerId_subServiceId: { providerId: request.assignedProviderId, subServiceId: request.subServiceId } },
  });

  const subtotal = providerService?.basePrice ?? providerService?.hourlyRate ?? providerService?.calloutFee ?? 0;
  const commissionAmount = Math.round((subtotal * DEFAULT_COMMISSION_BP) / 10000);

  return prisma.invoice.create({
    data: {
      serviceRequestId: requestId,
      subtotal,
      commissionRateBp: DEFAULT_COMMISSION_BP,
      commissionAmount,
      total: subtotal,
    },
  });
}

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

export async function getInvoice(requestId: string, userId: string) {
  await assertParticipant(requestId, userId);
  const invoice = await prisma.invoice.findUnique({ where: { serviceRequestId: requestId } });
  if (!invoice) throw Errors.notFound("Invoice not available yet.");
  return invoice;
}

export async function payInvoice(requestId: string, userId: string, paymentMethod: "CASH" | "CARD" | "WALLET") {
  await assertParticipant(requestId, userId);
  const invoice = await prisma.invoice.findUnique({ where: { serviceRequestId: requestId } });
  if (!invoice) throw Errors.notFound("Invoice not available yet.");
  if (invoice.paidAt) throw Errors.conflict("Invoice has already been paid.");

  return prisma.invoice.update({
    where: { serviceRequestId: requestId },
    data: { paidAt: new Date(), paymentMethod },
  });
}

// FR-9.7: sum of paid invoices' (subtotal - commission) for a provider's wallet view.
export async function getProviderEarnings(providerUserId: string) {
  const profile = await prisma.providerProfile.findUnique({ where: { userId: providerUserId } });
  if (!profile) return { totalEarnings: 0, pendingEarnings: 0, jobsPaid: 0 };

  const invoices = await prisma.invoice.findMany({
    where: { serviceRequest: { assignedProviderId: profile.id } },
  });

  const paid = invoices.filter((i) => i.paidAt);
  const unpaid = invoices.filter((i) => !i.paidAt);

  const totalEarnings = paid.reduce((sum, i) => sum + (i.subtotal - i.commissionAmount), 0);
  const pendingEarnings = unpaid.reduce((sum, i) => sum + (i.subtotal - i.commissionAmount), 0);

  return { totalEarnings, pendingEarnings, jobsPaid: paid.length };
}
