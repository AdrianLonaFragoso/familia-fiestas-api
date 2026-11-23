import { Router } from "express";
import { ANN_CATEGORIES, ANN_PRIORITY, RSVP_LABEL } from "../lib/labels.js";
import { z } from "zod";

import { parseQuery, validateBody } from "../middleware/validate.js";
import { requireAdmin } from "../middleware/auth.js";
import {
  activityCreateSchema,
  activityUpdateSchema,
  announcementCreateSchema,
  announcementUpdateSchema,
  assigneesSchema,
  eventCreateSchema,
  eventGuestUpdateSchema,
  eventUpdateSchema,
  familyCreateSchema,
  familyUpdateSchema,
  guestCreateSchema,
  guestPrivateSchema,
  guestUpdateSchema,
  hostCreateSchema,
  hostUpdateSchema,
  invitationTokenCreateSchema,
  menuItemCreateSchema,
  menuItemUpdateSchema,
  responsibilityCreateSchema,
  responsibilityUpdateSchema,
  venueCreateSchema,
  venueUpdateSchema,
} from "../schemas/admin.js";
import { announcementsQuerySchema, participantsQuerySchema } from "../schemas/public.js";
import { registrationsQuerySchema } from "../schemas/registration.js";
import { uuidSchema } from "../schemas/common.js";
import {
  createActivity,
  deleteActivity,
  listActivities,
  updateActivity,
} from "../services/activity.service.js";
import {
  createAnnouncement,
  deleteAnnouncement,
  listAllAnnouncements,
  updateAnnouncement,
} from "../services/announcement-admin.service.js";
import {
  createEvent,
  setEventGuests,
  deleteEvent,
  listEvents,
  updateEvent,
} from "../services/event.service.js";
import {
  createFamily,
  deleteFamily,
  listFamilies,
  updateFamily,
} from "../services/family.service.js";
import {
  createGuest,
  deleteGuest,
  getGuest,
  listEventGuests,
  listGuests,
  updateEventGuest,
  updateGuest,
  upsertGuestPrivate,
} from "../services/guest.service.js";
import {
  createHost,
  deleteHost,
  listHosts,
  updateHost,
} from "../services/host.service.js";
import {
  createMenuItem,
  deleteMenuItem,
  listMenuItems,
  setMenuAssignees,
  updateMenuItem,
} from "../services/menu.service.js";
import {
  createResponsibility,
  deleteResponsibility,
  listResponsibilities,
  setResponsibilityAssignees,
  updateResponsibility,
} from "../services/responsibility.service.js";
import { getStats } from "../services/stats.service.js";
import { listRegistrations } from "../services/registration.service.js";
import {
  createInvitationToken,
  listInvitationTokens,
  revokeInvitationToken,
} from "../services/token.service.js";
import {
  createVenue,
  deleteVenue,
  listVenues,
  updateVenue,
} from "../services/venue.service.js";

const eventGuestsQuerySchema = z.object({
  event_id: uuidSchema.optional(),
});

const tokensQuerySchema = z.object({
  guest_id: uuidSchema.optional(),
});

export const adminRouter = Router();

adminRouter.use(requireAdmin);

adminRouter.get("/options", (_req, res) => {
  res.json({
    announcement_categories: ANN_CATEGORIES.map(([value, label]) => ({ value, label })),
    announcement_priorities: ANN_PRIORITY.map(([value, label]) => ({ value, label })),
    rsvp_statuses: Object.entries(RSVP_LABEL).map(([value, label]) => ({ value, label })),
  });
});

// Celebración
adminRouter.get("/events", async (_req, res) => {
  res.json(await listEvents(true));
});
adminRouter.post("/events", validateBody(eventCreateSchema), async (req, res) => {
  res.status(201).json(await createEvent(req.body));
});
adminRouter.patch("/events/:id", validateBody(eventUpdateSchema), async (req, res) => {
  res.json(await updateEvent(String(req.params.id), req.body));
});
adminRouter.delete("/events/:id", async (req, res) => {
  await deleteEvent(String(req.params.id));
  res.status(204).send();
});

adminRouter.put("/events/:id/guests", validateBody(assigneesSchema), async (req, res) => {
  res.json(await setEventGuests(String(req.params.id), req.body.guest_ids));
});

// Sedes
adminRouter.get("/venues", async (_req, res) => {
  res.json(await listVenues());
});
adminRouter.post("/venues", validateBody(venueCreateSchema), async (req, res) => {
  res.status(201).json(await createVenue(req.body));
});
adminRouter.patch("/venues/:id", validateBody(venueUpdateSchema), async (req, res) => {
  res.json(await updateVenue(String(req.params.id), req.body));
});
adminRouter.delete("/venues/:id", async (req, res) => {
  await deleteVenue(String(req.params.id));
  res.status(204).send();
});

// Familias
adminRouter.get("/families", async (_req, res) => {
  res.json(await listFamilies());
});
adminRouter.post("/families", validateBody(familyCreateSchema), async (req, res) => {
  res.status(201).json(await createFamily(req.body));
});
adminRouter.patch("/families/:id", validateBody(familyUpdateSchema), async (req, res) => {
  res.json(await updateFamily(String(req.params.id), req.body));
});
adminRouter.delete("/families/:id", async (req, res) => {
  await deleteFamily(String(req.params.id));
  res.status(204).send();
});

// Invitados
adminRouter.get("/guests", async (req, res) => {
  const query = parseQuery(participantsQuerySchema, req.query);
  res.json(await listGuests(query));
});
adminRouter.get("/guests/:id", async (req, res) => {
  res.json(await getGuest(String(req.params.id)));
});
adminRouter.post("/guests", validateBody(guestCreateSchema), async (req, res) => {
  res.status(201).json(await createGuest(req.body));
});
adminRouter.patch("/guests/:id", validateBody(guestUpdateSchema), async (req, res) => {
  res.json(await updateGuest(String(req.params.id), req.body));
});
adminRouter.delete("/guests/:id", async (req, res) => {
  await deleteGuest(String(req.params.id));
  res.status(204).send();
});
adminRouter.put(
  "/guests/:id/private",
  validateBody(guestPrivateSchema),
  async (req, res) => {
    res.json(await upsertGuestPrivate(String(req.params.id), req.body));
  },
);

// Asistencia por celebración
adminRouter.get("/event-guests", async (req, res) => {
  const query = parseQuery(eventGuestsQuerySchema, req.query);
  res.json(await listEventGuests(query));
});
adminRouter.patch(
  "/event-guests/:id",
  validateBody(eventGuestUpdateSchema),
  async (req, res) => {
    res.json(await updateEventGuest(String(req.params.id), req.body));
  },
);

// Inscripciones públicas
adminRouter.get("/registrations", async (req, res) => {
  const query = parseQuery(registrationsQuerySchema, req.query);
  res.json(await listRegistrations(query));
});

// Anfitriones
adminRouter.get("/events/:eventId/hosts", async (req, res) => {
  res.json(await listHosts(String(req.params.eventId)));
});
adminRouter.post(
  "/events/:eventId/hosts",
  validateBody(hostCreateSchema),
  async (req, res) => {
    res.status(201).json(await createHost(String(req.params.eventId), req.body));
  },
);
adminRouter.patch("/hosts/:id", validateBody(hostUpdateSchema), async (req, res) => {
  res.json(await updateHost(String(req.params.id), req.body));
});
adminRouter.delete("/hosts/:id", async (req, res) => {
  await deleteHost(String(req.params.id));
  res.status(204).send();
});

// Menú
adminRouter.get("/events/:eventId/menu-items", async (req, res) => {
  res.json(await listMenuItems(String(req.params.eventId)));
});
adminRouter.post(
  "/events/:eventId/menu-items",
  validateBody(menuItemCreateSchema),
  async (req, res) => {
    res.status(201).json(await createMenuItem(String(req.params.eventId), req.body));
  },
);
adminRouter.patch(
  "/menu-items/:id",
  validateBody(menuItemUpdateSchema),
  async (req, res) => {
    res.json(await updateMenuItem(String(req.params.id), req.body));
  },
);
adminRouter.delete("/menu-items/:id", async (req, res) => {
  await deleteMenuItem(String(req.params.id));
  res.status(204).send();
});
adminRouter.patch(
  "/menu-items/:id/assignees",
  validateBody(assigneesSchema),
  async (req, res) => {
    res.json(await setMenuAssignees(String(req.params.id), req.body.guest_ids));
  },
);

// Responsabilidades
adminRouter.get("/events/:eventId/responsibilities", async (req, res) => {
  res.json(await listResponsibilities(String(req.params.eventId)));
});
adminRouter.post(
  "/events/:eventId/responsibilities",
  validateBody(responsibilityCreateSchema),
  async (req, res) => {
    res
      .status(201)
      .json(await createResponsibility(String(req.params.eventId), req.body));
  },
);
adminRouter.patch(
  "/responsibilities/:id",
  validateBody(responsibilityUpdateSchema),
  async (req, res) => {
    res.json(await updateResponsibility(String(req.params.id), req.body));
  },
);
adminRouter.delete("/responsibilities/:id", async (req, res) => {
  await deleteResponsibility(String(req.params.id));
  res.status(204).send();
});
adminRouter.patch(
  "/responsibilities/:id/assignees",
  validateBody(assigneesSchema),
  async (req, res) => {
    res.json(
      await setResponsibilityAssignees(String(req.params.id), req.body.guest_ids),
    );
  },
);

// Actividades
adminRouter.get("/events/:eventId/activities", async (req, res) => {
  res.json(await listActivities(String(req.params.eventId)));
});
adminRouter.post(
  "/events/:eventId/activities",
  validateBody(activityCreateSchema),
  async (req, res) => {
    res.status(201).json(await createActivity(String(req.params.eventId), req.body));
  },
);
adminRouter.patch(
  "/activities/:id",
  validateBody(activityUpdateSchema),
  async (req, res) => {
    res.json(await updateActivity(String(req.params.id), req.body));
  },
);
adminRouter.delete("/activities/:id", async (req, res) => {
  await deleteActivity(String(req.params.id));
  res.status(204).send();
});

// Avisos
adminRouter.get("/announcements", async (req, res) => {
  const query = parseQuery(announcementsQuerySchema, req.query);
  res.json(await listAllAnnouncements(query));
});
adminRouter.post(
  "/announcements",
  validateBody(announcementCreateSchema),
  async (req, res) => {
    res.status(201).json(await createAnnouncement(req.body));
  },
);
adminRouter.patch(
  "/announcements/:id",
  validateBody(announcementUpdateSchema),
  async (req, res) => {
    res.json(await updateAnnouncement(String(req.params.id), req.body));
  },
);
adminRouter.delete("/announcements/:id", async (req, res) => {
  await deleteAnnouncement(String(req.params.id));
  res.status(204).send();
});

// Tokens de invitación
adminRouter.get("/invitation-tokens", async (req, res) => {
  const query = parseQuery(tokensQuerySchema, req.query);
  res.json(await listInvitationTokens(query));
});
adminRouter.post(
  "/invitation-tokens",
  validateBody(invitationTokenCreateSchema),
  async (req, res) => {
    res.status(201).json(await createInvitationToken(req.body.guest_id));
  },
);
adminRouter.post("/invitation-tokens/:id/revoke", async (req, res) => {
  res.json(await revokeInvitationToken(String(req.params.id)));
});

// Métricas
adminRouter.get("/stats", async (_req, res) => {
  res.json(await getStats());
});
