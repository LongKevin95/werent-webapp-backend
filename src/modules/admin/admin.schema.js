import { z } from "zod";
import { PROPERTY_STATUS_LIST } from "../../common/constants.js";

export const reviewPropertySchema = z.object({
  status: z.enum(PROPERTY_STATUS_LIST),
  rejectionReason: z.string().trim().optional(),
});
