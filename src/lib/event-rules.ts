import { dateOnly, type DateLike } from "./dates.js";

/**
 * Reglas de negocio por celebración. Viven aquí para que las rutas, los
 * servicios y los serializadores compartan la misma fuente de verdad.
 */

/** La configuración persistida es autoritativa; el fallback admite registros previos. */
export function hasGiftExchange(event: { slug: string; giftExchangeEnabled?: boolean }): boolean {
  return event.giftExchangeEnabled ?? event.slug === "navidad";
}

/** Normaliza un correo para compararlo y guardarlo: sin espacios y en minúsculas. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** El intercambio del registro familiar es exclusivo de Navidad, el 24 de diciembre. */
export function registrationExchangeEnabled(event: { slug: string; eventDate: DateLike; giftExchangeEnabled?: boolean }): boolean {
  return hasGiftExchange(event) && event.slug === "navidad" && dateOnly(event.eventDate).slice(5) === "12-24";
}

export function isChildGuest(guest: { tag?: string | null }): boolean {
  return ["niño", "niña", "niño/a"].includes(guest.tag?.trim().toLocaleLowerCase("es") ?? "");
}
