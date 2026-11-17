import { z } from "zod";
import { uuidSchema } from "./common.js";

export const announcementsQuerySchema = z.object({
  event_id: uuidSchema.optional(),
  priority: z.enum(["normal", "importante", "urgente"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const participantsQuerySchema = z.object({
  event_id: uuidSchema.optional(),
  family_id: uuidSchema.optional(),
  search: z.string().trim().min(1).max(120).optional(),
});
