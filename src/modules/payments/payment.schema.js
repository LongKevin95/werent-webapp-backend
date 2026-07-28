import { z } from "zod";

export const createPaymentOrderSchema = z.object({
  packageCode: z.string().trim().min(1, "packageCode là bắt buộc"),
});

export const sepayWebhookSchema = z.object({
  orderCode: z.string().trim().optional(),
  code: z.string().trim().optional(),
  reference: z.string().trim().optional(),
  content: z.string().trim().optional(),
  amount: z.union([z.string(), z.number()]).optional(),
  transferAmount: z.union([z.string(), z.number()]).optional(),
  transactionId: z.string().trim().optional(),
  gatewayTransactionId: z.string().trim().optional(),
  id: z.union([z.string(), z.number()]).optional(),
  status: z.string().trim().optional(),
});
