import { getPrisma } from "../db/prisma.js";
import { notFound } from "../lib/http-error.js";
import { mapResponsibility } from "../serializers/index.js";
import { parseDateOnly } from "../schemas/common.js";
import type {
  responsibilityCreateSchema,
  responsibilityUpdateSchema,
} from "../schemas/admin.js";
import type { z } from "zod";

type ResponsibilityCreateInput = z.infer<typeof responsibilityCreateSchema>;
type ResponsibilityUpdateInput = z.infer<typeof responsibilityUpdateSchema>;

export async function listResponsibilities(eventId: string) {
  const prisma = getPrisma();
  const rows = await prisma.responsibility.findMany({
    where: { eventId },
    orderBy: { createdAt: "asc" },
    include: { assignees: { select: { guestId: true } } },
  });
  return rows.map(mapResponsibility);
}

export async function createResponsibility(
  eventId: string,
  input: ResponsibilityCreateInput,
) {
  const prisma = getPrisma();
  const event = await prisma.event.findUnique({ where: { id: eventId }, select: { id: true } });
  if (!event) throw notFound("Celebración no encontrada.");

  const item = await prisma.responsibility.create({
    data: {
      eventId,
      title: input.title,
      description: input.description ?? null,
      category: input.category ?? "otros",
      quantity: input.quantity ?? null,
      dueDate: input.due_date ? parseDateOnly(input.due_date) : null,
      status: input.status ?? "sin_asignar",
      notes: input.notes ?? null,
    },
    include: { assignees: { select: { guestId: true } } },
  });
  return mapResponsibility(item);
}

export async function updateResponsibility(
  id: string,
  input: ResponsibilityUpdateInput,
) {
  const prisma = getPrisma();
  const current = await prisma.responsibility.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!current) throw notFound("Responsabilidad no encontrada.");

  const item = await prisma.responsibility.update({
    where: { id },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.category !== undefined ? { category: input.category } : {}),
      ...(input.quantity !== undefined ? { quantity: input.quantity } : {}),
      ...(input.due_date !== undefined
        ? { dueDate: input.due_date ? parseDateOnly(input.due_date) : null }
        : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
    },
    include: { assignees: { select: { guestId: true } } },
  });
  return mapResponsibility(item);
}

export async function deleteResponsibility(id: string): Promise<void> {
  const prisma = getPrisma();
  const current = await prisma.responsibility.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!current) throw notFound("Responsabilidad no encontrada.");
  await prisma.responsibility.delete({ where: { id } });
}

export async function setResponsibilityAssignees(id: string, guestIds: string[]) {
  const prisma = getPrisma();
  const current = await prisma.responsibility.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!current) throw notFound("Responsabilidad no encontrada.");

  await prisma.$transaction([
    prisma.responsibilityAssignee.deleteMany({ where: { responsibilityId: id } }),
    prisma.responsibilityAssignee.createMany({
      data: guestIds.map((guestId) => ({ responsibilityId: id, guestId })),
      skipDuplicates: true,
    }),
  ]);

  const item = await prisma.responsibility.findUniqueOrThrow({
    where: { id },
    include: { assignees: { select: { guestId: true } } },
  });
  return mapResponsibility(item);
}
