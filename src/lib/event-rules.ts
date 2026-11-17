/**
 * Reglas de negocio por celebración. Viven aquí para que las rutas, los
 * servicios y los serializadores compartan la misma fuente de verdad.
 */

/** Celebraciones que tienen intercambio de regalos. */
export const GIFT_EXCHANGE_EVENT_SLUGS = ["navidad"] as const;

export function hasGiftExchange(slug: string): boolean {
  return (GIFT_EXCHANGE_EVENT_SLUGS as readonly string[]).includes(slug);
}

/** Normaliza un correo para compararlo y guardarlo: sin espacios y en minúsculas. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
