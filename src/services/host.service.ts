import { getPrisma } from "../db/prisma.js";
import { notFound } from "../lib/http-error.js";
import { mapHost } from "../serializers/index.js";
import type { hostCreateSchema, hostUpdateSchema } from "../schemas/admin.js";
import type { z } from "zod";

type HostCreateInput = z.infer<typeof hostCreateSchema>;
type HostUpdateInput = z.infer<typeof hostUpdateSchema>;

export async function listHosts(eventId: string) {
  const prisma = getPrisma();
  const rows = await prisma.eventHost.findMany({
    where: { eventId },
    orderBy: { sortOrder: "asc" },
  });
  return rows.map(mapHost);
}

export async function createHost(eventId: string, input: HostCreateInput) {
  const prisma = getPrisma();
  const event = await prisma.event.findUnique({ where: { id: eventId }, select: { id: true } });
  if (!event) throw notFound("Celebración no encontrada.");

  const host = await prisma.eventHost.create({
    data: {
      eventId,
      ...(input.guest_id ? { guestId: input.guest_id } : {}),
      name: input.name,
      welcomeMessage: input.welcome_message ?? null,
      photoPath: input.photo_path ?? null,
      venueNotes: input.venue_notes ?? null,
      sortOrder: input.sort_order ?? 0,
    },
  });
  return mapHost(host);
}

export async function updateHost(id: string, input: HostUpdateInput) {
  const prisma = getPrisma();
  const current = await prisma.eventHost.findUnique({ where: { id }, select: { id: true } });
  if (!current) throw notFound("Anfitrión no encontrado.");

  const host = await prisma.eventHost.update({
    where: { id },
    data: {
      ...(input.guest_id !== undefined ? { guestId: input.guest_id } : {}),
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.welcome_message !== undefined
        ? { welcomeMessage: input.welcome_message }
        : {}),
      ...(input.photo_path !== undefined ? { photoPath: input.photo_path } : {}),
      ...(input.venue_notes !== undefined ? { venueNotes: input.venue_notes } : {}),
      ...(input.sort_order !== undefined ? { sortOrder: input.sort_order } : {}),
    },
  });
  return mapHost(host);
}

export async function deleteHost(id: string): Promise<void> {
  const prisma = getPrisma();
  const current = await prisma.eventHost.findUnique({ where: { id }, select: { id: true } });
  if (!current) throw notFound("Anfitrión no encontrado.");
  await prisma.eventHost.delete({ where: { id } });
}
