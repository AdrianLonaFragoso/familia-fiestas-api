import { createHash, randomInt, randomUUID } from "node:crypto";
import { z } from "zod";
import { getPrisma } from "../db/prisma.js";
import type { Prisma } from "../generated/prisma/client.js";
import { conflict, notFound, unprocessable } from "../lib/http-error.js";
import {
  isChildGuest,
  normalizeEmail,
  registrationExchangeEnabled,
} from "../lib/event-rules.js";
import { dateOnly } from "../lib/dates.js";
import { giftLinksHtml } from "../lib/exchange-email.js";
import { drawEmail, view } from "../serializers/exchange.js";
import {
  exchangeMailConfigured,
  mailFailure,
  sendExchangeMail,
} from "./exchange-mailer.js";

type Database = Prisma.TransactionClient;
const transactionOptions = { maxWait: 5000, timeout: 15000 };
const include = { assignments: { orderBy: { position: "asc" as const } } };
async function source(db: Database, eventId: string) {
  const event = await db.event.findUnique({ where: { id: eventId } });
  if (!event) throw notFound("Evento no encontrado.");
  const rows = await db.eventGuest.findMany({
    where: { eventId, participatesInExchange: true },
    include: {
      guest: { select: { id: true, fullName: true, email: true, tag: true } },
    },
    orderBy: { guestId: "asc" },
  });
  const issues: string[] = [];
  if (!registrationExchangeEnabled(event))
    issues.push(
      "El intercambio debe estar activo en Navidad, el 24 de diciembre.",
    );
  if (rows.length < 2) issues.push("Se necesitan al menos dos participantes.");
  const emails = new Set<string>();
  const participants = rows.map((row) => {
    const errors: string[] = [];
    const email = row.guest.email ? normalizeEmail(row.guest.email) : "";
    if (isChildGuest(row.guest)) errors.push("Solo participan adultos.");
    if (row.status !== "confirmed") errors.push("Falta confirmar asistencia.");
    if (!z.string().email().safeParse(email).success)
      errors.push("Falta un correo válido.");
    if (email && emails.has(email))
      errors.push("El correo está repetido entre participantes.");
    emails.add(email);
    if (!row.giftSuggestions?.trim())
      errors.push("Faltan las opciones de regalo.");
    if (errors.length)
      issues.push(`${row.guest.fullName}: ${errors.join(" ")}`);
    return {
      id: row.guest.id,
      name: row.guest.fullName,
      email,
      gifts: row.giftSuggestions?.trim() ?? "",
      issues: errors,
    };
  });
  const hash = createHash("sha256")
    .update(
      JSON.stringify({
        id: event.id,
        name: event.name,
        date: dateOnly(event.eventDate),
        rules: event.exchangeRules,
        enabled: event.giftExchangeEnabled,
        participants,
        issues,
      }),
    )
    .digest("hex");
  return { event, participants, issues, hash };
}
async function lockEvent(db: Database, eventId: string) {
  await db.$queryRaw`SELECT id FROM events WHERE id=${eventId}::uuid FOR UPDATE`;
  await db.$queryRaw`SELECT g.id FROM guests g JOIN event_guests e ON e.guest_id=g.id WHERE e.event_id=${eventId}::uuid AND e.participates_in_exchange=true ORDER BY g.id FOR SHARE OF g`;
}
function ensureReady(data: Awaited<ReturnType<typeof source>>) {
  if (data.issues.length)
    throw unprocessable("Corrige los datos antes de sortear o enviar.", {
      issues: data.issues,
    });
}
export function randomRecipients(ids: string[]) {
  if (ids.length < 2 || new Set(ids).size !== ids.length)
    throw unprocessable("Se necesitan al menos dos personas distintas.");
  for (let round = 0; round < 512; round++) {
    const shuffled = [...ids];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = randomInt(i + 1);
      [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
    }
    if (shuffled.every((id, i) => id !== ids[i])) return shuffled;
  }
  throw conflict("No se pudo completar el sorteo. Intenta de nuevo.");
}
async function findDraw(db: Database, id: string) {
  const draw = await db.exchangeDraw.findUnique({ where: { id }, include });
  if (!draw) throw notFound("Sorteo no encontrado.");
  return draw;
}
export async function exchangeOverview(eventId: string) {
  const db = getPrisma();
  const data = await source(db, eventId);
  const draw = await db.exchangeDraw.findUnique({
    where: { eventId },
    include,
  });
  return {
    event_id: eventId,
    event_name: data.event.name,
    participants: data.participants.map((p) => ({
      id: p.id,
      full_name: p.name,
      email: p.email,
      gift_suggestions: p.gifts,
      issues: p.issues,
    })),
    issues: data.issues,
    can_sort: data.issues.length === 0 && !draw?.lockedAt,
    mail_configured: exchangeMailConfigured(),
    draw: draw
      ? view(draw, !draw.lockedAt && draw.snapshotHash !== data.hash)
      : null,
  };
}
export async function generateExchange(
  eventId: string,
  expectedRevision: number,
  sortedBy: string,
) {
  const id = await getPrisma().$transaction(async (tx) => {
    await lockEvent(tx, eventId);
    const data = await source(tx, eventId);
    ensureReady(data);
    const current = await tx.exchangeDraw.findUnique({ where: { eventId } });
    if (current?.lockedAt)
      throw conflict("El sorteo ya se publicó y no puede repetirse.");
    if ((current?.revision ?? 0) !== expectedRevision)
      throw conflict(
        "Otra pestaña cambió el sorteo. Recarga antes de continuar.",
      );
    const recipients = randomRecipients(data.participants.map((p) => p.id));
    const info = {
      snapshotHash: data.hash,
      eventName: data.event.name,
      eventDate: data.event.eventDate,
      exchangeRules: data.event.exchangeRules,
      sortedBy,
    };
    const draw = current
      ? await tx.exchangeDraw.update({
          where: { id: current.id },
          data: { ...info, revision: { increment: 1 } },
        })
      : await tx.exchangeDraw.create({ data: { ...info, eventId } });
    if (current)
      await tx.exchangeAssignment.deleteMany({ where: { drawId: draw.id } });
    await tx.exchangeAssignment.createMany({
      data: data.participants.map((giver, i) => {
        const recipient = data.participants.find(
          (p) => p.id === recipients[i],
        )!;
        return {
          id: randomUUID(),
          drawId: draw.id,
          giverId: giver.id,
          recipientId: recipient.id,
          giverName: giver.name,
          giverEmail: giver.email,
          recipientName: recipient.name,
          giftSuggestions: recipient.gifts,
          position: i,
        };
      }),
    });
    return draw.id;
  }, transactionOptions);
  return getExchange(id);
}
export async function getExchange(id: string) {
  const db = getPrisma();
  const draw = await findDraw(db, id);
  const stale = draw.lockedAt
    ? false
    : (await source(db, draw.eventId)).hash !== draw.snapshotHash;
  return view(draw, stale);
}
export async function startExchange(id: string, revision: number) {
  if (!exchangeMailConfigured())
    throw unprocessable(
      "Falta configurar el correo del backend antes de enviar.",
    );
  await getPrisma().$transaction(async (tx) => {
    const initial = await findDraw(tx, id);
    await lockEvent(tx, initial.eventId);
    const draw = await findDraw(tx, id);
    if (draw.revision !== revision)
      throw conflict("El sorteo cambió. Revisa la versión actual.");
    if (draw.lockedAt) return;
    const data = await source(tx, draw.eventId);
    ensureReady(data);
    if (data.hash !== draw.snapshotHash)
      throw conflict(
        "Los datos o participantes cambiaron. Vuelve a sortear y revisar antes de enviar.",
      );
    await tx.exchangeDraw.update({
      where: { id },
      data: { lockedAt: new Date() },
    });
  }, transactionOptions);
  return getExchange(id);
}
/** Una orden del superusuario reclama un único correo. Ninguna tarea de envío queda fuera de la petición. */
export async function sendNextExchange(id: string) {
  const claimed = await getPrisma().$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM exchange_draws WHERE id=${id}::uuid FOR UPDATE`;
    const draw = await findDraw(tx, id);
    if (!draw.lockedAt)
      throw conflict("Revisa y confirma el sorteo antes de enviar.");
    const active = draw.assignments.find((a) => a.status === "sending");
    if (active) {
      if (
        active.attemptedAt &&
        Date.now() - active.attemptedAt.getTime() > 180000
      )
        await tx.exchangeAssignment.update({
          where: { id: active.id },
          data: {
            status: "uncertain",
            lastError:
              "El envío quedó interrumpido. Comprueba Enviados en Gmail antes de repetirlo.",
          },
        });
      return null;
    }
    const next = draw.assignments.find((a) => a.status === "pending");
    if (!next) return null;
    const assignment = await tx.exchangeAssignment.update({
      where: { id: next.id },
      data: {
        status: "sending",
        attempts: { increment: 1 },
        attemptedAt: new Date(),
        lastError: null,
      },
    });
    return { draw, assignment };
  }, transactionOptions);
  if (claimed) {
    const { draw, assignment } = claimed;
    const messageId = `<eventos-love.${assignment.id}@gmail.com>`;
    try {
      await sendExchangeMail({
        to: assignment.giverEmail,
        ...drawEmail(draw, assignment),
        messageId,
      });
      await getPrisma().exchangeAssignment.update({
        where: { id: assignment.id },
        data: {
          status: "sent",
          sentAt: new Date(),
          messageId,
          lastError: null,
        },
      });
    } catch (error) {
      const failure = mailFailure(error);
      await getPrisma().exchangeAssignment.updateMany({
        where: { id: assignment.id, status: "sending" },
        data: { status: failure.status, lastError: failure.message, messageId },
      });
    }
  }
  return getExchange(id);
}
export async function retryExchangeMail(
  id: string,
  assignmentId: string,
  action: "retry" | "mark-sent",
) {
  await getPrisma().$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM exchange_draws WHERE id=${id}::uuid FOR UPDATE`;
    const draw = await findDraw(tx, id);
    if (!draw.lockedAt) throw conflict("El sorteo aún es un borrador.");
    const assignment = draw.assignments.find((a) => a.id === assignmentId);
    if (!assignment) throw notFound("Correo no encontrado.");
    if (!["failed", "uncertain"].includes(assignment.status))
      throw conflict("Este correo no admite esa acción.");
    if (action === "mark-sent" && assignment.status !== "uncertain")
      throw conflict("Solo se pueden confirmar manualmente envíos inciertos.");
    await tx.exchangeAssignment.update({
      where: { id: assignmentId },
      data:
        action === "mark-sent"
          ? { status: "sent", sentAt: new Date(), lastError: null }
          : { status: "pending", lastError: null },
    });
  }, transactionOptions);
  return getExchange(id);
}
export async function ownExchangeResults(guestId: string) {
  const rows = await getPrisma().exchangeAssignment.findMany({
    where: { giverId: guestId, draw: { lockedAt: { not: null } } },
    include: { draw: true },
    orderBy: { position: "asc" },
  });
  return rows.map((row) => ({
    event_id: row.draw.eventId,
    event_name: row.draw.eventName,
    recipient_name: row.recipientName,
    gift_suggestions: row.giftSuggestions,
    gift_html: giftLinksHtml(row.giftSuggestions),
    published_at: row.draw.lockedAt!.toISOString(),
  }));
}
