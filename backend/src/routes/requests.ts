import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole, AuthedRequest } from "../middleware/auth";
import {
  createServiceRequest,
  listMyRequests,
  listAvailableForProvider,
  listMyActiveJobs,
  acceptRequest,
  declineRequest,
  markEnRoute,
  markArrived,
  startJob,
  markJobDone,
  confirmCompletion,
  cancelRequest,
  getRequestDetail,
} from "../services/requestService";
import { submitReview, getReviewsForRequest } from "../services/reviewService";
import { sendMessage, listMessages } from "../services/chatService";
import { getInvoice, payInvoice } from "../services/invoiceService";

export const requestsRouter = Router();

requestsRouter.use(requireAuth);

const createSchema = z.object({
  subServiceId: z.string().uuid(),
  description: z.string().max(2000).optional(),
  photos: z.array(z.string()).max(5).optional(),
  urgency: z.enum(["IMMEDIATE", "SAME_DAY_SCHEDULED", "FUTURE_SCHEDULED"]),
  scheduledAt: z.string().optional(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  address: z.string().min(3),
});

requestsRouter.post("/", requireRole("CUSTOMER"), async (req: AuthedRequest, res, next) => {
  try {
    const input = createSchema.parse(req.body);
    const result = await createServiceRequest(req.user!.id, input);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

requestsRouter.get("/mine", requireRole("CUSTOMER"), async (req: AuthedRequest, res, next) => {
  try {
    const requests = await listMyRequests(req.user!.id);
    res.json({ requests });
  } catch (err) {
    next(err);
  }
});

requestsRouter.get("/available", requireRole("PROVIDER"), async (req: AuthedRequest, res, next) => {
  try {
    const requests = await listAvailableForProvider(req.user!.id);
    res.json({ requests });
  } catch (err) {
    next(err);
  }
});

requestsRouter.get("/my-jobs", requireRole("PROVIDER"), async (req: AuthedRequest, res, next) => {
  try {
    const requests = await listMyActiveJobs(req.user!.id);
    res.json({ requests });
  } catch (err) {
    next(err);
  }
});

requestsRouter.get("/:id", async (req: AuthedRequest, res, next) => {
  try {
    const request = await getRequestDetail(String(req.params.id));
    const isOwner = request.customerId === req.user!.id;
    const isAssignedProvider = request.assignedProvider?.userId === req.user!.id;
    if (!isOwner && !isAssignedProvider && req.user!.role !== "ADMIN") {
      return res.status(403).json({ error: { code: "FORBIDDEN", message: "Not your request." } });
    }
    res.json({ request });
  } catch (err) {
    next(err);
  }
});

requestsRouter.post("/:id/accept", requireRole("PROVIDER"), async (req: AuthedRequest, res, next) => {
  try {
    const request = await acceptRequest(String(req.params.id), req.user!.id);
    res.json({ request });
  } catch (err) {
    next(err);
  }
});

const declineSchema = z.object({ reason: z.string().max(500).optional() });

requestsRouter.post("/:id/decline", requireRole("PROVIDER"), async (req: AuthedRequest, res, next) => {
  try {
    const input = declineSchema.parse(req.body);
    await declineRequest(String(req.params.id), req.user!.id, input.reason);
    res.json({ message: "Declined." });
  } catch (err) {
    next(err);
  }
});

requestsRouter.post("/:id/en-route", requireRole("PROVIDER"), async (req: AuthedRequest, res, next) => {
  try {
    const request = await markEnRoute(String(req.params.id), req.user!.id);
    res.json({ request });
  } catch (err) {
    next(err);
  }
});

requestsRouter.post("/:id/arrived", requireRole("PROVIDER"), async (req: AuthedRequest, res, next) => {
  try {
    const request = await markArrived(String(req.params.id), req.user!.id);
    res.json({ request });
  } catch (err) {
    next(err);
  }
});

requestsRouter.post("/:id/start", requireRole("PROVIDER"), async (req: AuthedRequest, res, next) => {
  try {
    const request = await startJob(String(req.params.id), req.user!.id);
    res.json({ request });
  } catch (err) {
    next(err);
  }
});

requestsRouter.post("/:id/job-done", requireRole("PROVIDER"), async (req: AuthedRequest, res, next) => {
  try {
    const request = await markJobDone(String(req.params.id), req.user!.id);
    res.json({ request });
  } catch (err) {
    next(err);
  }
});

requestsRouter.post("/:id/confirm", requireRole("CUSTOMER"), async (req: AuthedRequest, res, next) => {
  try {
    const request = await confirmCompletion(String(req.params.id), req.user!.id);
    res.json({ request });
  } catch (err) {
    next(err);
  }
});

const cancelSchema = z.object({ reason: z.string().max(500).optional() });

requestsRouter.post("/:id/cancel", async (req: AuthedRequest, res, next) => {
  try {
    const input = cancelSchema.parse(req.body);
    const request = await cancelRequest(String(req.params.id), req.user!.id, input.reason);
    res.json({ request });
  } catch (err) {
    next(err);
  }
});

const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  punctuality: z.number().int().min(1).max(5).optional(),
  workQuality: z.number().int().min(1).max(5).optional(),
  professionalism: z.number().int().min(1).max(5).optional(),
  priceFairness: z.number().int().min(1).max(5).optional(),
  comment: z.string().max(500).optional(),
});

requestsRouter.post("/:id/review", async (req: AuthedRequest, res, next) => {
  try {
    const input = reviewSchema.parse(req.body);
    const review = await submitReview(String(req.params.id), req.user!.id, input);
    res.status(201).json({ review });
  } catch (err) {
    next(err);
  }
});

requestsRouter.get("/:id/reviews", async (req, res, next) => {
  try {
    const reviews = await getReviewsForRequest(String(req.params.id));
    res.json({ reviews });
  } catch (err) {
    next(err);
  }
});

const messageSchema = z.object({
  body: z.string().min(1).max(2000),
  imageUrl: z.string().url().optional(),
});

requestsRouter.post("/:id/messages", async (req: AuthedRequest, res, next) => {
  try {
    const input = messageSchema.parse(req.body);
    const { message, redacted } = await sendMessage(String(req.params.id), req.user!.id, input.body, input.imageUrl);
    res.status(201).json({ message, redacted });
  } catch (err) {
    next(err);
  }
});

requestsRouter.get("/:id/messages", async (req: AuthedRequest, res, next) => {
  try {
    const messages = await listMessages(String(req.params.id), req.user!.id);
    res.json({ messages });
  } catch (err) {
    next(err);
  }
});

requestsRouter.get("/:id/invoice", async (req: AuthedRequest, res, next) => {
  try {
    const invoice = await getInvoice(String(req.params.id), req.user!.id);
    res.json({ invoice });
  } catch (err) {
    next(err);
  }
});

const paySchema = z.object({ paymentMethod: z.enum(["CASH", "CARD", "WALLET"]).default("CASH") });

requestsRouter.post("/:id/invoice/pay", async (req: AuthedRequest, res, next) => {
  try {
    const input = paySchema.parse(req.body);
    const invoice = await payInvoice(String(req.params.id), req.user!.id, input.paymentMethod);
    res.json({ invoice });
  } catch (err) {
    next(err);
  }
});
