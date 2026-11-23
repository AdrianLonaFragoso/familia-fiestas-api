import type { Request, Response, NextFunction } from "express";
import { getPrisma } from "../db/prisma.js";
import { identity, allowEvent } from "./auth.js";
import { forbidden, notFound } from "../lib/http-error.js";

/** Una única frontera de autorización para todas las rutas administrativas existentes. */
export async function scopeAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const actor = identity(res);
  if (actor.role === "superuser") {
    next();
    return;
  }
  const db = getPrisma();
  const ids = actor.event_ids;
  const path = req.path.split("/").filter(Boolean);
  const resource = path[0];
  const id = path[1];
  const write = req.method !== "GET";
  const deny = () => {
    throw forbidden(
      "No tienes permiso para modificar este recurso compartido o ajeno.",
    );
  };
  const [links, guests, families, venues, events] = await Promise.all([
    db.eventGuest.findMany({
      select: { id: true, eventId: true, guestId: true },
    }),
    db.guest.findMany({ select: { id: true, familyId: true } }),
    db.family.findMany({ select: { id: true, createdByAccountId: true } }),
    db.venue.findMany({ select: { id: true, createdByAccountId: true } }),
    db.event.findMany({ select: { id: true, venueId: true } }),
  ]);
  const inScope = (eventId: string) => ids.includes(eventId);
  const visibleGuest = (guestId: string) =>
    links.some((l) => l.guestId === guestId && inScope(l.eventId));
  const exclusiveGuest = (guestId: string) =>
    visibleGuest(guestId) &&
    !links.some((l) => l.guestId === guestId && !inScope(l.eventId));
  const visibleFamily = (familyId: string) =>
    families.some(
      (f) => f.id === familyId && f.createdByAccountId === actor.id,
    ) || guests.some((g) => g.familyId === familyId && visibleGuest(g.id));
  const exclusiveFamily = (familyId: string) =>
    visibleFamily(familyId) &&
    !guests.some((g) => g.familyId === familyId && !exclusiveGuest(g.id));
  const visibleVenue = (venueId: string) =>
    venues.some((v) => v.id === venueId && v.createdByAccountId === actor.id) ||
    events.some((e) => e.venueId === venueId && inScope(e.id));
  const exclusiveVenue = (venueId: string) =>
    visibleVenue(venueId) &&
    !events.some((e) => e.venueId === venueId && !inScope(e.id));
  if (resource === "me" || resource === "options") {
    next();
    return;
  }
  if (resource === "accounts" || resource === "invitation-tokens") deny();
  if (resource === "events") {
    if (!id) {
      if (write) deny();
    } else {
      allowEvent(res, id);
      if (
        req.method === "DELETE" ||
        Object.hasOwn(req.body ?? {}, "is_released") ||
        Object.hasOwn(req.body ?? {}, "slug")
      )
        deny();
    }
  }
  if (req.query["event_id"]) allowEvent(res, String(req.query["event_id"]));
  if (req.body?.event_id) allowEvent(res, String(req.body.event_id));
  if (req.body?.event_ids) {
    if (!Array.isArray(req.body.event_ids)) deny();
    for (const eventId of req.body.event_ids) allowEvent(res, eventId);
  }
  if (resource === "guests") {
    if (id && !visibleGuest(id)) deny();
    if (write && id && (!exclusiveGuest(id) || req.method === "DELETE")) deny();
    if (
      req.method === "POST" &&
      (!Array.isArray(req.body?.event_ids) || !req.body.event_ids.length)
    )
      deny();
    if (req.body?.family_id && !visibleFamily(req.body.family_id)) deny();
  }
  if (resource === "families") {
    if (id && !visibleFamily(id)) deny();
    if (write && id && (!exclusiveFamily(id) || req.method === "DELETE"))
      deny();
  }
  if (resource === "venues") {
    if (id && !visibleVenue(id)) deny();
    if (write && id && (!exclusiveVenue(id) || req.method === "DELETE")) deny();
  }
  if (req.body?.venue_id && !visibleVenue(req.body.venue_id)) deny();
  if (req.body?.guest_id && !visibleGuest(req.body.guest_id)) deny();
  if (req.body?.guest_ids) {
    if (
      !Array.isArray(req.body.guest_ids) ||
      req.body.guest_ids.some((g: string) => !visibleGuest(g))
    )
      deny();
  }
  const eventResources = {
    hosts: db.eventHost,
    "menu-items": db.menuItem,
    responsibilities: db.responsibility,
    activities: db.activity,
    announcements: db.announcement,
    "event-guests": db.eventGuest,
  };
  if (id && Object.hasOwn(eventResources, resource ?? "")) {
    // Todos estos recursos se vinculan a un evento; también los IDs de subrutas.
    const delegate = eventResources[resource as keyof typeof eventResources];
    const row = await (
      delegate.findUnique as unknown as (args: {
        where: { id: string };
        select: { eventId: true };
      }) => Promise<{ eventId: string | null } | null>
    )({ where: { id }, select: { eventId: true } });
    if (!row) throw notFound("Recurso no encontrado.");
    if (!row.eventId) deny();
    allowEvent(res, row.eventId!);
  }
  if (
    resource === "announcements" &&
    write &&
    req.method !== "DELETE" &&
    !req.body?.event_id
  )
    deny();
  const allowed = new Set([
    "events",
    "guests",
    "families",
    "venues",
    "hosts",
    "menu-items",
    "responsibilities",
    "activities",
    "announcements",
    "event-guests",
    "registrations",
    "stats",
  ]);
  if (!allowed.has(resource ?? "")) deny();
  // La sede/familia recién creada pertenece al organizador, incluso antes de asignar invitados.
  if (
    req.method === "POST" &&
    (resource === "families" || resource === "venues")
  ) {
    const original = res.json.bind(res);
    res.json = ((body: Record<string, unknown>) => {
      const save =
        resource === "families"
          ? db.family.update({
              where: { id: String(body["id"]) },
              data: { createdByAccountId: actor.id },
            })
          : db.venue.update({
              where: { id: String(body["id"]) },
              data: { createdByAccountId: actor.id },
            });
      void save.then(() => original(body)).catch(next);
      return res;
    }) as typeof res.json;
    next();
    return;
  }
  // Lista global para superusuario; proyección estricta por cuenta para anfitriones.
  const original = res.json.bind(res);
  res.json = ((body: unknown) => {
    const cleanGuest = (g: any) => ({
      ...g,
      can_edit_profile: exclusiveGuest(g.id),
      can_delete: false,
      private: exclusiveGuest(g.id) ? g.private : null,
      invitation_tokens: [],
      event_statuses: g.event_statuses?.filter((e: any) => inScope(e.event_id)),
    });
    if (resource === "events" && Array.isArray(body))
      body = body.filter((e) => inScope(e.id));
    if (resource === "guests")
      body = Array.isArray(body)
        ? body.filter((g) => visibleGuest(g.id)).map(cleanGuest)
        : cleanGuest(body);
    if (resource === "families" && Array.isArray(body))
      body = body
        .filter((f) => visibleFamily(f.id))
        .map((f) => ({
          ...f,
          can_edit: exclusiveFamily(f.id),
          can_delete: false,
          guests_count: guests.filter(
            (g) => g.familyId === f.id && visibleGuest(g.id),
          ).length,
        }));
    if (resource === "venues" && Array.isArray(body))
      body = body
        .filter((v) => visibleVenue(v.id))
        .map((v) => ({ ...v, can_edit: exclusiveVenue(v.id) }));
    if (
      ["announcements", "registrations", "event-guests"].includes(
        resource ?? "",
      ) &&
      Array.isArray(body)
    )
      body = body.filter((row) => inScope(row.event_id));
    return original(body);
  }) as typeof res.json;
  if (resource === "stats") {
    const [eventRows, announcements, menu, responsibilities, activities] =
      await Promise.all([
        db.eventGuest.findMany({
          where: { eventId: { in: ids } },
          select: { status: true, registeredAt: true },
        }),
        db.announcement.count({
          where: { eventId: { in: ids }, isActive: true },
        }),
        db.menuItem.count({ where: { eventId: { in: ids } } }),
        db.responsibility.count({ where: { eventId: { in: ids } } }),
        db.activity.count({ where: { eventId: { in: ids } } }),
      ]);
    const counts = {
      total: eventRows.length,
      confirmed: 0,
      pending: 0,
      declined: 0,
    };
    for (const row of eventRows) {
      if (row.status === "confirmed") counts.confirmed++;
      else if (row.status === "declined") counts.declined++;
      else counts.pending++;
    }
    res.json({
      events: ids.length,
      guests: guests.filter((g) => visibleGuest(g.id)).length,
      families: families.filter((f) => visibleFamily(f.id)).length,
      active_announcements: announcements,
      menu_items: menu,
      responsibilities,
      activities,
      registrations: eventRows.filter((e) => e.registeredAt).length,
      rsvp: counts,
      invitation_tokens: { total: 0, active: 0, revoked: 0 },
    });
    return;
  }
  next();
}
