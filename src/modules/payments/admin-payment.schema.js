import { z } from "zod";

export const adminPaymentQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  search: z.string().trim().optional(),
  status: z.enum(["pending", "paid", "failed", "canceled"]).optional(),
  transactionType: z.enum(["topup", "package_payment", "promotion_bonus", "admin_adjustment", "refund"]).optional(),
  provider: z.string().trim().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  scope: z.enum(["topup", "all"]).optional(),
});

export const balanceAdjustmentSchema = z.object({
  userId: z.string().trim().min(1),
  direction: z.enum(["credit", "debit"]),
  amount: z.coerce.number().positive(),
  reason: z.string().trim().min(5).max(1000),
});

const promotionFields = {
  name: z.string().trim().min(2).max(150),
  code: z.string().trim().min(2).max(50),
  bonusPercent: z.coerce.number().min(0).max(100),
  minimumAmount: z.coerce.number().min(0).default(0),
  maximumBonus: z.coerce.number().min(0).nullable().optional(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  perUserLimit: z.coerce.number().int().min(1).default(1),
  isActive: z.boolean().optional(),
};

export const createPromotionSchema = z.object(promotionFields).refine((value) => value.endsAt > value.startsAt, {
  path: ["endsAt"], message: "Thời gian kết thúc phải sau thời gian bắt đầu.",
});

export const updatePromotionSchema = z.object(promotionFields).partial();
