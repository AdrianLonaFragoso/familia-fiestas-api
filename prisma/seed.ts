import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client.js";

const connectionString = process.env["DATABASE_URL"];
if (!connectionString) {
  throw new Error("Falta DATABASE_URL. Copia .env.example a .env y pega la cadena de Neon.");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const FAMILIES: readonly (readonly [string, number, boolean])[] = [
  ["Cano Pérez", 1, false],
  ["Lona Vega", 2, false],
  ["Lona Fragoso", 3, false],
  ["Otros", 4, false],
  ["Por clasificar", 99, true],
];

const GUESTS = [
  "Adrian Lona",
  "Jimena Vega",
  "Any Sophie Lona Vega",
  "Paty Cano",
  "Inés Cano",
  "Susy Fragoso",
  "Jorge Lona",
  "Blange Lona",
  "Tabatha Lona",
  "Markesh Lona",
  "Montse Cuyo",
  "Felipe Cano",
  "Mayis P. Davila",
  "Nidia Cano",
  "Gerardo Cazasola",
  "Marlene Cano",
  "Carlo Berdejo",
  "Damián Berdejo",
  "Dafne Estrella",
  "Patricio Estrella",
] as const;

const EVENTS: readonly (readonly [string, string, string])[] = [
  ["navidad", "Cena de Navidad", "2026-12-24"],
  ["ano-nuevo", "Cena de Año Nuevo", "2026-12-31"],
];

async function main() {
  for (const [name, sortOrder, isUnassigned] of FAMILIES) {
    await prisma.family.upsert({
      where: { name },
      update: { sortOrder, isUnassigned },
      create: { name, sortOrder, isUnassigned },
    });
  }

  const unassigned = await prisma.family.findUniqueOrThrow({
    where: { name: "Por clasificar" },
  });

  for (const fullName of GUESTS) {
    const existing = await prisma.guest.findFirst({ where: { fullName } });
    if (!existing) {
      await prisma.guest.create({ data: { fullName, familyId: unassigned.id } });
    }
  }

  for (const [slug, name, eventDate] of EVENTS) {
    const date = new Date(`${eventDate}T00:00:00.000Z`);
    await prisma.event.upsert({
      where: { slug },
      update: { name, eventDate: date },
      create: { slug, name, eventDate: date, giftExchangeEnabled: slug === "navidad" },
    });
  }

  const [events, guests] = await Promise.all([
    prisma.event.findMany({ select: { id: true } }),
    prisma.guest.findMany({ select: { id: true } }),
  ]);

  await prisma.eventGuest.createMany({
    data: events.flatMap((e) => guests.map((g) => ({ eventId: e.id, guestId: g.id }))),
    skipDuplicates: true,
  });

  console.log(
    `Seed listo: ${FAMILIES.length} familias, ${guests.length} invitados, ${events.length} celebraciones.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
