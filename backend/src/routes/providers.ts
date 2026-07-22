import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole, AuthedRequest } from "../middleware/auth";
import { upload } from "../utils/upload";
import {
  getProviderProfileFull,
  savePersonalDetails,
  saveServices,
  saveCoverage,
  saveAvailability,
  addDocument,
  acceptTerms,
  submitForVerification,
  setOnlineStatus,
} from "../services/providerService";
import { getProviderEarnings } from "../services/invoiceService";

export const providersRouter = Router();

providersRouter.use(requireAuth, requireRole("PROVIDER"));

providersRouter.get("/me", async (req: AuthedRequest, res, next) => {
  try {
    const profile = await getProviderProfileFull(req.user!.id);
    res.json({ profile });
  } catch (err) {
    next(err);
  }
});

const personalDetailsSchema = z.object({
  legalName: z.string().min(2).max(120),
  cnic: z.string().min(5).max(30),
  dateOfBirth: z.string(),
  businessName: z.string().max(120).optional(),
  yearsExperience: z.number().int().min(0).max(60).optional(),
  languages: z.array(z.string()).optional(),
  bio: z.string().max(500).optional(),
});

providersRouter.patch("/me/personal-details", async (req: AuthedRequest, res, next) => {
  try {
    const input = personalDetailsSchema.parse(req.body);
    const profile = await savePersonalDetails(req.user!.id, input);
    res.json({ profile });
  } catch (err) {
    next(err);
  }
});

const servicesSchema = z.object({
  services: z
    .array(
      z.object({
        subServiceId: z.string().uuid(),
        pricingModel: z.enum(["FIXED", "HOURLY", "INSPECT_THEN_QUOTE"]),
        basePrice: z.number().int().positive().optional(),
        hourlyRate: z.number().int().positive().optional(),
        calloutFee: z.number().int().nonnegative().optional(),
      })
    )
    .min(1),
});

providersRouter.put("/me/services", async (req: AuthedRequest, res, next) => {
  try {
    const input = servicesSchema.parse(req.body);
    const profile = await saveServices(req.user!.id, input.services);
    res.json({ profile });
  } catch (err) {
    next(err);
  }
});

const coverageSchema = z.object({
  baseLat: z.number().min(-90).max(90),
  baseLng: z.number().min(-180).max(180),
  baseAddress: z.string().min(3),
  radiusKm: z.number().min(1).max(50),
});

providersRouter.patch("/me/coverage", async (req: AuthedRequest, res, next) => {
  try {
    const input = coverageSchema.parse(req.body);
    const profile = await saveCoverage(req.user!.id, input);
    res.json({ profile });
  } catch (err) {
    next(err);
  }
});

const availabilitySchema = z.object({
  slots: z.array(
    z.object({
      dayOfWeek: z.number().int().min(0).max(6),
      startMinute: z.number().int().min(0).max(1440),
      endMinute: z.number().int().min(0).max(1440),
    })
  ),
});

providersRouter.put("/me/availability", async (req: AuthedRequest, res, next) => {
  try {
    const input = availabilitySchema.parse(req.body);
    const profile = await saveAvailability(req.user!.id, input.slots);
    res.json({ profile });
  } catch (err) {
    next(err);
  }
});

const DOCUMENT_TYPES = new Set(["ID_FRONT", "ID_BACK", "TRADE_CERT", "BUSINESS_LICENCE", "POLICE_CLEARANCE"]);

providersRouter.post("/me/documents", upload.single("file"), async (req: AuthedRequest, res, next) => {
  try {
    const type = req.body.type as string;
    if (!DOCUMENT_TYPES.has(type)) {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid document type." } });
    }
    if (!req.file) {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "No file uploaded." } });
    }
    const doc = await addDocument(req.user!.id, type, `/uploads/${req.file.filename}`);
    res.status(201).json({ document: doc });
  } catch (err) {
    next(err);
  }
});

providersRouter.post("/me/accept-terms", async (req: AuthedRequest, res, next) => {
  try {
    const profile = await acceptTerms(req.user!.id);
    res.json({ profile });
  } catch (err) {
    next(err);
  }
});

providersRouter.post("/me/submit", async (req: AuthedRequest, res, next) => {
  try {
    const profile = await submitForVerification(req.user!.id);
    res.json({ profile, message: "Submitted for verification." });
  } catch (err) {
    next(err);
  }
});

const onlineSchema = z.object({ online: z.boolean() });

providersRouter.patch("/me/online-status", async (req: AuthedRequest, res, next) => {
  try {
    const input = onlineSchema.parse(req.body);
    const profile = await setOnlineStatus(req.user!.id, input.online);
    res.json({ profile });
  } catch (err) {
    next(err);
  }
});

providersRouter.get("/me/earnings", async (req: AuthedRequest, res, next) => {
  try {
    const earnings = await getProviderEarnings(req.user!.id);
    res.json({ earnings });
  } catch (err) {
    next(err);
  }
});
