import { z } from "zod";

export const uuidSchema = z.string().uuid("Debe ser un UUID válido.");
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha debe tener formato YYYY-MM-DD.");
export const timeSchema = z
  .string()
  .regex(/^\d{2}:\d{2}(:\d{2})?$/, "La hora debe tener formato HH:mm o HH:mm:ss.");
export const tokenSchema = z.string().regex(/^[a-f0-9]{64}$/, "El enlace no es válido.");

export const nullableText = z.string().max(5000).nullable().optional();
export const shortText = z.string().max(120);
export const mediumText = z.string().max(2000);

export const rsvpStatusSchema = z.enum(["pending", "confirmed", "declined"]);

/** Avatares disponibles en el frontend (`src/assets/avatar-*.png`). */
export const AVATAR_IDS = [
  "avatar-1",
  "avatar-2",
  "avatar-3",
  "avatar-4",
  "avatar-5",
  "avatar-6",
] as const;
export const avatarSchema = z.enum(AVATAR_IDS).nullable().optional();

export function parseDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export function parseTime(value: string): Date {
  const normalized = value.length === 5 ? `${value}:00` : value;
  return new Date(`1970-01-01T${normalized}Z`);
}

export function optionalDate(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return parseDateOnly(value);
}

export function optionalTime(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return parseTime(value);
}

export function timeOrNull(value: string | null): Date | null {
  return value === null ? null : parseTime(value);
}

export function dateOrNull(value: string | null): Date | null {
  return value === null ? null : parseDateOnly(value);
}
