import { Router } from "express";

import { invitationRateLimit } from "../middleware/rate-limit.js";
import { validateBody } from "../middleware/validate.js";
import {
  invitationCalendarSchema,
  resolveInvitationSchema,
  setRsvpSchema,
} from "../schemas/invitation.js";
import { getInvitation, getInvitationIcs, setRsvp } from "../services/invitation.service.js";
import { notFound } from "../lib/http-error.js";

export const invitationRouter = Router();

invitationRouter.use(invitationRateLimit);

invitationRouter.post(
  "/resolve",
  validateBody(resolveInvitationSchema),
  async (req, res) => {
    const invitation = await getInvitation(req.body.token);
    if (!invitation) {
      throw notFound("Este enlace ya no es válido. Pide uno nuevo a los organizadores.");
    }
    res.setHeader("Cache-Control", "no-store");
    res.json(invitation);
  },
);

invitationRouter.patch("/rsvp", validateBody(setRsvpSchema), async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json(await setRsvp(req.body));
});

invitationRouter.post(
  "/calendar.ics",
  validateBody(invitationCalendarSchema),
  async (req, res) => {
    const { ics, filename } = await getInvitationIcs(req.body);
    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Cache-Control", "no-store");
    res.send(ics);
  },
);
