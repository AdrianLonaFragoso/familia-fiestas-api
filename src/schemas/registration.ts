import { z } from "zod";

import { avatarSchema, uuidSchema } from "./common.js";

export const registrationSchema = z.object({
  event_id: uuidSchema,
  full_name: z
    .string()
    .trim()
    .min(2, "Escribe tu nombre completo.")
    .max(120, "El nombre no puede superar 120 caracteres."),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Escribe un correo válido.")
    .max(160, "El correo no puede superar 160 caracteres."),
  avatar: avatarSchema,
  participates_in_exchange: z.boolean().default(false),
  gift_suggestions: z
    .string()
    .trim()
    .max(500, "Los regalos sugeridos no pueden superar 500 caracteres.")
    .nullable()
    .optional(),
});

export const registrationsQuerySchema = z.object({
  event_id: uuidSchema.optional(),
  search: z.string().trim().min(1).max(120).optional(),
});

export type RegistrationInput = z.infer<typeof registrationSchema>;
