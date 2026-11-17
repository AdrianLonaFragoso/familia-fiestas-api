import { getPrisma } from "../db/prisma.js";
import { notFound } from "../lib/http-error.js";
import { mapVenue } from "../serializers/index.js";
import type { venueCreateSchema, venueUpdateSchema } from "../schemas/admin.js";
import type { z } from "zod";

type VenueCreateInput = z.infer<typeof venueCreateSchema>;
type VenueUpdateInput = z.infer<typeof venueUpdateSchema>;

export async function listVenues() {
  const prisma = getPrisma();
  const rows = await prisma.venue.findMany({ orderBy: { updatedAt: "desc" } });
  return rows.map(mapVenue);
}

export async function createVenue(input: VenueCreateInput) {
  const prisma = getPrisma();
  const venue = await prisma.venue.create({
    data: {
      name: input.name ?? null,
      address: input.address ?? null,
      referencesText: input.references_text ?? null,
      accessNotes: input.access_notes ?? null,
      parking: input.parking ?? null,
      photoPath: input.photo_path ?? null,
      observations: input.observations ?? null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
    },
  });
  return mapVenue(venue);
}

export async function updateVenue(id: string, input: VenueUpdateInput) {
  const prisma = getPrisma();
  const current = await prisma.venue.findUnique({ where: { id }, select: { id: true } });
  if (!current) throw notFound("Sede no encontrada.");

  const venue = await prisma.venue.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.address !== undefined ? { address: input.address } : {}),
      ...(input.references_text !== undefined
        ? { referencesText: input.references_text }
        : {}),
      ...(input.access_notes !== undefined ? { accessNotes: input.access_notes } : {}),
      ...(input.parking !== undefined ? { parking: input.parking } : {}),
      ...(input.photo_path !== undefined ? { photoPath: input.photo_path } : {}),
      ...(input.observations !== undefined ? { observations: input.observations } : {}),
      ...(input.latitude !== undefined ? { latitude: input.latitude } : {}),
      ...(input.longitude !== undefined ? { longitude: input.longitude } : {}),
    },
  });
  return mapVenue(venue);
}

export async function deleteVenue(id: string): Promise<void> {
  const prisma = getPrisma();
  const current = await prisma.venue.findUnique({ where: { id }, select: { id: true } });
  if (!current) throw notFound("Sede no encontrada.");
  await prisma.venue.delete({ where: { id } });
}
