import { prisma } from "../prisma";
import { Errors } from "../utils/errors";

export async function listVerificationQueue() {
  return prisma.providerProfile.findMany({
    where: { verificationStatus: "PENDING_VERIFICATION", submittedAt: { not: null } },
    orderBy: { submittedAt: "asc" },
    include: { user: true, documents: true, services: { include: { subService: true } } },
  });
}

export async function getVerificationDetail(providerProfileId: string) {
  const profile = await prisma.providerProfile.findUnique({
    where: { id: providerProfileId },
    include: { user: true, documents: true, services: { include: { subService: true } }, availability: true },
  });
  if (!profile) throw Errors.notFound("Provider profile not found.");
  return profile;
}

export async function approveProvider(providerProfileId: string, adminId: string) {
  const profile = await prisma.providerProfile.findUnique({ where: { id: providerProfileId } });
  if (!profile) throw Errors.notFound("Provider profile not found.");

  await prisma.providerProfile.update({
    where: { id: providerProfileId },
    data: { verificationStatus: "APPROVED", reviewedAt: new Date(), reviewedBy: adminId, rejectionReason: null },
  });
  await prisma.user.update({ where: { id: profile.userId }, data: { status: "ACTIVE" } });

  return getVerificationDetail(providerProfileId);
}

export async function rejectProvider(providerProfileId: string, adminId: string, reason: string) {
  const profile = await prisma.providerProfile.findUnique({ where: { id: providerProfileId } });
  if (!profile) throw Errors.notFound("Provider profile not found.");

  await prisma.providerProfile.update({
    where: { id: providerProfileId },
    data: {
      verificationStatus: "REJECTED",
      reviewedAt: new Date(),
      reviewedBy: adminId,
      rejectionReason: reason,
      submittedAt: null,
    },
  });
  await prisma.user.update({ where: { id: profile.userId }, data: { status: "REJECTED" } });

  return getVerificationDetail(providerProfileId);
}

export async function suspendProvider(providerProfileId: string) {
  const profile = await prisma.providerProfile.findUnique({ where: { id: providerProfileId } });
  if (!profile) throw Errors.notFound("Provider profile not found.");

  await prisma.providerProfile.update({ where: { id: providerProfileId }, data: { isOnline: false } });
  await prisma.user.update({ where: { id: profile.userId }, data: { status: "SUSPENDED" } });

  return getVerificationDetail(providerProfileId);
}
