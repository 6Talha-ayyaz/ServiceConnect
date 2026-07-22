import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole, AuthedRequest } from "../middleware/auth";
import {
  listVerificationQueue,
  getVerificationDetail,
  approveProvider,
  rejectProvider,
  suspendProvider,
} from "../services/adminVerificationService";
import { getAnalyticsSummary } from "../services/adminAnalyticsService";
import {
  listAllCategories,
  createCategory,
  updateCategory,
  deactivateCategory,
  createSubService,
  updateSubService,
  deactivateSubService,
} from "../services/adminCatalogueService";

export const adminRouter = Router();

adminRouter.use(requireAuth, requireRole("ADMIN"));

adminRouter.get("/verifications", async (_req, res, next) => {
  try {
    const queue = await listVerificationQueue();
    res.json({ queue });
  } catch (err) {
    next(err);
  }
});

adminRouter.get("/verifications/:id", async (req, res, next) => {
  try {
    const profile = await getVerificationDetail(req.params.id);
    res.json({ profile });
  } catch (err) {
    next(err);
  }
});

adminRouter.post("/verifications/:id/approve", async (req: AuthedRequest, res, next) => {
  try {
    const profile = await approveProvider(String(req.params.id), req.user!.id);
    res.json({ profile, message: "Provider approved." });
  } catch (err) {
    next(err);
  }
});

const rejectSchema = z.object({ reason: z.string().min(3).max(500) });

adminRouter.post("/verifications/:id/reject", async (req: AuthedRequest, res, next) => {
  try {
    const input = rejectSchema.parse(req.body);
    const profile = await rejectProvider(String(req.params.id), req.user!.id, input.reason);
    res.json({ profile, message: "Provider rejected." });
  } catch (err) {
    next(err);
  }
});

adminRouter.post("/verifications/:id/suspend", async (req, res, next) => {
  try {
    const profile = await suspendProvider(req.params.id);
    res.json({ profile, message: "Provider suspended." });
  } catch (err) {
    next(err);
  }
});

adminRouter.get("/analytics", async (_req, res, next) => {
  try {
    const summary = await getAnalyticsSummary();
    res.json({ summary });
  } catch (err) {
    next(err);
  }
});

adminRouter.get("/categories", async (_req, res, next) => {
  try {
    const categories = await listAllCategories();
    res.json({ categories });
  } catch (err) {
    next(err);
  }
});

const categorySchema = z.object({
  name: z.string().min(2).max(80),
  icon: z.string().max(8).optional(),
  description: z.string().max(300).optional(),
  displayOrder: z.number().int().optional(),
});

adminRouter.post("/categories", async (req, res, next) => {
  try {
    const input = categorySchema.parse(req.body);
    const category = await createCategory(input);
    res.status(201).json({ category });
  } catch (err) {
    next(err);
  }
});

const categoryUpdateSchema = categorySchema.partial().extend({ active: z.boolean().optional() });

adminRouter.patch("/categories/:id", async (req, res, next) => {
  try {
    const input = categoryUpdateSchema.parse(req.body);
    const category = await updateCategory(String(req.params.id), input);
    res.json({ category });
  } catch (err) {
    next(err);
  }
});

adminRouter.post("/categories/:id/deactivate", async (req, res, next) => {
  try {
    const category = await deactivateCategory(String(req.params.id));
    res.json({ category });
  } catch (err) {
    next(err);
  }
});

const subServiceSchema = z.object({
  categoryId: z.string().uuid(),
  name: z.string().min(2).max(120),
  description: z.string().max(300).optional(),
  defaultPricing: z.enum(["FIXED", "HOURLY", "INSPECT_THEN_QUOTE"]),
  suggestedMinPrice: z.number().int().nonnegative().optional(),
  suggestedMaxPrice: z.number().int().nonnegative().optional(),
  durationMinutes: z.number().int().positive().optional(),
});

adminRouter.post("/sub-services", async (req, res, next) => {
  try {
    const input = subServiceSchema.parse(req.body);
    const subService = await createSubService(input);
    res.status(201).json({ subService });
  } catch (err) {
    next(err);
  }
});

const subServiceUpdateSchema = subServiceSchema.partial().extend({ active: z.boolean().optional() });

adminRouter.patch("/sub-services/:id", async (req, res, next) => {
  try {
    const input = subServiceUpdateSchema.parse(req.body);
    const subService = await updateSubService(String(req.params.id), input);
    res.json({ subService });
  } catch (err) {
    next(err);
  }
});

adminRouter.post("/sub-services/:id/deactivate", async (req, res, next) => {
  try {
    const subService = await deactivateSubService(String(req.params.id));
    res.json({ subService });
  } catch (err) {
    next(err);
  }
});
