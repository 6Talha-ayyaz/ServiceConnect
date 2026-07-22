import { prisma } from "../prisma";

// FR-14.9: platform-wide analytics summary for the admin console.
export async function getAnalyticsSummary() {
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [
    totalCustomers,
    totalProviders,
    activeProviders,
    requestsToday,
    requestsLast30d,
    completedLast30d,
    cancelledLast30d,
    unfulfilledLast30d,
    paidInvoices,
    assignedRequests,
    reviews,
  ] = await Promise.all([
    prisma.user.count({ where: { role: "CUSTOMER" } }),
    prisma.user.count({ where: { role: "PROVIDER" } }),
    prisma.providerProfile.count({ where: { isOnline: true, verificationStatus: "APPROVED" } }),
    prisma.serviceRequest.count({ where: { createdAt: { gte: startOfToday } } }),
    prisma.serviceRequest.count({ where: { createdAt: { gte: since30d } } }),
    prisma.serviceRequest.count({ where: { createdAt: { gte: since30d }, status: "COMPLETED" } }),
    prisma.serviceRequest.count({ where: { createdAt: { gte: since30d }, status: "CANCELLED" } }),
    prisma.serviceRequest.count({ where: { createdAt: { gte: since30d }, status: "UNFULFILLED" } }),
    prisma.invoice.findMany({ where: { paidAt: { not: null } }, select: { subtotal: true, commissionAmount: true } }),
    prisma.serviceRequest.findMany({
      where: { createdAt: { gte: since30d }, assignedAt: { not: null } },
      select: { createdAt: true, assignedAt: true },
    }),
    prisma.review.findMany({ select: { rating: true } }),
  ]);

  const gmv = paidInvoices.reduce((sum, i) => sum + i.subtotal, 0);
  const commissionRevenue = paidInvoices.reduce((sum, i) => sum + i.commissionAmount, 0);

  const acceptTimesMinutes = assignedRequests.map(
    (r) => (r.assignedAt!.getTime() - r.createdAt.getTime()) / 60000
  );
  const medianTimeToAcceptMinutes = median(acceptTimesMinutes);

  const csat = reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : null;

  const fulfilmentDenominator = completedLast30d + cancelledLast30d + unfulfilledLast30d;
  const fulfilmentRate = fulfilmentDenominator > 0 ? completedLast30d / fulfilmentDenominator : null;
  const cancellationRate = fulfilmentDenominator > 0 ? cancelledLast30d / fulfilmentDenominator : null;

  return {
    totalCustomers,
    totalProviders,
    activeProviders,
    requestsToday,
    requestsLast30d,
    completedLast30d,
    cancelledLast30d,
    unfulfilledLast30d,
    fulfilmentRate,
    cancellationRate,
    medianTimeToAcceptMinutes,
    gmv,
    commissionRevenue,
    csat,
  };
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}
