import { z } from "zod";
import { avatarSchema, uuidSchema, rsvpStatusSchema } from "./common.js";
export const profileUpdateSchema = z
  .object({
    full_name: z.string().trim().min(1).max(120).optional(),
    email: z
      .union([z.string().trim().email().max(160), z.literal("")])
      .nullable()
      .optional(),
    avatar: avatarSchema,
    family_id: uuidSchema.nullable().optional(),
  })
  .strict();
export const profileAttendanceSchema = z
  .object({
    status: rsvpStatusSchema.optional(),
    participates_in_exchange: z.boolean().optional(),
    gift_suggestions: z.string().max(500).nullable().optional(),
  })
  .strict();
