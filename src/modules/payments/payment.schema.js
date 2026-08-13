import { z } from "zod";

export const createPaymentOrderSchema = z.object({
  packageCode: z.string().trim().min(1, "packageCode là bắt buộc"),
});

export const createWalletTopUpCheckoutSchema = z.object({
  amount: z.coerce.number().int("Số tiền nạp phải là số nguyên.").min(10_000, "Số tiền nạp tối thiểu là 10.000 đ."),
  note: z.string().trim().max(500, "Ghi chú không được vượt quá 500 ký tự.").optional(),
  paymentMethod: z.enum(["qr"]).default("qr"),
});

export const createTopupOrderSchema = z.object({
  amount: z.coerce.number().int().min(10_000, "Số tiền nạp tối thiểu là 10.000 đ.").max(500_000_000),
  provider: z.string().trim().min(1).max(50).default("sepay"),
});

export const sepayWebhookSchema = z.object({}).passthrough();
