import { getPrisma } from "../db/prisma.js";
import { conflict, notFound, unprocessable } from "../lib/http-error.js";
import { hasGiftExchange, normalizeEmail } from "../lib/event-rules.js";
import { mapAdminGuest } from "../serializers/index.js";
import type { AdminGuest } from "../types.js";
import type {
  eventGuestUpdateSchema,
  guestCreateSchema,
  guestPrivateSchema,
  guestUpdateSchema,
} from "../schemas/admin.js";
import type { z } from "zod";

type GuestCreateInput = z.infer<typeof guestCreateSchema>;
type GuestUpdateInput = z.infer<typeof guestUpdateSchema>;
type GuestPrivateInput = z.infer<typeof guestPrivateSchema>;
type EventGuestUpdateInput = z.infer<typeof eventGuestUpdateSchema>;

const guestInclude = {
  family: { select: { name: true } },
  private: true,
  eventGuests: {
    include: {
      event: {
        select: {
          id: true,
          slug: true,
          name: true,
          eventDate: true,
          startTime: true,
          arrivalTime: true,
        },
      },
    },
  },
  invitationTokens: { orderBy: { createdAt: "desc" as const } },
};

export async function listGuests(
  filters: {
    family_id?: string | undefined;
    search?: string | undefined;
    event_id?: string | undefined;
    status?: "pending" | "confirmed" | "declined" | undefined;
  },
  allowedEventIds?: string[],
): Promise<AdminGuest[]> {
  const prisma = getPrisma();
  const rows = await prisma.guest.findMany({
    where: {
      ...(filters.event_id || filters.status || allowedEventIds !== undefined
        ? {
            eventGuests: {
              some: {
                ...(filters.event_id
                  ? { eventId: filters.event_id }
                  : allowedEventIds !== undefined
                    ? { eventId: { in: allowedEventIds } }
                    : {}),
                ...(filters.status ? { status: filters.status } : {}),
              },
            },
          }
        : {}),
      ...(filters.family_id ? { familyId: filters.family_id } : {}),
      ...(filters.search
        ? {
            OR: [
              {
                fullName: {
                  contains: filters.search,
                  mode: "insensitive" as const,
                },
              },
              {
                email: {
                  contains: filters.search,
                  mode: "insensitive" as const,
                },
              },
            ],
          }
        : {}),
    },
    include: guestInclude,
    orderBy: { fullName: "asc" },
  });
  return rows.map(mapAdminGuest);
}

export async function getGuest(id: string): Promise<AdminGuest> {
  const prisma = getPrisma();
  const guest = await prisma.guest.findUnique({
    where: { id },
    include: guestInclude,
  });
  if (!guest) throw notFound("Invitado no encontrado.");
  return mapAdminGuest(guest);
}

const DUPLICATE_EMAIL = "Ese correo ya pertenece a otro invitado.";

function rethrowUnique(error: unknown): never {
  if ((error as { code?: string }).code === "P2002") throw conflict(DUPLICATE_EMAIL);
  throw error;
}

export async function createGuest(
  input: GuestCreateInput,
): Promise<AdminGuest> {
  const prisma = getPrisma();
  const eventIds = input.event_ids ?? [];

  try {
    const guest = await prisma.$transaction(async (tx) => {
      const created = await tx.guest.create({
        data: {
          fullName: input.full_name,
          email: input.email ? normalizeEmail(input.email) : null,
          avatar: input.avatar ?? null,
          gender: input.gender ?? null,
          ...(input.family_id
            ? { family: { connect: { id: input.family_id } } }
            : {}),
          tag: input.tag ?? null,
        },
      });

      if (eventIds.length > 0) {
        await tx.eventGuest.createMany({
          data: eventIds.map((eventId) => ({ eventId, guestId: created.id })),
          skipDuplicates: true,
        });
      }

      return tx.guest.findUniqueOrThrow({
        where: { id: created.id },
        include: guestInclude,
      });
    });
    return mapAdminGuest(guest);
  } catch (error) {
    rethrowUnique(error);
  }
}

export async function updateGuest(
  id: string,
  input: GuestUpdateInput,
): Promise<AdminGuest> {
  const prisma = getPrisma();
  const current = await prisma.guest.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!current) throw notFound("Invitado no encontrado.");

  try {
    const guest = await prisma.$transaction(async (tx) => {
      await tx.guest.update({
        where: { id },
        data: {
          ...(input.full_name !== undefined ? { fullName: input.full_name } : {}),
          ...(input.email !== undefined
            ? { email: input.email ? normalizeEmail(input.email) : null }
            : {}),
          ...(input.avatar !== undefined ? { avatar: input.avatar } : {}),
          ...(input.gender !== undefined ? { gender: input.gender } : {}),
          ...(input.tag !== undefined ? { tag: input.tag } : {}),
          ...(input.family_id !== undefined
            ? {
                family: input.family_id
                  ? { connect: { id: input.family_id } }
                  : { disconnect: true },
              }
            : {}),
        },
      });

      if (input.event_ids !== undefined) {
        await tx.eventGuest.deleteMany({
          where: { guestId: id, eventId: { notIn: input.event_ids } },
        });
        if (input.event_ids.length > 0) {
          await tx.eventGuest.createMany({
            data: input.event_ids.map((eventId) => ({ eventId, guestId: id })),
            skipDuplicates: true,
          });
        }
      }

      return tx.guest.findUniqueOrThrow({
        where: { id },
        include: guestInclude,
      });
    });
    return mapAdminGuest(guest);
  } catch (error) {
    rethrowUnique(error);
  }
}

export async function deleteGuest(id: string): Promise<void> {
  const prisma = getPrisma();
  const current = await prisma.guest.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!current) throw notFound("Invitado no encontrado.");
  await prisma.guest.delete({ where: { id } });
}

export async function upsertGuestPrivate(id: string, input: GuestPrivateInput) {
  const prisma = getPrisma();
  const guest = await prisma.guest.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!guest) throw notFound("Invitado no encontrado.");

  const result = await prisma.guestPrivate.upsert({
    where: { guestId: id },
    create: {
      guestId: id,
      dietaryNotes: input.dietary_notes ?? null,
      adminNotes: input.admin_notes ?? null,
    },
    update: {
      ...(input.dietary_notes !== undefined
        ? { dietaryNotes: input.dietary_notes }
        : {}),
      ...(input.admin_notes !== undefined ? { adminNotes: input.admin_notes } : {}),
    },
  });

  return {
    guest_id: result.guestId,
    dietary_notes: result.dietaryNotes,
    admin_notes: result.adminNotes,
    updated_at: result.updatedAt.toISOString(),
  };
}

export async function listEventGuests(filters: {
  event_id?: string | undefined;
}) {
  const prisma = getPrisma();
  const rows = await prisma.eventGuest.findMany({
    where: filters.event_id ? { eventId: filters.event_id } : {},
    include: {
      guest: { include: { family: { select: { name: true } } } },
      event: { select: { id: true, slug: true, name: true } },
    },
    orderBy: [{ event: { eventDate: "asc" } }, { guest: { fullName: "asc" } }],
  });

  return rows.map((row) => ({
    id: row.id,
    event_id: row.eventId,
    event_slug: row.event.slug,
    event_name: row.event.name,
    guest_id: row.guestId,
    guest_name: row.guest.fullName,
    email: row.guest.email,
    family_name: row.guest.family?.name ?? null,
    status: row.status,
    status_label:
      row.status === "confirmed"
        ? "Confirmado"
        : row.status === "declined"
          ? "No asistirá"
          : "Pendiente de confirmar",
    public_note: row.publicNote,
    participates_in_exchange: row.participatesInExchange,
    gift_suggestions: row.giftSuggestions,
    registered_at: row.registeredAt?.toISOString() ?? null,
    responded_at: row.respondedAt?.toISOString() ?? null,
  }));
}

export async function updateEventGuest(
  id: string,
  input: EventGuestUpdateInput,
) {
  const prisma = getPrisma();
  const current = await prisma.eventGuest.findUnique({
    where: { id },
    select: {
      id: true,
      eventId: true,
      guestId: true,
      participatesInExchange: true,
      giftSuggestions: true,
      event: { select: { slug: true, giftExchangeEnabled: true } },
    },
  });
  if (!current) throw notFound("Registro de asistencia no encontrado.");

  if (input.participates_in_exchange === true && !hasGiftExchange(current.event)) {
    throw unprocessable("Esta celebración no tiene intercambio de regalos.");
  }

  const participates = input.participates_in_exchange ?? current.participatesInExchange;
  const gifts =
    input.gift_suggestions !== undefined
      ? input.gift_suggestions
      : current.giftSuggestions;

  if (participates && !gifts?.trim()) {
    throw unprocessable("Cuéntanos qué regalos te gustaría recibir.", {
      issues: [
        {
          path: "gift_suggestions",
          message: "Los regalos sugeridos son obligatorios cuando participas en el intercambio.",
        },
      ],
    });
  }

  const row = await prisma.eventGuest.update({
    where: { id },
    data: {
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.public_note !== undefined ? { publicNote: input.public_note } : {}),
      ...(input.participates_in_exchange !== undefined
        ? { participatesInExchange: input.participates_in_exchange }
        : {}),
      ...(input.gift_suggestions !== undefined
        ? { giftSuggestions: input.gift_suggestions }
        : {}),
      ...(input.status !== undefined && input.responded_at === undefined
        ? { respondedAt: new Date() }
        : {}),
      ...(input.responded_at !== undefined
        ? {
            respondedAt: input.responded_at
              ? new Date(input.responded_at)
              : null,
          }
        : {}),
    },
  });

  return {
    id: row.id,
    event_id: row.eventId,
    guest_id: row.guestId,
    status: row.status,
    public_note: row.publicNote,
    participates_in_exchange: row.participatesInExchange,
    gift_suggestions: row.giftSuggestions,
    responded_at: row.respondedAt?.toISOString() ?? null,
  };
}
