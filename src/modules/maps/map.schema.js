import { z } from "zod";

export const mapAutocompleteQuerySchema = z.object({
  query: z.string().trim().min(3, "Từ khóa tìm kiếm cần ít nhất 3 ký tự."),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  limit: z.coerce.number().int().min(1).max(10).default(5),
});

export const mapReverseQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});
