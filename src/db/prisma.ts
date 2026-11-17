import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../generated/prisma/client.js";

let client: PrismaClient | undefined;

export function getPrisma(): PrismaClient {
  if (client) return client;

  const connectionString = process.env["DATABASE_URL"];
  if (!connectionString) {
    throw new Error(
      "Falta la variable de entorno DATABASE_URL. Copia .env.example a .env y pega la cadena de conexión de Neon.",
    );
  }

  client = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  return client;
}

export function setPrismaForTests(value: PrismaClient | undefined): void {
  client = value;
}

export async function disconnectPrisma(): Promise<void> {
  if (!client) return;
  await client.$disconnect();
  client = undefined;
}
