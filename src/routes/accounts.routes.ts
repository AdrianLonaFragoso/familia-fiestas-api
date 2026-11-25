import { randomBytes } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { getPrisma } from "../db/prisma.js";
import { keyHash, requireSuper, identity } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { forbidden, notFound, unprocessable } from "../lib/http-error.js";
import {
  assertManageGuest,
  issueGuestAccess,
  guestDirectory,
  setGuestInvitation,
} from "../services/guest-access.service.js";
const assignment = z
  .array(z.string().uuid())
  .max(200)
  .refine((ids) => new Set(ids).size === ids.length);
const create = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(160).nullable().optional(),
  event_ids: assignment.default([]),
});
const patch = create.partial().extend({ is_active: z.boolean().optional() });
const include = {
  assignments: true,
  keys: {
    select: { id: true, prefix: true, createdAt: true, revokedAt: true },
  },
} as const;
function accountView(row: {
  id: string;
  role?: string;
  guestId?: string | null;
  name: string;
  email: string | null;
  isActive: boolean;
  createdAt: Date;
  assignments: { eventId: string }[];
  keys: {
    id: string;
    prefix: string;
    createdAt: Date;
    revokedAt: Date | null;
  }[];
}) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role ?? "host",
    guest_id: row.guestId ?? null,
    is_active: row.isActive,
    created_at: row.createdAt.toISOString(),
    event_ids: row.assignments.map((a) => a.eventId),
    keys: row.keys.map((k) => ({
      id: k.id,
      prefix: k.prefix,
      created_at: k.createdAt.toISOString(),
      revoked_at: k.revokedAt?.toISOString() ?? null,
    })),
  };
}
export const accountsRouter = Router();
accountsRouter.get("/directory", async (req, res) => {
  const search = z
    .string()
    .trim()
    .max(120)
    .parse(req.query["search"] ?? "");
  res.json(await guestDirectory(identity(res), search));
});
accountsRouter.post(
  "/guest-access",
  validateBody(
    z
      .object({
        guest_id: z.string().uuid(),
        replace: z.boolean().default(false),
      })
      .strict(),
  ),
  async (req, res) => {
    res
      .status(201)
      .json(
        await issueGuestAccess(
          identity(res),
          req.body.guest_id,
          req.body.replace,
        ),
      );
  },
);
accountsRouter.put(
  "/guest-invitations",
  validateBody(
    z
      .object({
        guest_id: z.string().uuid(),
        event_id: z.string().uuid(),
        invited: z.boolean(),
      })
      .strict(),
  ),
  async (req, res) => {
    res.json(
      await setGuestInvitation(
        identity(res),
        req.body.guest_id,
        req.body.event_id,
        req.body.invited,
      ),
    );
  },
);
async function assertAccount(res: import("express").Response, id: string) {
  const row = await getPrisma().accessAccount.findUnique({
    where: { id },
    select: { guestId: true, role: true },
  });
  if (!row) throw notFound("Cuenta no encontrada.");
  if (identity(res).role !== "superuser") {
    if (row.role !== "guest" || !row.guestId)
      throw forbidden("Solo puedes gestionar accesos de tus invitados.");
    await assertManageGuest(identity(res), row.guestId);
  }
  return row;
}
accountsRouter.get("/", async (_req, res) => {
  res.json(
    (
      await getPrisma().accessAccount.findMany({
        where:
          identity(res).role === "superuser"
            ? {}
            : {
                role: "guest",
                guest: {
                  eventGuests: {
                    some: { eventId: { in: identity(res).event_ids } },
                  },
                },
              },
        include,
        orderBy: { createdAt: "desc" },
      })
    ).map(accountView),
  );
});
accountsRouter.post(
  "/",
  requireSuper,
  validateBody(create),
  async (req, res) => {
    const input = create.parse(req.body);
    if (
      (await getPrisma().event.count({
        where: { id: { in: input.event_ids } },
      })) !== input.event_ids.length
    )
      throw unprocessable("Hay eventos que no existen.");
    const key = "ff_" + randomBytes(32).toString("base64url");
    const account = await getPrisma().accessAccount.create({
      data: {
        name: input.name,
        email: input.email ?? null,
        assignments: {
          create: input.event_ids.map((eventId) => ({ eventId })),
        },
        keys: { create: { digest: keyHash(key), prefix: key.slice(0, 11) } },
      },
      include,
    });
    res.status(201).json({ account: accountView(account), key });
  },
);
accountsRouter.patch("/:id", validateBody(patch), async (req, res) => {
  const current = await assertAccount(res, String(req.params.id));
  const input = patch.parse(req.body);
  if (
    current.role === "guest" &&
    Object.keys(input).some((key) => key !== "is_active")
  )
    throw forbidden(
      "Los datos del invitado se editan desde su perfil o el directorio.",
    );
  const id = String(req.params.id);
  const account = await getPrisma().$transaction(async (tx) => {
    if (!(await tx.accessAccount.findUnique({ where: { id } })))
      throw notFound("Cuenta no encontrada.");
    if (input.event_ids) {
      if (
        (await tx.event.count({ where: { id: { in: input.event_ids } } })) !==
        input.event_ids.length
      )
        throw unprocessable("Hay eventos que no existen.");
      await tx.accountEvent.deleteMany({ where: { accountId: id } });
    }
    return tx.accessAccount.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.email !== undefined ? { email: input.email } : {}),
        ...(input.is_active !== undefined ? { isActive: input.is_active } : {}),
        ...(input.event_ids
          ? {
              assignments: {
                create: input.event_ids.map((eventId) => ({ eventId })),
              },
            }
          : {}),
      },
      include,
    });
  });
  res.json(accountView(account));
});
accountsRouter.post("/:id/rotate-key", async (req, res) => {
  const id = String(req.params.id);
  await assertAccount(res, id);
  const key = "ff_" + randomBytes(32).toString("base64url");
  await getPrisma().$transaction(async (tx) => {
    if (!(await tx.accessAccount.findUnique({ where: { id } })))
      throw notFound("Cuenta no encontrada.");
    await tx.accessKey.updateMany({
      where: { accountId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await tx.accessKey.create({
      data: { accountId: id, digest: keyHash(key), prefix: key.slice(0, 11) },
    });
  });
  res.json({ key });
});
accountsRouter.post("/:id/revoke-key/:keyId", async (req, res) => {
  await assertAccount(res, String(req.params.id));
  const result = await getPrisma().accessKey.updateMany({
    where: { id: String(req.params.keyId), accountId: String(req.params.id) },
    data: { revokedAt: new Date() },
  });
  if (!result.count) throw notFound("Clave no encontrada.");
  res.json({ ok: true });
});
