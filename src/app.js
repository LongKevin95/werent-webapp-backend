import cors from "cors";
import cookieParser from "cookie-parser";
import express from "express";
import helmet from "helmet";
import path from "node:path";
import pinoHttp from "pino-http";
import env from "./config/env.js";
import { notFoundHandler } from "./middleware/errorHandler.js";
import errorHandler from "./middleware/errorHandler.js";
import { apiRateLimit } from "./middleware/rateLimit.js";
import requireAuth from "./middleware/auth.js";
import requireAdmin from "./middleware/admin.js";
import administrativeDivisionRouter from "./modules/administrative-divisions/administrative-division.routes.js";
import adminRouter from "./modules/admin/admin.routes.js";
import authRouter from "./modules/auth/auth.routes.js";
import favoriteRouter from "./modules/favorites/favorite.routes.js";
import mapRouter from "./modules/maps/map.routes.js";
import kycRouter from "./modules/kyc/kyc.routes.js";
import paymentRouter from "./modules/payments/payment.routes.js";
import propertyRouter from "./modules/properties/property.routes.js";
import reportRouter from "./modules/reports/report.routes.js";
import userRouter from "./modules/users/user.routes.js";

const app = express();

if (env.NODE_ENV === "production") {
  app.set("trust proxy", true);
}

function normalizeOriginValue(origin) {
  if (typeof origin !== "string") {
    return null;
  }

  const trimmedOrigin = origin.trim().replace(/\/+$/, "");

  if (!trimmedOrigin) {
    return null;
  }

  if (/^https?:\/\//i.test(trimmedOrigin)) {
    return trimmedOrigin;
  }

  if (/^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(trimmedOrigin)) {
    return `http://${trimmedOrigin}`;
  }

  if (/^[a-z0-9.*-]+(:\d+)?$/i.test(trimmedOrigin)) {
    return `https://${trimmedOrigin}`;
  }

  return trimmedOrigin;
}

function normalizeExactOrigin(origin) {
  const normalizedOrigin = normalizeOriginValue(origin);

  if (!normalizedOrigin || normalizedOrigin.includes("*")) {
    return null;
  }

  try {
    return new URL(normalizedOrigin).origin;
  } catch {
    return null;
  }
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function createCorsOriginMatcher(origin) {
  const normalizedOrigin = normalizeOriginValue(origin);

  if (!normalizedOrigin) {
    return null;
  }

  const exactOrigin = normalizeExactOrigin(normalizedOrigin);

  if (exactOrigin) {
    return {
      type: "exact",
      value: exactOrigin,
    };
  }

  if (!normalizedOrigin.includes("*")) {
    return {
      type: "exact",
      value: normalizedOrigin,
    };
  }

  return {
    type: "pattern",
    value: normalizedOrigin,
    regex: new RegExp(
      `^${escapeRegex(normalizedOrigin).replace(/\\\*/g, ".*")}$`,
    ),
  };
}

const allowedCorsOrigins = env.CORS_ORIGIN?.split(",")
  .map(createCorsOriginMatcher)
  .filter(Boolean);

function isAllowedCorsOrigin(origin) {
  if (!allowedCorsOrigins || allowedCorsOrigins.length === 0) {
    return true;
  }

  if (!origin) {
    return true;
  }

  return allowedCorsOrigins.some((allowedOrigin) => {
    if (allowedOrigin.type === "exact") {
      return allowedOrigin.value === origin;
    }

    return allowedOrigin.regex.test(origin);
  });
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
    maxAge: 600,
    optionsSuccessStatus: 204,
  }),
);
app.use(cookieParser());
app.use(express.json({
  verify(req, res, buffer) {
    if (req.originalUrl?.startsWith("/api/payments/webhook/")) {
      req.rawBody = buffer.toString("utf8");
    }
  },
}));
app.use(express.urlencoded({ extended: true }));
app.use(
  "/api/uploads/werent/kyc",
  requireAuth,
  requireAdmin,
  express.static(path.join(process.cwd(), "uploads", "werent", "kyc"), {
    setHeaders(res) {
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    },
  }),
);
app.use(
  "/api/uploads",
  express.static(path.join(process.cwd(), "uploads"), {
    setHeaders(res) {
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    },
  }),
);
app.use(apiRateLimit);

app.use("/api/auth", authRouter);
app.use("/api/users", userRouter);
app.use("/api/administrative-divisions", administrativeDivisionRouter);
app.use("/api/properties", propertyRouter);
app.use("/api/favorites", favoriteRouter);
app.use("/api/maps", mapRouter);
app.use("/api/kyc", kycRouter);
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
// test auto deploy
