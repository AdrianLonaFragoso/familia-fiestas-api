import { createHash, timingSafeEqual } from "node:crypto";

import type { NextFunction, Request, Response } from "express";

import { getEnv } from "../config/env.js";
import { unauthorized } from "../lib/http-error.js";

function safeEqual(left: string, right: string): boolean {
  const leftHash = createHash("sha256").update(left).digest();
  const rightHash = createHash("sha256").update(right).digest();
  return timingSafeEqual(leftHash, rightHash);
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  const provided = req.header("x-admin-key");
  if (!provided || !safeEqual(provided, getEnv().ADMIN_API_KEY)) {
    next(unauthorized("Falta la clave de administrador o no es válida."));
    return;
  }
  next();
}
