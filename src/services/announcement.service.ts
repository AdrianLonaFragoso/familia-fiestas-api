import { getPrisma } from "../db/prisma.js";
import { mapAnnouncement, sortAnnouncements } from "../serializers/index.js";
import type { Announcement } from "../types.js";

export async function listAnnouncements(filters: {
  event_id?: string | undefined;
  priority?: string | undefined;
  limit?: number | undefined;
}): Promise<Announcement[]> {
  const prisma = getPrisma();
  const rows = await prisma.announcement.findMany({
    where: {
      isActive: true,
      OR: [{ eventId: null }, { event: { isReleased: true } }],
      ...(filters.event_id ? { eventId: filters.event_id } : {}),
      ...(filters.priority ? { priority: filters.priority } : {}),
    },
    include: { event: { select: { name: true, slug: true } } },
    orderBy: { publishedAt: "desc" },
  });

  const mapped = sortAnnouncements(
    rows.map((announcement) => mapAnnouncement(announcement, announcement.event)),
  );

  return filters.limit ? mapped.slice(0, filters.limit) : mapped;
}
