import type { NextFunction, Request, Response } from "express";
import type { ZodTypeAny, z } from "zod";

import { HttpError } from "../lib/http-error.js";

function validationError(error: z.ZodError): HttpError {
  return new HttpError(422, "validation_error", "Los datos enviados no son válidos.", {
    issues: error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    })),
  });
}

export function validateBody(schema: ZodTypeAny) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      next(validationError(parsed.error));
      return;
    }
    req.body = parsed.data;
    next();
  };
}

export function parseQuery<T extends ZodTypeAny>(schema: T, value: unknown): z.infer<T> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw validationError(parsed.error);
  return parsed.data;
}
