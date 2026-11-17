import { Router } from "express";

import { notFound } from "../lib/http-error.js";
import { registrationRateLimit } from "../middleware/rate-limit.js";
import { parseQuery, validateBody } from "../middleware/validate.js";
import {
  announcementsQuerySchema,
  participantsQuerySchema,
} from "../schemas/public.js";
import { registrationSchema } from "../schemas/registration.js";
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
import { registerForEvent } from "../services/registration.service.js";

export const publicRouter = Router();

publicRouter.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

publicRouter.get("/home", async (_req, res) => {
  res.json(await getHome());
});

publicRouter.get("/events", async (_req, res) => {
  res.json(await listEvents());
});

publicRouter.get("/events/:slug", async (req, res) => {
  const bundle = await getEventBundle(String(req.params.slug));
  if (!bundle) throw notFound("Celebración no encontrada.");
  res.json(bundle);
});

publicRouter.get("/events/:slug/calendar.ics", async (req, res) => {
  const { ics, filename } = await getEventIcs(String(req.params.slug));
  res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Cache-Control", "no-store");
  res.send(ics);
});

publicRouter.get("/events/:slug/calendar/google", async (req, res) => {
  res.json(await getEventCalendarLinks(String(req.params.slug)));
});

publicRouter.get("/announcements", async (req, res) => {
  const query = parseQuery(announcementsQuerySchema, req.query);
  res.json(await listAnnouncements(query));
});

publicRouter.get("/families", async (_req, res) => {
  res.json(await listFamilies());
});

publicRouter.get("/participants", async (req, res) => {
  const query = parseQuery(participantsQuerySchema, req.query);
  res.json(await listParticipants(query));
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
