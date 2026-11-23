import {
  requireAdmin,
  requireSuper,
  identity,
  allowEvent,
} from "../middleware/auth.js";
import { checkSlug, visibleEvent } from "../middleware/public-access.js";
import { Router } from "express";

import { notFound } from "../lib/http-error.js";
import { registrationRateLimit } from "../middleware/rate-limit.js";
import { parseQuery, validateBody } from "../middleware/validate.js";
import {
  announcementsQuerySchema,
  participantsQuerySchema,
} from "../schemas/public.js";
import {
  registrationSchema,
  registrationBatchSchema,
} from "../schemas/registration.js";
import { listAnnouncements } from "../services/announcement.service.js";
import {
  getEventBundle,
  getEventCalendarLinks,
  getEventIcs,
  getHome,
  listEvents,
} from "../services/event.service.js";
import { listFamilies } from "../services/family.service.js";
import { listParticipants } from "../services/participant.service.js";
import {
  registerForEvent,
  registerForEvents,
} from "../services/registration.service.js";

export const publicRouter = Router();

publicRouter.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

publicRouter.get("/home", async (_req, res) => {
  const home = await getHome();
  const actor = identity(res);
  res.setHeader("Cache-Control", "no-store");
  res.json({
    ...home,
    events: home.events.map((event) => visibleEvent(res, event)),
    next_event: home.next_event ? visibleEvent(res, home.next_event) : null,
    upcoming_events: actor
      ? home.upcoming_events?.filter(
          (event) =>
            actor.role === "superuser" || actor.event_ids.includes(event.id),
        )
      : [],
  });
});

publicRouter.get("/events", async (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json((await listEvents()).map((event) => visibleEvent(res, event, true)));
});

publicRouter.get("/events/:slug", requireAdmin, async (req, res) => {
  await checkSlug(res, String(req.params.slug));
  const bundle = await getEventBundle(String(req.params.slug), true);
  if (!bundle) throw notFound("Celebración no encontrada.");
  res.json(bundle);
});

publicRouter.get(
  "/events/:slug/calendar.ics",
  requireAdmin,
  async (req, res) => {
    await checkSlug(res, String(req.params.slug));
    const { ics, filename } = await getEventIcs(String(req.params.slug));
    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Cache-Control", "no-store");
    res.send(ics);
  },
);

publicRouter.get(
  "/events/:slug/calendar/google",
  requireAdmin,
  async (req, res) => {
    await checkSlug(res, String(req.params.slug));
    res.json(await getEventCalendarLinks(String(req.params.slug)));
  },
);

publicRouter.get("/announcements", async (req, res) => {
  const query = parseQuery(announcementsQuerySchema, req.query);
  res.json(await listAnnouncements(query));
});

publicRouter.get("/families", requireAdmin, requireSuper, async (_req, res) => {
  res.json(await listFamilies());
});

publicRouter.get("/participants", requireAdmin, async (req, res) => {
  const query = parseQuery(participantsQuerySchema, req.query);
  const actor = identity(res);
  if (query.event_id) allowEvent(res, query.event_id);
  const rows = await listParticipants(query);
  res.json(
    actor.role === "superuser"
      ? rows
      : rows
          .map((row) => ({
            ...row,
            event_statuses: row.event_statuses.filter((event) =>
              actor.event_ids.includes(event.event_id),
            ),
          }))
          .filter((row) => row.event_statuses.length),
  );
});

publicRouter.post(
  "/registrations",
  registrationRateLimit,
  validateBody(registrationSchema),
  async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.status(201).json(await registerForEvent(req.body));
  },
);

publicRouter.post(
  "/registrations/batch",
  registrationRateLimit,
  validateBody(registrationBatchSchema),
  async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.status(201).json(await registerForEvents(req.body));
  },
);
