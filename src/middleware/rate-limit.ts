import rateLimit from "express-rate-limit";

import { getEnv } from "../config/env.js";

export const invitationRateLimit = rateLimit({
  windowMs: getEnv().RATE_LIMIT_WINDOW_MS,
  limit: getEnv().RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => getEnv().NODE_ENV === "test",
  message: {
    error: {
      code: "rate_limit",
      message: "Demasiadas solicitudes. Espera un momento e intenta de nuevo.",
    },
  },
});

/** Las inscripciones son públicas: límite más estricto que el global. */
export const registrationRateLimit = rateLimit({
  windowMs: 10 * 60_000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => getEnv().NODE_ENV === "test",
  message: {
    error: {
      code: "rate_limited",
      message: "Recibimos muchas inscripciones desde tu conexión. Intenta de nuevo en unos minutos.",
    },
  },
});
