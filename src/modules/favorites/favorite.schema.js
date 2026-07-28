import { z } from "zod";

export const favoritePropertySchema = z.object({
  propertyId: z.string().trim().min(1, "propertyId là bắt buộc"),
});
