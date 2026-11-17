import { randomBytes } from "node:crypto";

import { getPrisma } from "../db/prisma.js";
import { notFound } from "../lib/http-error.js";

export function generateInvitationToken(): string {
  return randomBytes(32).toString("hex");
}

export async function createInvitationToken(guestId: string) {
  const prisma = getPrisma();
  const guest = await prisma.guest.findUnique({
    where: { id: guestId },
    select: { id: true, fullName: true },
  });
  if (!guest) throw notFound("Invitado no encontrado.");

  const token = await prisma.invitationToken.create({
    data: { guestId, token: generateInvitationToken() },
  });

  return {
    id: token.id,
    guest_id: token.guestId,
    guest_name: guest.fullName,
    token: token.token,
    created_at: token.createdAt.toISOString(),
    revoked_at: token.revokedAt?.toISOString() ?? null,
  };
}

export async function listInvitationTokens(filters: { guest_id?: string | undefined }) {
  const prisma = getPrisma();
  const rows = await prisma.invitationToken.findMany({
    where: filters.guest_id ? { guestId: filters.guest_id } : {},
    include: { guest: { select: { fullName: true } } },
    orderBy: { createdAt: "desc" },
  });

  return rows.map((row) => ({
    id: row.id,
    guest_id: row.guestId,
    guest_name: row.guest.fullName,
    token: row.token,
    active: row.revokedAt == null,
    created_at: row.createdAt.toISOString(),
    revoked_at: row.revokedAt?.toISOString() ?? null,
  }));
}

export async function revokeInvitationToken(id: string) {
  const prisma = getPrisma();
  const current = await prisma.invitationToken.findUnique({
    where: { id },
    select: { id: true, guestId: true, token: true, createdAt: true, revokedAt: true },
  });
  if (!current) throw notFound("Token de invitación no encontrado.");

  const row = await prisma.invitationToken.update({
    where: { id },
    data: { revokedAt: current.revokedAt ?? new Date() },
  });

  return {
    id: row.id,
    guest_id: row.guestId,
    token: row.token,
    created_at: row.createdAt.toISOString(),
    revoked_at: row.revokedAt?.toISOString() ?? null,
  };
}
