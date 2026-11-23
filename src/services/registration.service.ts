import type { Prisma } from "../generated/prisma/client.js";
import { getPrisma } from "../db/prisma.js";
import { registrationExchangeEnabled, isChildGuest, normalizeEmail } from "../lib/event-rules.js";
import { conflict, HttpError, notFound, unprocessable } from "../lib/http-error.js";
import { mapRegistration } from "../serializers/index.js";
import type { RegistrationInput, RegistrationBatchInput } from "../schemas/registration.js";
import type { Registration } from "../types.js";

const DUPLICATE_MESSAGE = "Ese correo ya está inscrito en esta celebración.";

/**
 * Inscribe a una persona en una celebración.
 *
 * - Reutiliza el invitado si el correo ya existe.
 * - Niños sin correo: identifica por nombre completo bajo bloqueo transaccional;
 *   solo reutiliza perfiles identificados como niños y deriva homónimos al panel.
 * - Si no existe, intenta vincularlo con un invitado sembrado del mismo nombre
 *   que todavía no tiene correo, para no duplicar familias.
 * - Si no hay coincidencia, crea el invitado en la familia "Por clasificar".
 * - Crea o actualiza la asistencia del evento; si ya se había inscrito antes
 *   con ese correo, responde 409.
 */
export async function registerForEvent(input: RegistrationInput, transaction?: Prisma.TransactionClient): Promise<Registration> {
  const prisma = transaction ?? getPrisma();
  const event = await prisma.event.findUnique({
    where: { id: input.event_id },
    select: { id: true, slug: true, name: true, eventDate: true, giftExchangeEnabled: true, isReleased: true },
  });
  if (!event || event.isReleased === false) throw notFound("Celebración no encontrada.");

  const giftExchange = registrationExchangeEnabled(event);
  if (input.participates_in_exchange && !giftExchange) {
    throw unprocessable("El intercambio es solo para adultos que asistan a Navidad, el 24 de diciembre.");
  }

  if (input.participates_in_exchange && input.is_child) {
    throw unprocessable("El intercambio es exclusivo para adultos. Los niños pueden confirmar su asistencia sin participar.");
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

  const email = input.email ? normalizeEmail(input.email) : null;
  if (!email && !input.is_child) throw unprocessable("El correo es obligatorio para adultos.");
  const duplicateMessage = email ? DUPLICATE_MESSAGE : "Este niño o niña ya está inscrito en esta celebración.";
  const fullName = input.full_name.trim();

  try {
    const save = async (tx: Prisma.TransactionClient) => {
      let existingGuest = email ? await tx.guest.findUnique({ where: { email } }) : null;
      if (!email) {
        // Serializa inscripciones sin correo del mismo nombre, incluso entre eventos.
        const identity = `registration-child:${fullName.toLocaleLowerCase("es")}`;
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${identity}, 0))::text`;
        const matches = await tx.guest.findMany({
          where: { email: null, fullName: { equals: fullName, mode: "insensitive" } },
          take: 2,
        });
        if (matches.length > 1) {
          throw conflict("Hay varias personas sin correo con ese nombre. Pide a un organizador que complete la inscripción desde el panel.");
        }
        existingGuest = matches[0] ?? null;
        if (existingGuest && !isChildGuest(existingGuest)) {
          throw conflict("Ya existe una persona sin correo con ese nombre. Pide a un organizador que confirme su inscripción desde el panel.");
        }
      }
      let guest = existingGuest;

      if (!guest) {
        const matchingName = email ? await tx.guest.findFirst({
          where: {
            email: null,
            fullName: { equals: fullName, mode: "insensitive" },
          },
          select: { id: true },
        }) : null;

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
                ...(input.is_child ? { tag: "Niño/a" } : {}),
                family: {
                  connectOrCreate: {
                    where: { name: "Por clasificar" },
                    create: { name: "Por clasificar", sortOrder: 99, isUnassigned: true },
                  },
                },
              },
            });
      }

      if (participates && isChildGuest(guest)) {
        throw unprocessable("El intercambio es exclusivo para adultos. Los niños pueden confirmar su asistencia sin participar.");
      }

      const existing = await tx.eventGuest.findUnique({
        where: { eventId_guestId: { eventId: event.id, guestId: guest.id } },
      });

      if (existing?.registeredAt) {
        throw conflict(duplicateMessage, { event_id: event.id, event_name: event.name });
      }

      // El avatar pertenece a la persona y se comparte entre sus celebraciones.
      // Omitir el campo conserva el anterior; null lo quita explícitamente.
      if (existingGuest && input.avatar !== undefined && existingGuest.avatar !== input.avatar) {
        await tx.guest.update({
          where: { id: guest.id },
          data: { avatar: input.avatar },
        });
      }

      const registeredAt = new Date();
      const registrationData = {
        status: "confirmed" as const,
        respondedAt: registeredAt,
        participatesInExchange: participates,
        giftSuggestions,
        registeredAt,
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
    };
    return transaction ? await save(transaction) : await getPrisma().$transaction(save);
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if ((error as { code?: string }).code === "P2002") {
      throw conflict(duplicateMessage);
    }
    throw error;
  }
}

/** Todas las fechas se confirman juntas; cualquier error revierte el registro completo. */
export async function registerForEvents(input: RegistrationBatchInput): Promise<{ registrations: Registration[] }> {
  return getPrisma().$transaction(async (tx) => {
    const events = await tx.event.findMany({
      where: { id: { in: input.event_ids } },
      select: { id: true, slug: true, eventDate: true, giftExchangeEnabled: true, isReleased: true },
    });
    if (events.length !== input.event_ids.length || events.some((event) => event.isReleased === false)) throw notFound("Una de las fechas seleccionadas ya no está disponible.");
    const exchangeEvent = events.find(registrationExchangeEnabled);
    if (input.participates_in_exchange && (!exchangeEvent || input.is_child)) {
      throw unprocessable("El intercambio es solo para adultos que confirmen Navidad, el 24 de diciembre.");
    }
    const registrations: Registration[] = [];
    for (const eventId of input.event_ids) {
      const participates = input.participates_in_exchange && eventId === exchangeEvent?.id;
      registrations.push(await registerForEvent({
        ...input, event_id: eventId, participates_in_exchange: participates,
        gift_suggestions: participates ? input.gift_suggestions : null,
      }, tx));
    }
    return { registrations };
  });
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
      event: { select: { id: true, slug: true, name: true, eventDate: true, giftExchangeEnabled: true, isReleased: true } },
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
