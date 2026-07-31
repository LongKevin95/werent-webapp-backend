import cors from "cors";
import cookieParser from "cookie-parser";
import express from "express";
import helmet from "helmet";
import pinoHttp from "pino-http";
import env from "./config/env.js";
import { notFoundHandler } from "./middleware/errorHandler.js";
import errorHandler from "./middleware/errorHandler.js";
import { apiRateLimit } from "./middleware/rateLimit.js";
import adminRouter from "./modules/admin/admin.routes.js";
import authRouter from "./modules/auth/auth.routes.js";
import favoriteRouter from "./modules/favorites/favorite.routes.js";
import paymentRouter from "./modules/payments/payment.routes.js";
import propertyRouter from "./modules/properties/property.routes.js";
import reportRouter from "./modules/reports/report.routes.js";
import userRouter from "./modules/users/user.routes.js";

const app = express();

function normalizeOrigin(origin) {
  if (typeof origin !== "string") {
    return null;
  }

  const trimmedOrigin = origin.trim();

  if (!trimmedOrigin) {
    return null;
  }

  try {
    return new URL(trimmedOrigin).origin;
  } catch {
    if (/^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(trimmedOrigin)) {
      return `http://${trimmedOrigin}`;
    }

    if (/^[a-z0-9.-]+(:\d+)?$/i.test(trimmedOrigin)) {
      return `https://${trimmedOrigin}`;
    }

    return trimmedOrigin;
  }
}

const allowedCorsOrigins = env.CORS_ORIGIN?.split(",")
  .map(normalizeOrigin)
  .filter(Boolean);

function isAllowedCorsOrigin(origin) {
  if (!allowedCorsOrigins || allowedCorsOrigins.length === 0) {
    return true;
  }

  if (!origin) {
    return true;
  }

  return allowedCorsOrigins.includes(origin);
}

app.use(helmet());
if (env.NODE_ENV !== "test") {
  app.use(
    pinoHttp({
      transport:
        env.NODE_ENV === "development"
          ? {
              target: "pino-pretty",
              options: {
                colorize: true,
              },
            }
          : undefined,
    }),
  );
}
app.use(
  cors({
    origin(origin, callback) {
      if (isAllowedCorsOrigin(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`Origin ${origin} is not allowed by CORS.`));
    },
    credentials: true,
  }),
);
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(apiRateLimit);

app.use("/api/auth", authRouter);
app.use("/api/users", userRouter);
app.use("/api/properties", propertyRouter);
app.use("/api/favorites", favoriteRouter);
app.use("/api/reports", reportRouter);
app.use("/api/payments", paymentRouter);
app.use("/api/admin", adminRouter);

app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "WeRent API is running",
    timestamp: new Date().toISOString(),
  });
});

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "WeRent Modular Monolith API",
  });
});

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
