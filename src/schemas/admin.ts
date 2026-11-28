import { z } from "zod";
import {
  avatarSchema,
  dateSchema,
  mediumText,
  nullableText,
  rsvpStatusSchema,
  shortText,
  timeSchema,
  uuidSchema,
} from "./common.js";
import {
  ANN_CATEGORY_VALUES,
  ANN_PRIORITY_VALUES,
  MENU_CATEGORY_VALUES,
  MENU_STATUS_VALUES,
  RESP_CATEGORY_VALUES,
  RESP_STATUS_VALUES,
} from "../lib/labels.js";

const optionalUuid = uuidSchema.nullable().optional();
const optionalTime = timeSchema.nullable().optional();
const sortOrder = z.coerce.number().int().min(0).optional();

export const eventCreateSchema = z.object({
  slug: z.string().trim().min(1).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Usa minúsculas, números y guiones."),
  name: shortText.trim().min(1),
  is_released: z.boolean().optional(),
  dress_code: nullableText,
  contributions: nullableText,
  exchange_rules: nullableText,
  additional_activities: nullableText,
  registration_deadline: dateSchema.nullable().optional(),
  gift_exchange_enabled: z.boolean().optional(),
  event_date: dateSchema,
  arrival_time: optionalTime,
  start_time: optionalTime,
  dinner_time: optionalTime,
  end_time: optionalTime,
  description: nullableText,
  observations: nullableText,
  venue_id: optionalUuid,
});
export const eventUpdateSchema = eventCreateSchema.partial();

export const venueCreateSchema = z.object({
  name: z.string().max(120).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  references_text: z.string().max(1000).nullable().optional(),
  access_notes: z.string().max(2000).nullable().optional(),
  parking: z.string().max(1000).nullable().optional(),
  photo_path: z.string().max(500).nullable().optional(),
  observations: nullableText,
  latitude: z.coerce.number().min(-90).max(90).nullable().optional(),
  longitude: z.coerce.number().min(-180).max(180).nullable().optional(),
});
export const venueUpdateSchema = venueCreateSchema.partial();

export const familyCreateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  sort_order: sortOrder,
  is_unassigned: z.boolean().optional(),
});
export const familyUpdateSchema = familyCreateSchema.partial();

export const guestsQuerySchema = z.object({
  family_id: uuidSchema.optional(),
  search: z.string().trim().min(1).max(120).optional(),
  event_id: uuidSchema.optional(),
  status: rsvpStatusSchema.optional(),
});

export const guestCreateSchema = z.object({
  full_name: shortText,
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Escribe un correo válido.")
    .max(160)
    .nullable()
    .optional(),
  avatar: avatarSchema,
  gender: z.enum(["male", "female"]).nullable().optional(),
  family_id: optionalUuid,
  tag: z.string().max(40).nullable().optional(),
  event_ids: z.array(uuidSchema).optional(),
});
export const guestUpdateSchema = guestCreateSchema.partial();

export const guestPrivateSchema = z.object({
  dietary_notes: nullableText,
  admin_notes: nullableText,
});

export const eventGuestUpdateSchema = z.object({
  status: rsvpStatusSchema.optional(),
  public_note: z.string().max(200).nullable().optional(),
  participates_in_exchange: z.boolean().optional(),
  gift_suggestions: z
    .string()
    .trim()
    .max(500, "Los regalos sugeridos no pueden superar 500 caracteres.")
    .nullable()
    .optional(),
  responded_at: z.string().datetime().nullable().optional(),
});

export const hostCreateSchema = z.object({
  guest_id: optionalUuid,
  name: shortText.trim().min(1),
  welcome_message: nullableText,
  photo_path: z.string().max(500).nullable().optional(),
  venue_notes: nullableText,
  sort_order: sortOrder,
});
export const hostUpdateSchema = hostCreateSchema.partial();

export const menuItemCreateSchema = z.object({
  name: shortText,
  category: z.enum(MENU_CATEGORY_VALUES as [string, ...string[]]).optional(),
  description: nullableText,
  quantity: z.coerce.number().nonnegative().nullable().optional(),
  unit: z.string().max(40).nullable().optional(),
  status: z.enum(MENU_STATUS_VALUES as [string, ...string[]]).optional(),
  notes: nullableText,
});
export const menuItemUpdateSchema = menuItemCreateSchema.partial();

export const assigneesSchema = z.object({
  guest_ids: z.array(uuidSchema).max(200),
});

export const responsibilityCreateSchema = z.object({
  title: shortText,
  description: nullableText,
  category: z.enum(RESP_CATEGORY_VALUES as [string, ...string[]]).optional(),
  quantity: z.string().max(80).nullable().optional(),
  due_date: dateSchema.nullable().optional(),
  status: z.enum(RESP_STATUS_VALUES as [string, ...string[]]).optional(),
  notes: nullableText,
});
export const responsibilityUpdateSchema = responsibilityCreateSchema.partial();

export const activityCreateSchema = z.object({
  name: shortText.trim().min(1),
  description: nullableText,
  start_time: optionalTime,
  end_time: optionalTime,
  responsible: z.string().max(120).nullable().optional(),
  instructions: nullableText,
  sort_order: sortOrder,
});
export const activityUpdateSchema = activityCreateSchema.partial();

export const announcementCreateSchema = z.object({
  event_id: optionalUuid,
  title: z.string().trim().min(1).max(140),
  content: mediumText.optional(),
  category: z.enum(ANN_CATEGORY_VALUES as [string, ...string[]]).optional(),
  priority: z.enum(ANN_PRIORITY_VALUES as [string, ...string[]]).optional(),
  published_at: z.string().datetime().optional(),
  is_active: z.boolean().optional(),
});
export const announcementUpdateSchema = announcementCreateSchema.partial();

export const invitationTokenCreateSchema = z.object({
  guest_id: uuidSchema,
});
