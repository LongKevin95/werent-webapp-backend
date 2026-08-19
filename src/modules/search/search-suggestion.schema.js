import { z } from "zod";

export const searchSuggestionQuerySchema = z.object({
  keyword: z.string().trim().optional(),
  q: z.string().trim().optional(),
  limit: z.coerce.number().int().min(1).max(20).default(10),
});
