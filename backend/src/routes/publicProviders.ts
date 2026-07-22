import { Router } from "express";
import { prisma } from "../prisma";
import { getProviderRatingSummary } from "../services/reviewService";
import { Errors } from "../utils/errors";

export const publicProvidersRouter = Router();

publicProvidersRouter.get("/:userId", async (req, res, next) => {
  try {
    const profile = await prisma.providerProfile.findUnique({
      where: { userId: String(req.params.userId) },
      include: { user: true, services: { include: { subService: true } } },
    });
    if (!profile || profile.verificationStatus !== "APPROVED") throw Errors.notFound("Provider not found.");

    const rating = await getProviderRatingSummary(profile.userId);

    res.json({
      provider: {
        userId: profile.userId,
        fullName: profile.user.fullName,
        bio: profile.bio,
        yearsExperience: profile.yearsExperience,
        businessName: profile.businessName,
        services: profile.services.map((s) => s.subService.name),
        rating,
      },
    });
  } catch (err) {
    next(err);
  }
});
