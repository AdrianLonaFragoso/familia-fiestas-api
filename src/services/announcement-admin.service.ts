import { getPrisma } from "../db/prisma.js";
import { notFound } from "../lib/http-error.js";
import { mapAnnouncement, sortAnnouncements } from "../serializers/index.js";
import type {
  announcementCreateSchema,
  announcementUpdateSchema,
} from "../schemas/admin.js";
import type { z } from "zod";

type AnnouncementCreateInput = z.infer<typeof announcementCreateSchema>;
type AnnouncementUpdateInput = z.infer<typeof announcementUpdateSchema>;

export async function listAllAnnouncements(filters: { event_id?: string | undefined }) {
  const prisma = getPrisma();
  const rows = await prisma.announcement.findMany({
    where: filters.event_id ? { eventId: filters.event_id } : {},
    include: { event: { select: { name: true, slug: true } } },
    orderBy: { publishedAt: "desc" },
  });
  return sortAnnouncements(
    rows.map((announcement) => mapAnnouncement(announcement, announcement.event)),
  );
}

export async function createAnnouncement(input: AnnouncementCreateInput) {
  const prisma = getPrisma();
  if (input.event_id) {
    const event = await prisma.event.findUnique({
      where: { id: input.event_id },
      select: { id: true },
    });
    if (!event) throw notFound("Celebración no encontrada.");
  }

  const announcement = await prisma.announcement.create({
    data: {
      ...(input.event_id ? { eventId: input.event_id } : {}),
      title: input.title,
      content: input.content ?? "",
      category: input.category ?? "general",
      priority: input.priority ?? "normal",
      ...(input.published_at ? { publishedAt: new Date(input.published_at) } : {}),
      isActive: input.is_active ?? true,
    },
    include: { event: { select: { name: true, slug: true } } },
  });
  return mapAnnouncement(announcement, announcement.event);
}

export async function updateAnnouncement(id: string, input: AnnouncementUpdateInput) {
  const prisma = getPrisma();
  const current = await prisma.announcement.findUnique({ where: { id }, select: { id: true } });
  if (!current) throw notFound("Aviso no encontrado.");

  const announcement = await prisma.announcement.update({
    where: { id },
    data: {
      ...(input.event_id !== undefined
        ? input.event_id
          ? { eventId: input.event_id }
          : { eventId: null }
        : {}),
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.content !== undefined ? { content: input.content } : {}),
      ...(input.category !== undefined ? { category: input.category } : {}),
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
      ...(input.published_at !== undefined
        ? { publishedAt: new Date(input.published_at) }
        : {}),
      ...(input.is_active !== undefined ? { isActive: input.is_active } : {}),
    },
    include: { event: { select: { name: true, slug: true } } },
  });
  return mapAnnouncement(announcement, announcement.event);
}

export async function deleteAnnouncement(id: string): Promise<void> {
  const prisma = getPrisma();
  const current = await prisma.announcement.findUnique({ where: { id }, select: { id: true } });
  if (!current) throw notFound("Aviso no encontrado.");
  await prisma.announcement.delete({ where: { id } });
}
