import { getPrisma } from "../db/prisma.js";
import { mapParticipant } from "../serializers/index.js";
import type { Participant } from "../types.js";

export async function listParticipants(filters: {
  event_id?: string | undefined;
  family_id?: string | undefined;
  search?: string | undefined;
}): Promise<Participant[]> {
  const prisma = getPrisma();
  const rows = await prisma.guest.findMany({
    where: {
      ...(filters.family_id ? { familyId: filters.family_id } : {}),
      ...(filters.search
        ? { fullName: { contains: filters.search, mode: "insensitive" as const } }
        : {}),
      ...(filters.event_id
        ? { eventGuests: { some: { eventId: filters.event_id, event: { isReleased: true } } } }
        : {}),
    },
    include: {
      family: { select: { name: true } },
      eventGuests: {
        where: { event: { isReleased: true } },
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
    },
    orderBy: { fullName: "asc" },
  });

  return rows.map((guest) =>
    mapParticipant(
      guest,
      filters.event_id
        ? guest.eventGuests.filter((eventGuest) => eventGuest.eventId === filters.event_id)
        : guest.eventGuests,
    ),
  );
}
