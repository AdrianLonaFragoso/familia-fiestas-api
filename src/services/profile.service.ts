import { getPrisma } from "../db/prisma.js";
import { conflict, notFound, unprocessable } from "../lib/http-error.js";
import {
  isChildGuest,
  normalizeEmail,
  registrationExchangeEnabled,
} from "../lib/event-rules.js";
import {
  dateOnly,
  formatDateLong,
  formatTime,
  timeOnly,
} from "../lib/dates.js";
import { RSVP_LABEL } from "../lib/labels.js";
import type { z } from "zod";
import type {
  profileUpdateSchema,
  profileAttendanceSchema,
} from "../schemas/profile.js";
const guestSelect = {
  id: true,
  fullName: true,
  email: true,
  avatar: true,
  familyId: true,
  tag: true,
} as const;
const eventInclude = {
  event: {
    include: { venue: true, hosts: { orderBy: { sortOrder: "asc" as const } } },
  },
} as const;
export async function getProfile(guestId: string) {
  const db = getPrisma();
  const guest = await db.guest.findUnique({
    where: { id: guestId },
    select: guestSelect,
  });
  if (!guest) throw notFound("Perfil no encontrado.");
  const [rows, families] = await Promise.all([
    db.eventGuest.findMany({
      where: { guestId },
      include: eventInclude,
      orderBy: { event: { eventDate: "asc" } },
    }),
    db.family.findMany({
      select: { id: true, name: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
  ]);
  return {
    guest: {
      id: guest.id,
      full_name: guest.fullName,
      email: guest.email,
      avatar: guest.avatar,
      family_id: guest.familyId,
      is_child: isChildGuest(guest),
    },
    families,
    events: rows.map((row) => ({
      id: row.event.id,
      name: row.event.name,
      event_date: dateOnly(row.event.eventDate),
      date_label: formatDateLong(dateOnly(row.event.eventDate)),
      start_time_label: formatTime(timeOnly(row.event.startTime)),
      venue: row.event.venue
        ? { name: row.event.venue.name, address: row.event.venue.address }
        : null,
      hosts: row.event.hosts.map((h) => h.name),
      status: row.status,
      status_label: RSVP_LABEL[row.status as keyof typeof RSVP_LABEL],
      exchange_enabled:
        registrationExchangeEnabled(row.event) && !isChildGuest(guest),
      participates_in_exchange: row.participatesInExchange,
      gift_suggestions: row.giftSuggestions,
      exchange_rules: row.event.exchangeRules,
    })),
    status_options: Object.entries(RSVP_LABEL).map(([value, label]) => ({
      value,
      label,
    })),
  };
}
export async function updateProfile(
  guestId: string,
  input: z.infer<typeof profileUpdateSchema>,
) {
  try {
    await getPrisma().$transaction(async (tx) => {
      const guest = await tx.guest.findUnique({
        where: { id: guestId },
        select: guestSelect,
      });
      if (!guest) throw notFound("Perfil no encontrado.");
      const email =
        input.email === undefined
          ? guest.email
          : input.email
            ? normalizeEmail(input.email)
            : null;
      if (!isChildGuest(guest) && !email)
        throw unprocessable("El correo es obligatorio para adultos.");
      if (
        input.family_id &&
        !(await tx.family.findUnique({
          where: { id: input.family_id },
          select: { id: true },
        }))
      )
        throw unprocessable("Selecciona una familia existente.");
      await tx.guest.update({
        where: { id: guestId },
        data: {
          ...(input.full_name !== undefined
            ? { fullName: input.full_name }
            : {}),
          ...(input.email !== undefined ? { email } : {}),
          ...(input.avatar !== undefined ? { avatar: input.avatar } : {}),
          ...(input.family_id !== undefined
            ? { familyId: input.family_id }
            : {}),
        },
      });
      await tx.accessAccount.updateMany({
        where: { guestId, role: "guest" },
        data: { name: input.full_name ?? guest.fullName, email },
      });
    });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002")
      throw conflict("Ese correo ya pertenece a otro invitado.");
    throw error;
  }
  return getProfile(guestId);
}
export async function updateProfileAttendance(
  guestId: string,
  eventId: string,
  input: z.infer<typeof profileAttendanceSchema>,
) {
  await getPrisma().$transaction(async (tx) => {
    const row = await tx.eventGuest.findUnique({
      where: { eventId_guestId: { guestId, eventId } },
      include: { guest: { select: { tag: true } }, event: true },
    });
    if (!row) throw notFound("Ya no tienes una invitación a este evento.");
    const status = input.status ?? row.status;
    const available =
      registrationExchangeEnabled(row.event) &&
      !isChildGuest(row.guest) &&
      status === "confirmed";
    if (input.participates_in_exchange === true && !available)
      throw unprocessable(
        "Solo los adultos con asistencia confirmada a Navidad pueden participar en el intercambio.",
      );
    if (!available && input.gift_suggestions !== undefined)
      throw unprocessable(
        "Confirma tu asistencia al evento con intercambio para editar los regalos.",
      );
    const participates = available
      ? (input.participates_in_exchange ?? row.participatesInExchange)
      : false;
    const gifts =
      input.gift_suggestions !== undefined
        ? input.gift_suggestions?.trim() || null
        : row.giftSuggestions;
    if (participates && !gifts)
      throw unprocessable("Escribe tus opciones de regalo para participar.");
    const saved = await tx.eventGuest.updateMany({
      where: { id: row.id, guestId, eventId },
      data: {
        status,
        respondedAt: new Date(),
        participatesInExchange: participates,
        giftSuggestions: gifts,
      },
    });
    if (!saved.count)
      throw notFound("Ya no tienes una invitación a este evento.");
  });
  return getProfile(guestId);
}
