import { getPrisma } from "../db/prisma.js";
import { notFound } from "../lib/http-error.js";
import { mapActivity } from "../serializers/index.js";
import { optionalTime, timeOrNull } from "../schemas/common.js";
import type { activityCreateSchema, activityUpdateSchema } from "../schemas/admin.js";
import type { z } from "zod";

type ActivityCreateInput = z.infer<typeof activityCreateSchema>;
type ActivityUpdateInput = z.infer<typeof activityUpdateSchema>;

export async function listActivities(eventId: string) {
  const prisma = getPrisma();
  const rows = await prisma.activity.findMany({
    where: { eventId },
    orderBy: [{ sortOrder: "asc" }, { startTime: "asc" }],
  });
  return rows.map(mapActivity);
}

export async function createActivity(eventId: string, input: ActivityCreateInput) {
  const prisma = getPrisma();
  const event = await prisma.event.findUnique({ where: { id: eventId }, select: { id: true } });
  if (!event) throw notFound("Celebración no encontrada.");

  const activity = await prisma.activity.create({
    data: {
      eventId,
      name: input.name,
      description: input.description ?? null,
      startTime: optionalTime(input.start_time) ?? null,
      endTime: optionalTime(input.end_time) ?? null,
      responsible: input.responsible ?? null,
      instructions: input.instructions ?? null,
      sortOrder: input.sort_order ?? 0,
    },
  });
  return mapActivity(activity);
}

export async function updateActivity(id: string, input: ActivityUpdateInput) {
  const prisma = getPrisma();
  const current = await prisma.activity.findUnique({ where: { id }, select: { id: true } });
  if (!current) throw notFound("Actividad no encontrada.");

  const activity = await prisma.activity.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.start_time !== undefined
        ? { startTime: timeOrNull(input.start_time) }
        : {}),
      ...(input.end_time !== undefined ? { endTime: timeOrNull(input.end_time) } : {}),
      ...(input.responsible !== undefined ? { responsible: input.responsible } : {}),
      ...(input.instructions !== undefined ? { instructions: input.instructions } : {}),
      ...(input.sort_order !== undefined ? { sortOrder: input.sort_order } : {}),
    },
  });
  return mapActivity(activity);
}

export async function deleteActivity(id: string): Promise<void> {
  const prisma = getPrisma();
  const current = await prisma.activity.findUnique({ where: { id }, select: { id: true } });
  if (!current) throw notFound("Actividad no encontrada.");
  await prisma.activity.delete({ where: { id } });
}
