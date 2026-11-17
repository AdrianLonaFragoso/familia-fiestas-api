import { createApp } from "./app.js";
import { getEnv } from "./config/env.js";
import { disconnectPrisma } from "./db/prisma.js";
import { logger } from "./lib/logger.js";

const env = getEnv();
const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(
    { port: env.PORT, env: env.NODE_ENV },
    `Familia Fiestas API escuchando en http://localhost:${env.PORT}`,
  );
});

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, "Cerrando servidor");
  server.close(async () => {
    await disconnectPrisma();
    process.exit(0);
  });
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
