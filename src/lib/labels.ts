import type { RsvpStatus } from "../types.js";

export const GUEST_GENDERS = [
  ["male", "Hombre"],
  ["female", "Mujer"],
] as const;
export const GUEST_GENDER_LABEL: Record<string, string> =
  Object.fromEntries(GUEST_GENDERS);

export const RSVP_LABEL: Record<RsvpStatus, string> = {
  confirmed: "Confirmado",
  pending: "Pendiente de confirmar",
  declined: "No asistirá",
};

export const MENU_CATEGORIES = [
  ["entradas", "Entradas"],
  ["principal", "Plato principal"],
  ["guarniciones", "Guarniciones"],
  ["postres", "Postres"],
  ["bebidas", "Bebidas"],
  ["otros", "Otros"],
] as const;

export const MENU_STATUS = [
  ["por_asignar", "Por asignar"],
  ["pendiente", "Pendiente"],
  ["en_preparacion", "En preparación"],
  ["listo", "Listo"],
] as const;

export const RESP_CATEGORIES = [
  ["comida", "Comida"],
  ["bebidas", "Bebidas"],
  ["decoracion", "Decoración"],
  ["musica", "Música"],
  ["actividades", "Actividades"],
  ["utensilios", "Utensilios"],
  ["organizacion", "Organización"],
  ["limpieza", "Limpieza"],
  ["otros", "Otros"],
] as const;

export const RESP_STATUS = [
  ["sin_asignar", "Sin asignar"],
  ["pendiente", "Pendiente"],
  ["en_proceso", "En proceso"],
  ["completado", "Completado"],
] as const;

export const ANN_CATEGORIES = [
  ["general", "Indicaciones generales"],
  ["horarios", "Horarios"],
  ["estacionamiento", "Estacionamiento"],
  ["ninos", "Niños y bebés"],
  ["alimentacion", "Restricciones alimentarias"],
  ["seguridad", "Accesos y seguridad"],
  ["recomendaciones", "Recomendaciones"],
  ["cambios", "Cambios de último momento"],
] as const;

export const ANN_PRIORITY = [
  ["normal", "Normal"],
  ["importante", "Importante"],
  ["urgente", "Urgente"],
] as const;

export function labelOf(
  list: readonly (readonly [string, string])[],
  key: string | null | undefined,
): string {
  return list.find(([value]) => value === key)?.[1] ?? "Otros";
}

export function rsvpLabel(status: string): string {
  return RSVP_LABEL[status as RsvpStatus] ?? RSVP_LABEL.pending;
}

export function menuCategoryLabel(category: string): string {
  return labelOf(MENU_CATEGORIES, category);
}

export function menuStatusLabel(status: string): string {
  return labelOf(MENU_STATUS, status);
}

export function responsibilityCategoryLabel(category: string): string {
  return labelOf(RESP_CATEGORIES, category);
}

export function responsibilityStatusLabel(status: string): string {
  return labelOf(RESP_STATUS, status);
}

export function announcementCategoryLabel(category: string): string {
  return labelOf(ANN_CATEGORIES, category);
}

export function announcementPriorityLabel(priority: string): string {
  return labelOf(ANN_PRIORITY, priority);
}

export const PRIORITY_RANK: Record<string, number> = {
  urgente: 0,
  importante: 1,
  normal: 2,
};

export const MENU_CATEGORY_VALUES = MENU_CATEGORIES.map(([value]) => value);
export const MENU_STATUS_VALUES = MENU_STATUS.map(([value]) => value);
export const RESP_CATEGORY_VALUES = RESP_CATEGORIES.map(([value]) => value);
export const RESP_STATUS_VALUES = RESP_STATUS.map(([value]) => value);
export const ANN_CATEGORY_VALUES = ANN_CATEGORIES.map(([value]) => value);
export const ANN_PRIORITY_VALUES = ANN_PRIORITY.map(([value]) => value);
