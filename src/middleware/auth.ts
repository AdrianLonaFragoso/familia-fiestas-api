import { createHash, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { getEnv } from "../config/env.js";
import { getPrisma } from "../db/prisma.js";
import { forbidden, unauthorized } from "../lib/http-error.js";

export type AccessIdentity = {
  id: string;
  name: string;
  role: "superuser" | "host";
  event_ids: string[];
};
export function identity(res: Response): AccessIdentity {
  return res.locals["identity"] as AccessIdentity;
}
export const keyHash = (key: string) =>
  createHash("sha256").update(key).digest("hex");
export async function optionalAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const provided = req.header("x-admin-key");
  if (!provided) {
    next();
    return;
  }
  res.setHeader("Cache-Control", "no-store");
  if (provided.length > 512) throw unauthorized("La clave no es válida.");
  if (
    timingSafeEqual(
      Buffer.from(keyHash(provided), "hex"),
      Buffer.from(keyHash(getEnv().ADMIN_API_KEY), "hex"),
    )
  ) {
    res.locals["identity"] = {
      id: "root",
      name: "Superusuario",
      role: "superuser",
      event_ids: [],
    } satisfies AccessIdentity;
  } else {
    if (!/^ff_[A-Za-z0-9_-]{43}$/.test(provided))
      throw unauthorized("La clave no es válida.");
    const key = await getPrisma().accessKey.findUnique({
      where: { digest: keyHash(provided) },
      include: { account: { include: { assignments: true } } },
    });
    if (!key || key.revokedAt || !key.account.isActive)
      throw unauthorized("La clave no es válida o fue desactivada.");
    res.locals["identity"] = {
      id: key.account.id,
      name: key.account.name,
      role: "host",
      event_ids: key.account.assignments.map((a) => a.eventId),
    } satisfies AccessIdentity;
  }
  next();
}
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  res.setHeader("Cache-Control", "no-store");
  if (identity(res)) {
    next();
    return;
  }
  if (!req.header("x-admin-key")) {
    next(unauthorized("Ingresa con tu clave de acceso."));
    return;
  }
  // También funciona al montar este middleware de forma independiente.
  return optionalAdmin(req, res, next);
}
export function requireSuper(_req: Request, res: Response, next: NextFunction) {
  if (identity(res)?.role !== "superuser")
    throw forbidden("Esta acción es exclusiva del superusuario.");
  next();
}
export function allowEvent(res: Response, id: string) {
  const user = identity(res);
  if (!user || (user.role !== "superuser" && !user.event_ids.includes(id)))
    throw forbidden("No tienes acceso a este evento.");
}
