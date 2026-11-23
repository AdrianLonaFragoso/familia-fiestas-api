import { randomBytes } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { getPrisma } from "../db/prisma.js";
import { keyHash, requireSuper } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { notFound, unprocessable } from "../lib/http-error.js";
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
    role: "host",
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
accountsRouter.use(requireSuper);
accountsRouter.get("/", async (_req, res) => {
  res.json(
    (
      await getPrisma().accessAccount.findMany({
        include,
        orderBy: { createdAt: "desc" },
      })
    ).map(accountView),
  );
});
accountsRouter.post("/", validateBody(create), async (req, res) => {
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
      assignments: { create: input.event_ids.map((eventId) => ({ eventId })) },
      keys: { create: { digest: keyHash(key), prefix: key.slice(0, 11) } },
    },
    include,
  });
  res.status(201).json({ account: accountView(account), key });
});
accountsRouter.patch("/:id", validateBody(patch), async (req, res) => {
  const input = patch.parse(req.body);
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
  const result = await getPrisma().accessKey.updateMany({
    where: { id: String(req.params.keyId), accountId: String(req.params.id) },
    data: { revokedAt: new Date() },
  });
  if (!result.count) throw notFound("Clave no encontrada.");
  res.json({ ok: true });
});
