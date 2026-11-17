import { getPrisma } from "../db/prisma.js";
import type { AdminStats } from "../types.js";

export async function getStats(): Promise<AdminStats> {
  const prisma = getPrisma();

  const [
    events,
    guests,
    families,
    activeAnnouncements,
    menuItems,
    responsibilities,
    activities,
    rsvpGroups,
    registrations,
    tokenTotal,
    tokenRevoked,
  ] = await Promise.all([
    prisma.event.count(),
    prisma.guest.count(),
    prisma.family.count(),
    prisma.announcement.count({ where: { isActive: true } }),
    prisma.menuItem.count(),
    prisma.responsibility.count(),
    prisma.activity.count(),
    prisma.eventGuest.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.eventGuest.count({ where: { registeredAt: { not: null } } }),
    prisma.invitationToken.count(),
    prisma.invitationToken.count({ where: { revokedAt: { not: null } } }),
  ]);

  const rsvp = { total: 0, confirmed: 0, pending: 0, declined: 0 };
  for (const group of rsvpGroups) {
    const count = group._count._all;
    rsvp.total += count;
    if (group.status === "confirmed") rsvp.confirmed += count;
    else if (group.status === "declined") rsvp.declined += count;
    else rsvp.pending += count;
  }

  return {
    events,
    guests,
    families,
    active_announcements: activeAnnouncements,
    registrations,
    rsvp,
    menu_items: menuItems,
    responsibilities,
    activities,
    invitation_tokens: {
      total: tokenTotal,
      active: tokenTotal - tokenRevoked,
      revoked: tokenRevoked,
    },
  };
}
