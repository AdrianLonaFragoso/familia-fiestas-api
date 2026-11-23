import type { Response } from "express";
import { getPrisma } from "../db/prisma.js";
import { identity, allowEvent } from "./auth.js";
export async function checkSlug(res: Response, slug: string) {
  const event = await getPrisma().event.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (event) allowEvent(res, event.id);
}
export function visibleEvent(res: Response, event: any, registration = false) {
  const actor = identity(res);
  const allowed =
    actor?.role === "superuser" || actor?.event_ids.includes(event.id);
  if (allowed) return { ...event, can_manage: true };
  const {
    id,
    slug,
    name,
    event_date,
    arrival_time,
    start_time,
    dinner_time,
    end_time,
    display,
    event_hosts,
    registration_exchange_enabled,
    exchange_rules,
    registration_deadline,
    registration_deadline_label,
  } = event;
  return {
    id,
    slug,
    name,
    event_date,
    arrival_time,
    start_time,
    dinner_time,
    end_time,
    display,
    event_hosts,
    ...(registration
      ? {
          registration_exchange_enabled,
          exchange_rules,
          registration_deadline,
          registration_deadline_label,
        }
      : {}),
    can_manage: false,
    venue: event.venue
      ? { name: event.venue.name, address: event.venue.address }
      : null,
  };
}
