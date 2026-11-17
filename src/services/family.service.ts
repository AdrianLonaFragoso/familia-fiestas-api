import { getPrisma } from "../db/prisma.js";
import { notFound } from "../lib/http-error.js";
import { mapFamily } from "../serializers/index.js";
import type { Family } from "../types.js";
import type { familyCreateSchema, familyUpdateSchema } from "../schemas/admin.js";
import type { z } from "zod";

type FamilyCreateInput = z.infer<typeof familyCreateSchema>;
type FamilyUpdateInput = z.infer<typeof familyUpdateSchema>;

export async function listFamilies(): Promise<Family[]> {
  const prisma = getPrisma();
  const rows = await prisma.family.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { guests: true } } },
  });
  return rows.map(mapFamily);
}

export async function createFamily(input: FamilyCreateInput) {
  const prisma = getPrisma();
  const family = await prisma.family.create({
    data: {
      name: input.name,
      sortOrder: input.sort_order ?? 0,
      isUnassigned: input.is_unassigned ?? false,
    },
    include: { _count: { select: { guests: true } } },
  });
  return mapFamily(family);
}

export async function updateFamily(id: string, input: FamilyUpdateInput) {
  const prisma = getPrisma();
  const current = await prisma.family.findUnique({ where: { id }, select: { id: true } });
  if (!current) throw notFound("Familia no encontrada.");

  const family = await prisma.family.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.sort_order !== undefined ? { sortOrder: input.sort_order } : {}),
      ...(input.is_unassigned !== undefined
        ? { isUnassigned: input.is_unassigned }
        : {}),
    },
    include: { _count: { select: { guests: true } } },
  });
  return mapFamily(family);
}

export async function deleteFamily(id: string): Promise<void> {
  const prisma = getPrisma();
  const current = await prisma.family.findUnique({ where: { id }, select: { id: true } });
  if (!current) throw notFound("Familia no encontrada.");
  await prisma.family.delete({ where: { id } });
}
