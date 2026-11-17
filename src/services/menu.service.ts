import { getPrisma } from "../db/prisma.js";
import { notFound } from "../lib/http-error.js";
import { mapMenu } from "../serializers/index.js";
import type { menuItemCreateSchema, menuItemUpdateSchema } from "../schemas/admin.js";
import type { z } from "zod";

type MenuCreateInput = z.infer<typeof menuItemCreateSchema>;
type MenuUpdateInput = z.infer<typeof menuItemUpdateSchema>;

export async function listMenuItems(eventId: string) {
  const prisma = getPrisma();
  const rows = await prisma.menuItem.findMany({
    where: { eventId },
    orderBy: { createdAt: "asc" },
    include: { assignees: { select: { guestId: true } } },
  });
  return rows.map(mapMenu);
}

export async function createMenuItem(eventId: string, input: MenuCreateInput) {
  const prisma = getPrisma();
  const event = await prisma.event.findUnique({ where: { id: eventId }, select: { id: true } });
  if (!event) throw notFound("Celebración no encontrada.");

  const item = await prisma.menuItem.create({
    data: {
      eventId,
      name: input.name,
      category: input.category ?? "otros",
      description: input.description ?? null,
      quantity: input.quantity ?? null,
      unit: input.unit ?? null,
      status: input.status ?? "por_asignar",
      notes: input.notes ?? null,
    },
    include: { assignees: { select: { guestId: true } } },
  });
  return mapMenu(item);
}

export async function updateMenuItem(id: string, input: MenuUpdateInput) {
  const prisma = getPrisma();
  const current = await prisma.menuItem.findUnique({ where: { id }, select: { id: true } });
  if (!current) throw notFound("Platillo no encontrado.");

  const item = await prisma.menuItem.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.category !== undefined ? { category: input.category } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.quantity !== undefined ? { quantity: input.quantity } : {}),
      ...(input.unit !== undefined ? { unit: input.unit } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
    },
    include: { assignees: { select: { guestId: true } } },
  });
  return mapMenu(item);
}

export async function deleteMenuItem(id: string): Promise<void> {
  const prisma = getPrisma();
  const current = await prisma.menuItem.findUnique({ where: { id }, select: { id: true } });
  if (!current) throw notFound("Platillo no encontrado.");
  await prisma.menuItem.delete({ where: { id } });
}

export async function setMenuAssignees(id: string, guestIds: string[]) {
  const prisma = getPrisma();
  const current = await prisma.menuItem.findUnique({ where: { id }, select: { id: true } });
  if (!current) throw notFound("Platillo no encontrado.");

  await prisma.$transaction([
    prisma.menuItemAssignee.deleteMany({ where: { menuItemId: id } }),
    prisma.menuItemAssignee.createMany({
      data: guestIds.map((guestId) => ({ menuItemId: id, guestId })),
      skipDuplicates: true,
    }),
  ]);

  const item = await prisma.menuItem.findUniqueOrThrow({
    where: { id },
    include: { assignees: { select: { guestId: true } } },
  });
  return mapMenu(item);
}
