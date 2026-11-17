import { z } from "zod";
import { rsvpStatusSchema, tokenSchema, uuidSchema } from "./common.js";

export const resolveInvitationSchema = z.object({
  token: tokenSchema,
});

export const setRsvpSchema = z.object({
  token: tokenSchema,
  event_id: uuidSchema,
  status: rsvpStatusSchema,
});

export const invitationCalendarSchema = z.object({
  token: tokenSchema,
  event_id: uuidSchema,
});
