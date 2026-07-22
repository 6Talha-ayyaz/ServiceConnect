import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { authRouter } from "./routes/auth";
import { catalogueRouter } from "./routes/catalogue";
import { providersRouter } from "./routes/providers";
import { publicProvidersRouter } from "./routes/publicProviders";
import { adminRouter } from "./routes/admin";
import { requestsRouter } from "./routes/requests";
import { errorHandler } from "./middleware/errorHandler";
import { UPLOADS_DIR } from "./utils/upload";
import { config } from "./config";

export function createApp() {
  const app = express();

  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || config.corsOrigins.includes(origin)) return callback(null, true);
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      },
      credentials: true,
    })
  );
  app.use(express.json());
  app.use(cookieParser());

  app.get("/health", (_req, res) => res.json({ status: "ok" }));

  app.use("/uploads", express.static(UPLOADS_DIR));

  app.use("/api/v1/auth", authRouter);
  app.use("/api/v1", catalogueRouter);
  app.use("/api/v1/providers/public", publicProvidersRouter);
  app.use("/api/v1/providers", providersRouter);
  app.use("/api/v1/admin", adminRouter);
  app.use("/api/v1/requests", requestsRouter);

  app.use(errorHandler);

  return app;
}
