import { Router } from "express";
import { revisionSchema, mailActionSchema } from "../schemas/exchange.js";
import { requireSuper, identity } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { uuidSchema } from "../schemas/common.js";
import {
  exchangeOverview,
  generateExchange,
  getExchange,
  startExchange,
  sendNextExchange,
  retryExchangeMail,
} from "../services/exchange.service.js";
export const exchangeRouter = Router();
exchangeRouter.use(requireSuper);
exchangeRouter.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});
exchangeRouter.get("/events/:eventId", async (req, res) => {
  res.json(await exchangeOverview(uuidSchema.parse(req.params.eventId)));
});
exchangeRouter.post(
  "/events/:eventId/draw",
  validateBody(revisionSchema),
  async (req, res) => {
    res
      .status(201)
      .json(
        await generateExchange(
          uuidSchema.parse(req.params.eventId),
          req.body.revision,
          identity(res).name,
        ),
      );
  },
);
exchangeRouter.get("/:id", async (req, res) => {
  res.json(await getExchange(uuidSchema.parse(req.params.id)));
});
exchangeRouter.post(
  "/:id/start",
  validateBody(revisionSchema),
  async (req, res) => {
    res.json(
      await startExchange(uuidSchema.parse(req.params.id), req.body.revision),
    );
  },
);
exchangeRouter.post("/:id/send-next", async (req, res) => {
  res.json(await sendNextExchange(uuidSchema.parse(req.params.id)));
});
exchangeRouter.post(
  "/:id/mail/:assignmentId",
  validateBody(mailActionSchema),
  async (req, res) => {
    res.json(
      await retryExchangeMail(
        uuidSchema.parse(req.params.id),
        uuidSchema.parse(req.params.assignmentId),
        req.body.action,
      ),
    );
  },
);
