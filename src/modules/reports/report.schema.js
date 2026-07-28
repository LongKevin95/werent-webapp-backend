import { z } from "zod";

export const createReportSchema = z.object({
  propertyId: z.string().trim().min(1, "propertyId là bắt buộc"),
  reason: z.string().trim().min(1, "Lý do báo cáo là bắt buộc"),
  details: z.string().trim().optional(),
});
