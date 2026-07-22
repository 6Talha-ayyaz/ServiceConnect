import { prisma } from "../prisma";
import { Errors } from "../utils/errors";
import { PricingModel } from "@prisma/client";

const TOS_VERSION = "1.0";

export async function getOrCreateProviderProfile(userId: string) {
  let profile = await prisma.providerProfile.findUnique({ where: { userId } });
  if (!profile) {
    profile = await prisma.providerProfile.create({ data: { userId } });
  }
  return profile;
}

export async function getProviderProfileFull(userId: string) {
  return prisma.providerProfile.findUnique({
    where: { userId },
    include: { services: { include: { subService: true } }, documents: true, availability: true },
  });
}

interface PersonalDetailsInput {
  legalName: string;
  cnic: string;
  dateOfBirth: string;
  businessName?: string;
  yearsExperience?: number;
  languages?: string[];
  bio?: string;
}

export async function savePersonalDetails(userId: string, input: PersonalDetailsInput) {
  const profile = await getOrCreateProviderProfile(userId);
  return prisma.providerProfile.update({
    where: { id: profile.id },
    data: {
      legalName: input.legalName,
      cnic: input.cnic,
      dateOfBirth: new Date(input.dateOfBirth),
      businessName: input.businessName,
      yearsExperience: input.yearsExperience,
      languages: input.languages?.join(","),
      bio: input.bio,
    },
  });
}

interface ServiceInput {
  subServiceId: string;
  pricingModel: PricingModel;
  basePrice?: number;
  hourlyRate?: number;
  calloutFee?: number;
}

export async function saveServices(userId: string, services: ServiceInput[]) {
  const profile = await getOrCreateProviderProfile(userId);
  if (services.length === 0) throw Errors.validation("Select at least one service.");

  await prisma.$transaction([
    prisma.providerService.deleteMany({ where: { providerId: profile.id } }),
    prisma.providerService.createMany({
      data: services.map((s) => ({
        providerId: profile.id,
        subServiceId: s.subServiceId,
        pricingModel: s.pricingModel,
        basePrice: s.basePrice,
        hourlyRate: s.hourlyRate,
        calloutFee: s.calloutFee,
      })),
    }),
  ]);

  return getProviderProfileFull(userId);
}

interface CoverageInput {
  baseLat: number;
  baseLng: number;
  baseAddress: string;
  radiusKm: number;
}

export async function saveCoverage(userId: string, input: CoverageInput) {
  if (input.radiusKm < 1 || input.radiusKm > 50) {
    throw Errors.validation("Service radius must be between 1 km and 50 km.");
  }
  const profile = await getOrCreateProviderProfile(userId);
  return prisma.providerProfile.update({
    where: { id: profile.id },
    data: {
      baseLat: input.baseLat,
      baseLng: input.baseLng,
      baseAddress: input.baseAddress,
      radiusKm: input.radiusKm,
    },
  });
}

interface AvailabilitySlot {
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
}

export async function saveAvailability(userId: string, slots: AvailabilitySlot[]) {
  const profile = await getOrCreateProviderProfile(userId);
  await prisma.$transaction([
    prisma.providerAvailability.deleteMany({ where: { providerId: profile.id } }),
    ...(slots.length
      ? [
          prisma.providerAvailability.createMany({
            data: slots.map((s) => ({ providerId: profile.id, ...s })),
          }),
        ]
      : []),
  ]);
  return getProviderProfileFull(userId);
}

export async function addDocument(userId: string, type: string, fileUrl: string) {
  const profile = await getOrCreateProviderProfile(userId);
  return prisma.providerDocument.create({ data: { providerId: profile.id, type, fileUrl } });
}

export async function acceptTerms(userId: string) {
  const profile = await getOrCreateProviderProfile(userId);
  return prisma.providerProfile.update({
    where: { id: profile.id },
    data: { tosAcceptedAt: new Date(), tosVersion: TOS_VERSION },
  });
}

export async function submitForVerification(userId: string) {
  await getOrCreateProviderProfile(userId);
  const profile = await getProviderProfileFull(userId);
  if (!profile) throw Errors.notFound("Provider profile not found.");

  const problems: string[] = [];
  if (!profile.legalName || !profile.cnic || !profile.dateOfBirth) problems.push("Personal details are incomplete.");
  if (profile.services.length === 0) problems.push("Select at least one service.");
  if (!profile.baseLat || !profile.baseLng || !profile.radiusKm) problems.push("Coverage area is incomplete.");
  if (profile.documents.length === 0) problems.push("Upload at least your national ID document.");
  if (!profile.tosAcceptedAt) problems.push("You must accept the Provider Terms of Service.");

  if (problems.length > 0) throw Errors.validation("Onboarding is incomplete.", problems);

  await prisma.providerProfile.update({
    where: { id: profile.id },
    data: { submittedAt: new Date(), verificationStatus: "PENDING_VERIFICATION" },
  });
  await prisma.user.update({ where: { id: userId }, data: { status: "PENDING_VERIFICATION" } });

  return getProviderProfileFull(userId);
}

export async function setOnlineStatus(userId: string, online: boolean) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw Errors.notFound("User not found.");
  if (online && user.status !== "ACTIVE") {
    throw Errors.forbidden("Only verified, active providers can go online.");
  }
  const profile = await getOrCreateProviderProfile(userId);
  return prisma.providerProfile.update({
    where: { id: profile.id },
    data: { isOnline: online, lastOnlineAt: new Date() },
  });
}
