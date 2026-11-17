import { getPrisma } from "../db/prisma.js";
import { buildIcs, calendarMissing, dateOnly } from "../lib/dates.js";
import { forbidden, notFound, unauthorized, unprocessable } from "../lib/http-error.js";
import { mapInvitation } from "../serializers/index.js";
import type { Invitation, RsvpStatus } from "../types.js";

async function resolveToken(token: string) {
  const prisma = getPrisma();
  const row = await prisma.invitationToken.findUnique({
    where: { token },
    include: { guest: { select: { id: true, fullName: true } } },
  });
  if (!row || row.revokedAt) return null;
  return { prisma, row };
}

export async function getInvitation(token: string): Promise<Invitation | null> {
  const resolved = await resolveToken(token);
  if (!resolved) return null;
  const { prisma, row } = resolved;
  const guestId = row.guest.id;

  const [eventGuests, responsibilityAssignments, menuAssignments] = await Promise.all([
    prisma.eventGuest.findMany({
      where: { guestId },
      include: { event: { include: { venue: true } } },
    }),
    prisma.responsibilityAssignee.findMany({
      where: { guestId },
      include: { responsibility: { include: { event: true } } },
    }),
    prisma.menuItemAssignee.findMany({
      where: { guestId },
      include: { menuItem: { include: { event: true } } },
    }),
  ]);

  return mapInvitation({
    guest: row.guest,
    eventGuests: eventGuests.map((eventGuest) => ({
      status: eventGuest.status,
      event: eventGuest.event,
      venue: eventGuest.event.venue,
    })),
    responsibilityAssignments,
    menuAssignments,
  });
}

export async function setRsvp(input: {
  token: string;
  event_id: string;
  status: RsvpStatus;
}) {
  const resolved = await resolveToken(input.token);
  if (!resolved) {
    throw unauthorized("Este enlace ya no es válido. Pide uno nuevo a los organizadores.");
  }

  const result = await resolved.prisma.eventGuest.updateMany({
    where: { guestId: resolved.row.guest.id, eventId: input.event_id },
    data: { status: input.status, respondedAt: new Date() },
  });

  if (result.count === 0) {
    throw forbidden("No estás invitado a esta celebración.");
  }

  return {
    ok: true as const,
    event_id: input.event_id,
    status: input.status,
    responded_at: new Date().toISOString(),
  };
}

export async function getInvitationIcs(input: {
  token: string;
  event_id: string;
}): Promise<{ ics: string; filename: string }> {
  const resolved = await resolveToken(input.token);
  if (!resolved) {
    throw unauthorized("Este enlace ya no es válido. Pide uno nuevo a los organizadores.");
  }

  const eventGuest = await resolved.prisma.eventGuest.findFirst({
    where: { guestId: resolved.row.guest.id, eventId: input.event_id },
    include: { event: { include: { venue: true } } },
  });
  if (!eventGuest) throw notFound("No estás invitado a esta celebración.");

  const event = eventGuest.event;
  const eventDate = dateOnly(event.eventDate);
  const calendarInput = {
    name: event.name,
    event_date: eventDate,
    arrival_time: event.arrivalTime?.toISOString().slice(11, 19) ?? null,
    start_time: event.startTime?.toISOString().slice(11, 19) ?? null,
    end_time: event.endTime?.toISOString().slice(11, 19) ?? null,
    description: event.description,
    venue: event.venue,
  };

  const missing = calendarMissing(calendarInput);
  if (missing) throw unprocessable(missing);

  const ics = buildIcs(calendarInput, `invitacion-${resolved.row.guest.id}-${event.slug}`);
  if (!ics) throw unprocessable("No se pudo generar el calendario.");

  return { ics, filename: `${event.slug}-${resolved.row.guest.id}.ics` };
}
