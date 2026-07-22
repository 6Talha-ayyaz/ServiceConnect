import { prisma } from "../prisma";
import { Errors } from "../utils/errors";

interface ReviewInput {
  rating: number;
  punctuality?: number;
  workQuality?: number;
  professionalism?: number;
  priceFairness?: number;
  comment?: string;
}

export async function submitReview(requestId: string, authorId: string, input: ReviewInput) {
  const request = await prisma.serviceRequest.findUnique({
    where: { id: requestId },
    include: { assignedProvider: true },
  });
  if (!request) throw Errors.notFound("Request not found.");
  if (request.status !== "COMPLETED") throw Errors.validation("You can only review a completed job.");

  const isCustomer = request.customerId === authorId;
  const isProvider = request.assignedProvider?.userId === authorId;
  if (!isCustomer && !isProvider) throw Errors.forbidden("You were not part of this job.");

  const revieweeId = isCustomer ? request.assignedProvider!.userId : request.customerId;

  const existing = await prisma.review.findUnique({
    where: { serviceRequestId_authorId: { serviceRequestId: requestId, authorId } },
  });
  if (existing) throw Errors.conflict("You have already reviewed this job.");

  return prisma.review.create({
    data: {
      serviceRequestId: requestId,
      authorId,
      revieweeId,
      rating: input.rating,
      punctuality: input.punctuality,
      workQuality: input.workQuality,
      professionalism: input.professionalism,
      priceFairness: input.priceFairness,
      comment: input.comment,
    },
  });
}

export async function getReviewsForRequest(requestId: string) {
  return prisma.review.findMany({ where: { serviceRequestId: requestId } });
}

// FR-10.6: displayed rating = mean of last 50 ratings, only shown once >= 5 exist.
export async function getProviderRatingSummary(providerUserId: string) {
  const reviews = await prisma.review.findMany({
    where: { revieweeId: providerUserId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  if (reviews.length < 5) {
    return { count: reviews.length, average: null, isNewProvider: true };
  }

  const average = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
  return { count: reviews.length, average: Math.round(average * 10) / 10, isNewProvider: false };
}
