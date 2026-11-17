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
