import { z } from "zod";

const optionalString = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : undefined;
}, z.string().trim().optional());

const optionalUrl = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : undefined;
}, z.string().trim().url().optional());

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(8080),
  MONGODB_URI: optionalString,
  JWT_SECRET: z.string().trim().min(1).default("werent-dev-secret"),
  JWT_EXPIRES_IN: z.string().trim().min(1).default("7d"),
  CORS_ORIGIN: optionalString,
  APP_BASE_URL: optionalUrl,
  NOVU_SECRET_KEY: optionalString,
  NOVU_WELCOME_WORKFLOW_ID: z
    .string()
    .trim()
    .min(1)
    .default("welcome-new-account"),
  NOVU_LISTING_STATUS_WORKFLOW_ID: z
    .string()
    .trim()
    .min(1)
    .default("listing-status-updated"),
  NOVU_ACCOUNT_KYC_WORKFLOW_ID: z
    .string()
    .trim()
    .min(1)
    .default("account-kyc-reviewed"),
  NOVU_LISTING_VERIFICATION_WORKFLOW_ID: z
    .string()
    .trim()
    .min(1)
    .default("listing-verification-reviewed"),
  NOVU_TOPUP_SUCCESS_WORKFLOW_ID: z
    .string()
    .trim()
    .min(1)
    .default("wallet-top-up-success"),
  NOVU_TOPUP_FAILED_WORKFLOW_ID: z
    .string()
    .trim()
    .min(1)
    .default("wallet-top-up-failed"),
  NOVU_ADMIN_WALLET_ADJUSTMENT_WORKFLOW_ID: z
    .string()
    .trim()
    .min(1)
    .default("wallet-admin-adjustment"),
  CLOUDINARY_CLOUD_NAME: optionalString,
  CLOUDINARY_API_KEY: optionalString,
  CLOUDINARY_API_SECRET: optionalString,
  GEOAPIFY_API_KEY: optionalString,
  SEPAY_API_KEY: optionalString,
  SEPAY_MERCHANT_ID: optionalString,
  SEPAY_SECRET_KEY: optionalString,
  SEPAY_IPN_SECRET: optionalString,
  SEPAY_CURRENCY: z.string().trim().min(1).default("VND"),
  SEPAY_CHECKOUT_URL: z
    .string()
    .trim()
    .url()
    .default("https://pay.sepay.vn/v1/checkout/init"),
  SEPAY_PAYMENT_EXPIRY_MINUTES: z.coerce.number().int().positive().default(30),
  SEPAY_WEBHOOK_SECRET: optionalString,
  SEPAY_BANK_BIN: optionalString,
  SEPAY_BANK_ACCOUNT: optionalString,
  SEPAY_BANK_ACCOUNT_NAME: optionalString,
  MOMO_PARTNER_CODE: optionalString,
  MOMO_ACCESS_KEY: optionalString,
  MOMO_SECRET_KEY: optionalString,
  MOMO_ENDPOINT: z.string().trim().url().default("https://test-payment.momo.vn/v2/gateway/api/create"),
  MOMO_IPN_URL: optionalString,
  MOMO_REDIRECT_URL: optionalString,
});

const parsedEnvironment = envSchema.safeParse(process.env);

if (!parsedEnvironment.success) {
  throw new Error(
    `Invalid environment variables: ${JSON.stringify(parsedEnvironment.error.flatten().fieldErrors)}`,
  );
}

const env = Object.freeze(parsedEnvironment.data);

export default env;
