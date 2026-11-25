import { randomBytes } from "node:crypto";
import { getPrisma } from "../db/prisma.js";
import { keyHash, type AccessIdentity } from "../middleware/auth.js";
import { forbidden, notFound } from "../lib/http-error.js";
export async function assertManageGuest(
  actor: AccessIdentity,
  guestId: string,
) {
  if (actor.role === "guest") throw forbidden();
  const guest = await getPrisma().guest.findUnique({
    where: { id: guestId },
    select: {
      id: true,
      fullName: true,
      email: true,
      eventGuests: { select: { eventId: true } },
    },
  });
  if (!guest) throw notFound("Invitado no encontrado.");
  if (
    actor.role !== "superuser" &&
    !guest.eventGuests.some((e) => actor.event_ids.includes(e.eventId))
  )
    throw forbidden(
      "Solo puedes generar accesos para invitados de tus eventos.",
    );
  return guest;
}
export async function issueGuestAccess(
  actor: AccessIdentity,
  guestId: string,
  replace: boolean,
) {
  const guest = await assertManageGuest(actor, guestId);
  const key = "ff_" + randomBytes(32).toString("base64url");
  const account = await getPrisma().$transaction(async (tx) => {
    // Evita dos claves simultáneas al pulsar desde varias pestañas.
    await tx.$queryRaw`SELECT id FROM guests WHERE id=${guestId}::uuid FOR UPDATE`;
    let account = await tx.accessAccount.findUnique({ where: { guestId } });
    if (account && !replace) return null;
    if (!account)
      account = await tx.accessAccount.create({
        data: {
          role: "guest",
          guestId,
          name: guest.fullName,
          email: guest.email,
        },
      });
    else {
      await tx.accessKey.updateMany({
        where: { accountId: account.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.accessAccount.update({
        where: { id: account.id },
        data: { isActive: true },
      });
    }
    await tx.accessKey.create({
      data: {
        accountId: account.id,
        digest: keyHash(key),
        prefix: key.slice(0, 11),
      },
    });
    return account;
  });
  if (!account) return { exists: true as const };
  return {
    exists: false as const,
    key,
    guest: { id: guest.id, full_name: guest.fullName, email: guest.email },
    account_id: account.id,
  };
}
export async function guestDirectory(actor: AccessIdentity, search: string) {
  if (actor.role === "guest") throw forbidden();
  const rows = await getPrisma().guest.findMany({
    where: search
      ? { fullName: { contains: search, mode: "insensitive" } }
      : {},
    take: 50,
    orderBy: { fullName: "asc" },
    select: {
      id: true,
      fullName: true,
      avatar: true,
      family: { select: { name: true } },
      eventGuests: { select: { eventId: true } },
    },
  });
  return rows.map((g) => ({
    id: g.id,
    full_name: g.fullName,
    avatar: g.avatar,
    family_name: g.family?.name ?? null,
    invited_event_ids: g.eventGuests
      .filter(
        (e) =>
          actor.role === "superuser" || actor.event_ids.includes(e.eventId),
      )
      .map((e) => e.eventId),
    can_manage:
      actor.role === "superuser" ||
      g.eventGuests.some((e) => actor.event_ids.includes(e.eventId)),
  }));
}
export async function setGuestInvitation(
  actor: AccessIdentity,
  guestId: string,
  eventId: string,
  invited: boolean,
) {
  if (
    actor.role === "guest" ||
    (actor.role === "host" && !actor.event_ids.includes(eventId))
  )
    throw forbidden("Este evento no está asignado a tu cuenta.");
  await getPrisma().$transaction(async (tx) => {
    if (
      !(await tx.guest.findUnique({
        where: { id: guestId },
        select: { id: true },
      }))
    )
      throw notFound("Invitado no encontrado.");
    if (
      !(await tx.event.findUnique({
        where: { id: eventId },
        select: { id: true },
      }))
    )
      throw notFound("Evento no encontrado.");
    if (invited)
      await tx.eventGuest.createMany({
        data: [{ guestId, eventId }],
        skipDuplicates: true,
      });
    else await tx.eventGuest.deleteMany({ where: { guestId, eventId } });
  });
  return { ok: true, event_id: eventId, guest_id: guestId, invited };
}
