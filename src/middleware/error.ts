import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

import { HttpError } from "../lib/http-error.js";
import { logger } from "../lib/logger.js";

type PrismaLikeError = {
  code?: string;
  meta?: unknown;
  message?: string;
};

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: {
      code: "not_found",
      message: `No existe la ruta ${req.method} ${req.originalUrl}.`,
    },
  });
}

export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (error instanceof HttpError) {
    res.status(error.status).json({
      error: {
        code: error.code,
        message: error.message,
        ...(error.details !== undefined ? { details: error.details } : {}),
      },
    });
    return;
  }

  if (error instanceof ZodError) {
    res.status(422).json({
      error: {
        code: "validation_error",
        message: "Los datos enviados no son válidos.",
        details: {
          issues: error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
      },
    });
    return;
  }

  // Reconoce el error de los triggers incluso dentro del adaptador de Prisma; nunca devuelve SQL ni datos privados.
  function exchangeLocked(
    value: unknown,
    depth = 0,
    seen = new Set<unknown>(),
  ): boolean {
    if (depth > 8 || !value || seen.has(value)) return false;
    if (typeof value === "string")
      return value.includes("EXCHANGE_DRAW_LOCKED");
    if (typeof value !== "object") return false;
    seen.add(value);
    return Object.getOwnPropertyNames(value).some((key) =>
      exchangeLocked((value as Record<string, unknown>)[key], depth + 1, seen),
    );
  }
  if (exchangeLocked(error)) {
    res
      .status(409)
      .json({
        error: {
          code: "exchange_locked",
          message:
            "El intercambio ya se publicó. No se puede cambiar a sus participantes, desactivarlo ni borrar el evento o sus participantes.",
        },
      });
    return;
  }

  const prismaError = error as PrismaLikeError;
  if (prismaError?.code === "P2002") {
    res.status(409).json({
      error: {
        code: "conflict",
        message: "Ya existe un registro con esos datos.",
        details: prismaError.meta,
      },
    });
    return;
  }
  if (prismaError?.code === "P2025") {
    res.status(404).json({
      error: {
        code: "not_found",
        message: "El registro solicitado no existe.",
      },
    });
    return;
  }

  logger.error(
    { err: error, method: req.method, url: req.originalUrl },
    "Error no controlado",
  );
  res.status(500).json({
    error: {
      code: "internal_error",
      message: "Ocurrió un error interno. Intenta de nuevo más tarde.",
    },
  });
}
