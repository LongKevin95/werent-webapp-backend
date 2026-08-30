import { z } from "zod";

export const favoritePropertySchema = z.object({
  propertyId: z.string().trim().regex(/^[a-f\d]{24}$/i, "propertyId không hợp lệ"),
});
