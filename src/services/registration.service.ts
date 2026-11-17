import { getPrisma } from "../db/prisma.js";
import { hasGiftExchange, normalizeEmail } from "../lib/event-rules.js";
import { conflict, HttpError, notFound, unprocessable } from "../lib/http-error.js";
import { mapRegistration } from "../serializers/index.js";
import type { RegistrationInput } from "../schemas/registration.js";
import type { Registration } from "../types.js";

const DUPLICATE_MESSAGE = "Ese correo ya está inscrito en esta celebración.";

/**
 * Inscribe a una persona en una celebración.
 *
 * - Reutiliza el invitado si el correo ya existe.
 * - Si no existe, intenta vincularlo con un invitado sembrado del mismo nombre
 *   que todavía no tiene correo, para no duplicar familias.
 * - Si no hay coincidencia, crea el invitado en la familia "Por clasificar".
 * - Crea o actualiza la asistencia del evento; si ya se había inscrito antes
 *   con ese correo, responde 409.
 */
export async function registerForEvent(input: RegistrationInput): Promise<Registration> {
  const prisma = getPrisma();
  const event = await prisma.event.findUnique({
    where: { id: input.event_id },
    select: { id: true, slug: true, name: true, eventDate: true, giftExchangeEnabled: true },
  });
  if (!event) throw notFound("Celebración no encontrada.");

  const giftExchange = hasGiftExchange(event);
  if (input.participates_in_exchange && !giftExchange) {
    throw unprocessable("Esta celebración no tiene intercambio de regalos.");
  }

  const participates = giftExchange && input.participates_in_exchange;
  const giftSuggestions = participates ? input.gift_suggestions?.trim() || null : null;

  if (participates && !giftSuggestions) {
    throw unprocessable("Cuéntanos qué regalos te gustaría recibir.", {
      issues: [
        {
          path: "gift_suggestions",
          message: "Los regalos sugeridos son obligatorios cuando participas en el intercambio.",
        },
      ],
    });
  }

  const email = normalizeEmail(input.email);
  const fullName = input.full_name.trim();

  try {
    return await prisma.$transaction(async (tx) => {
      const existingGuest = await tx.guest.findUnique({ where: { email } });
      let guest = existingGuest;

      if (!guest) {
        const matchingName = await tx.guest.findFirst({
          where: {
            email: null,
            fullName: { equals: fullName, mode: "insensitive" },
          },
          select: { id: true },
        });

        guest = matchingName
          ? await tx.guest.update({
              where: { id: matchingName.id },
              data: {
                email,
                ...(input.avatar !== undefined ? { avatar: input.avatar } : {}),
              },
            })
          : await tx.guest.create({
              data: {
                fullName,
                email,
                avatar: input.avatar ?? null,
                family: {
                  connectOrCreate: {
                    where: { name: "Por clasificar" },
                    create: { name: "Por clasificar", sortOrder: 99, isUnassigned: true },
                  },
                },
              },
            });
      }

      const existing = await tx.eventGuest.findUnique({
        where: { eventId_guestId: { eventId: event.id, guestId: guest.id } },
      });

      if (existing?.registeredAt) {
        throw conflict(DUPLICATE_MESSAGE);
      }

      // El avatar pertenece a la persona y se comparte entre sus celebraciones.
      // Omitir el campo conserva el anterior; null lo quita explícitamente.
      if (existingGuest && input.avatar !== undefined && existingGuest.avatar !== input.avatar) {
        await tx.guest.update({
          where: { id: guest.id },
          data: { avatar: input.avatar },
        });
      }

      const registrationData = {
        participatesInExchange: participates,
        giftSuggestions,
        registeredAt: new Date(),
      };

      const saved = existing
        ? await tx.eventGuest.update({
            where: { id: existing.id },
            data: registrationData,
          })
        : await tx.eventGuest.create({
            data: {
              eventId: event.id,
              guestId: guest.id,
              status: "pending",
              ...registrationData,
            },
          });

      const fullGuest = await tx.guest.findUniqueOrThrow({
        where: { id: guest.id },
        include: { family: { select: { name: true } } },
      });

      return mapRegistration({
        id: saved.id,
        status: saved.status,
        participatesInExchange: saved.participatesInExchange,
        giftSuggestions: saved.giftSuggestions,
        registeredAt: saved.registeredAt ?? new Date(),
        guest: fullGuest,
        event,
      });
    });
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if ((error as { code?: string }).code === "P2002") {
      throw conflict(DUPLICATE_MESSAGE);
    }
    throw error;
  }
}

export async function listRegistrations(filters: {
  event_id?: string | undefined;
  search?: string | undefined;
}): Promise<Registration[]> {
  const prisma = getPrisma();
  const search = filters.search?.trim();

  const rows = await prisma.eventGuest.findMany({
    where: {
      registeredAt: { not: null },
      ...(filters.event_id ? { eventId: filters.event_id } : {}),
      ...(search
        ? {
            guest: {
              is: {
                OR: [
                  { fullName: { contains: search, mode: "insensitive" as const } },
                  { email: { contains: search, mode: "insensitive" as const } },
                ],
              },
            },
          }
        : {}),
    },
    include: {
      guest: { include: { family: { select: { name: true } } } },
      event: { select: { id: true, slug: true, name: true, eventDate: true, giftExchangeEnabled: true } },
    },
    orderBy: { registeredAt: "desc" },
  });

  return rows
    .filter((row) => row.registeredAt != null)
    .map((row) =>
      mapRegistration({
        id: row.id,
        status: row.status,
        participatesInExchange: row.participatesInExchange,
        giftSuggestions: row.giftSuggestions,
        registeredAt: row.registeredAt as Date,
        guest: row.guest,
        event: row.event,
      }),
    );
}
