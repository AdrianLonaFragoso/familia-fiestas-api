import { Router } from "express";
import { requireAuthenticated, identity } from "../middleware/auth.js";
import { forbidden } from "../lib/http-error.js";
import {
  getProfile,
  updateProfile,
  updateProfileAttendance,
} from "../services/profile.service.js";
import {
  profileUpdateSchema,
  profileAttendanceSchema,
} from "../schemas/profile.js";
import { validateBody } from "../middleware/validate.js";
import { uuidSchema } from "../schemas/common.js";
export const profileRouter = Router();
profileRouter.use(requireAuthenticated);
profileRouter.use("/:guestId", (req, res, next) => {
  uuidSchema.parse(req.params.guestId);
  const user = identity(res);
  if (user.role !== "guest" || user.guest_id !== String(req.params.guestId))
    throw forbidden("Esta clave no corresponde a este perfil.");
  res.setHeader("Cache-Control", "no-store");
  next();
});
profileRouter.get("/:guestId", async (req, res) => {
  res.json(await getProfile(String(req.params.guestId)));
});
profileRouter.patch(
  "/:guestId",
  validateBody(profileUpdateSchema),
  async (req, res) => {
    res.json(await updateProfile(String(req.params.guestId), req.body));
  },
);
profileRouter.patch(
  "/:guestId/events/:eventId",
  validateBody(profileAttendanceSchema),
  async (req, res) => {
    uuidSchema.parse(req.params.eventId);
    res.json(
      await updateProfileAttendance(
        String(req.params.guestId),
        String(req.params.eventId),
        req.body,
      ),
    );
  },
);
