import { getPrisma } from "../db/prisma.js";
import {
  buildIcs,
  calendarMissing,
  dateOnly,
  googleCalendarUrl,
} from "../lib/dates.js";
import { notFound, unprocessable } from "../lib/http-error.js";
import {
  mapAnnouncement,
  mapEvent,
  mapEventGuest,
  mapEventSummary,
  mapGuest,
  mapHost,
  mapMenu,
  mapResponsibility,
  mapActivity,
  mapVenue,
  countStatuses,
  nextEventId,
  sortAnnouncements,
  featuredAnnouncements,
} from "../serializers/index.js";
import type { EventBundle, EventSummary, HomePayload } from "../types.js";
import { optionalTime, parseDateOnly, timeOrNull } from "../schemas/common.js";
import type { eventCreateSchema, eventUpdateSchema } from "../schemas/admin.js";
import type { z } from "zod";

type EventCreateInput = z.infer<typeof eventCreateSchema>;
type EventUpdateInput = z.infer<typeof eventUpdateSchema>;

export async function listEvents(): Promise<EventSummary[]> {
  const prisma = getPrisma();
  const rows = await prisma.event.findMany({
    orderBy: { eventDate: "asc" },
    include: {
      venue: true,
      guests: { select: { status: true } },
      hosts: { select: { name: true }, orderBy: { sortOrder: "asc" } },
    },
  });

  const nextId = nextEventId(rows);
  return rows.map((event) =>
    mapEventSummary(event, event.venue, event.guests, event.hosts, event.id === nextId),
  );
}

export async function getEventBundle(slug: string): Promise<EventBundle | null> {
  const prisma = getPrisma();
  const event = await prisma.event.findUnique({
    where: { slug },
    include: {
      venue: true,
      guests: { include: { guest: { include: { family: true } } } },
      hosts: { orderBy: { sortOrder: "asc" } },
      menuItems: {
        orderBy: { createdAt: "asc" },
        include: { assignees: { select: { guestId: true } } },
      },
      responsibilities: {
        orderBy: { createdAt: "asc" },
        include: { assignees: { select: { guestId: true } } },
      },
      activities: { orderBy: [{ sortOrder: "asc" }, { startTime: "asc" }] },
    },
  });

  if (!event) return null;

  const announcements = await prisma.announcement.findMany({
    where: { isActive: true, OR: [{ eventId: event.id }, { eventId: null }] },
    include: { event: { select: { name: true, slug: true } } },
    orderBy: { publishedAt: "desc" },
  });

  return {
    event: {
      ...mapEvent(event, event.venue),
      venue: event.venue ? mapVenue(event.venue) : null,
    },
    attendance: event.guests
      .map((eventGuest) => ({
        ...mapEventGuest(eventGuest),
        guest: mapGuest(eventGuest.guest),
      }))
      .sort((a, b) => a.guest.full_name.localeCompare(b.guest.full_name, "es")),
    hosts: event.hosts.map(mapHost),
    menu: event.menuItems.map(mapMenu),
    responsibilities: event.responsibilities.map(mapResponsibility),
    activities: event.activities.map(mapActivity),
    announcements: sortAnnouncements(
      announcements.map((announcement) => mapAnnouncement(announcement, announcement.event)),
    ),
    attendance_counts: countStatuses(event.guests),
  };
}

export async function getHome(): Promise<HomePayload> {
  const [events, announcements] = await Promise.all([
    listEvents(),
    listAnnouncements(),
  ]);

  return {
    events,
    announcements,
    next_event: events.find((event) => event.is_next) ?? null,
    featured_announcements: featuredAnnouncements(announcements),
  };
}

export async function getEventIcs(
  slug: string,
): Promise<{ ics: string; filename: string }> {
  const prisma = getPrisma();
  const event = await prisma.event.findUnique({
    where: { slug },
    include: { venue: true },
  });
  if (!event) throw notFound("Celebración no encontrada.");

  const eventDate = dateOnly(event.eventDate);
  const input = {
    name: event.name,
    event_date: eventDate,
    arrival_time: event.arrivalTime?.toISOString().slice(11, 19) ?? null,
    start_time: event.startTime?.toISOString().slice(11, 19) ?? null,
    end_time: event.endTime?.toISOString().slice(11, 19) ?? null,
    description: event.description,
    venue: event.venue,
  };

  const missing = calendarMissing(input);
  if (missing) throw unprocessable(missing);

  const ics = buildIcs(input, `evento-${event.slug}`);
  if (!ics) throw unprocessable("No se pudo generar el calendario.");

  return { ics, filename: `${event.slug}.ics` };
}

export async function getEventCalendarLinks(slug: string): Promise<{
  google_url: string | null;
  available: boolean;
  missing_reason: string | null;
}> {
  const prisma = getPrisma();
  const event = await prisma.event.findUnique({
    where: { slug },
    include: { venue: true },
  });
  if (!event) throw notFound("Celebración no encontrada.");

  const eventDate = dateOnly(event.eventDate);
  const input = {
    name: event.name,
    event_date: eventDate,
    arrival_time: event.arrivalTime?.toISOString().slice(11, 19) ?? null,
    start_time: event.startTime?.toISOString().slice(11, 19) ?? null,
    end_time: event.endTime?.toISOString().slice(11, 19) ?? null,
    description: event.description,
    venue: event.venue,
  };

  const missing = calendarMissing(input);
  return {
    google_url: googleCalendarUrl(input),
    available: missing == null,
    missing_reason: missing,
  };
}

export async function createEvent(input: EventCreateInput) {
  const prisma = getPrisma();
  const event = await prisma.event.create({
    data: {
      slug: input.slug,
      name: input.name,
      giftExchangeEnabled: input.gift_exchange_enabled ?? false,
      eventDate: parseDateOnly(input.event_date),
      arrivalTime: optionalTime(input.arrival_time) ?? null,
      startTime: optionalTime(input.start_time) ?? null,
      dinnerTime: optionalTime(input.dinner_time) ?? null,
      endTime: optionalTime(input.end_time) ?? null,
      description: input.description ?? null,
      observations: input.observations ?? null,
      ...(input.venue_id ? { venue: { connect: { id: input.venue_id } } } : {}),
    },
    include: { venue: true },
  });
  return mapEvent(event, event.venue);
}

export async function updateEvent(id: string, input: EventUpdateInput) {
  const prisma = getPrisma();
  const current = await prisma.event.findUnique({ where: { id }, select: { id: true } });
  if (!current) throw notFound("Celebración no encontrada.");

  const event = await prisma.event.update({
    where: { id },
    data: {
      ...(input.slug !== undefined ? { slug: input.slug } : {}),
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.gift_exchange_enabled !== undefined
        ? { giftExchangeEnabled: input.gift_exchange_enabled } : {}),
      ...(input.event_date !== undefined
        ? { eventDate: parseDateOnly(input.event_date) }
        : {}),
      ...(input.arrival_time !== undefined
        ? { arrivalTime: timeOrNull(input.arrival_time) }
        : {}),
      ...(input.start_time !== undefined
        ? { startTime: timeOrNull(input.start_time) }
        : {}),
      ...(input.dinner_time !== undefined
        ? { dinnerTime: timeOrNull(input.dinner_time) }
        : {}),
      ...(input.end_time !== undefined ? { endTime: timeOrNull(input.end_time) } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.observations !== undefined ? { observations: input.observations } : {}),
      ...(input.venue_id !== undefined
        ? {
            venue: input.venue_id
              ? { connect: { id: input.venue_id } }
              : { disconnect: true },
          }
        : {}),
    },
    include: { venue: true },
  });
  return mapEvent(event, event.venue);
}

export async function deleteEvent(id: string): Promise<void> {
  const prisma = getPrisma();
  const current = await prisma.event.findUnique({ where: { id }, select: { id: true } });
  if (!current) throw notFound("Celebración no encontrada.");
  await prisma.event.delete({ where: { id } });
}

async function listAnnouncements() {
  const prisma = getPrisma();
  const rows = await prisma.announcement.findMany({
    where: { isActive: true },
    include: { event: { select: { name: true, slug: true } } },
    orderBy: { publishedAt: "desc" },
  });
  return sortAnnouncements(
    rows.map((announcement) => mapAnnouncement(announcement, announcement.event)),
  );
}

/** Reemplaza solo la lista de este evento; conserva RSVP y datos de miembros existentes. */
export async function setEventGuests(id: string, guestIds: string[]) {
  const ids = [...new Set(guestIds)];
  return getPrisma().$transaction(async (tx) => {
    if (!await tx.event.findUnique({ where: { id }, select: { id: true } })) {
      throw notFound("Celebración no encontrada.");
    }
    const count = await tx.guest.count({ where: { id: { in: ids } } });
    if (count !== ids.length) throw unprocessable("Uno o más invitados ya no existen.");
    await tx.eventGuest.deleteMany({ where: { eventId: id, guestId: { notIn: ids } } });
    await tx.eventGuest.createMany({
      data: ids.map((guestId) => ({ eventId: id, guestId })), skipDuplicates: true,
    });
    return { ok: true, event_id: id, guests_count: ids.length };
  });
}
