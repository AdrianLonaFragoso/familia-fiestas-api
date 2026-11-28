import type { Prisma } from "../generated/prisma/client.js";
import { dateOnly, formatDateLong } from "../lib/dates.js";
import { exchangeEmail, giftLinksHtml } from "../lib/exchange-email.js";
import { exchangeMailConfigured } from "../services/exchange-mailer.js";
import { getEnv } from "../config/env.js";
type Draw = Prisma.ExchangeDrawGetPayload<{ include: { assignments: true } }>;
export function drawEmail(draw: Draw, assignment: Draw["assignments"][number]) {
  return exchangeEmail({
    giverName: assignment.giverName,
    recipientName: assignment.recipientName,
    giftSuggestions: assignment.giftSuggestions,
    eventName: draw.eventName,
    dateLabel: formatDateLong(dateOnly(draw.eventDate)),
    rules: draw.exchangeRules,
    profileUrl: `${getEnv().FRONTEND_URL}/profile/${assignment.giverId}`,
  });
}
export function view(draw: Draw, stale = false) {
  const counts = { pending: 0, sending: 0, sent: 0, failed: 0, uncertain: 0 };
  for (const a of draw.assignments) counts[a.status as keyof typeof counts]++;
  return {
    id: draw.id,
    event_id: draw.eventId,
    event_name: draw.eventName,
    date_label: formatDateLong(dateOnly(draw.eventDate)),
    revision: draw.revision,
    sorted_by: draw.sortedBy,
    updated_at: draw.updatedAt.toISOString(),
    locked_at: draw.lockedAt?.toISOString() ?? null,
    stale,
    mail_configured: exchangeMailConfigured(),
    state: !draw.lockedAt
      ? "draft"
      : counts.sent === draw.assignments.length
        ? "completed"
        : "sending",
    counts,
    assignments: draw.assignments.map((a) => ({
      id: a.id,
      giver_name: a.giverName,
      giver_email: a.giverEmail,
      recipient_name: a.recipientName,
      gift_suggestions: a.giftSuggestions,
      gift_html: giftLinksHtml(a.giftSuggestions),
      status: a.status,
      attempts: a.attempts,
      sent_at: a.sentAt?.toISOString() ?? null,
      last_error: a.lastError,
      preview: drawEmail(draw, a),
    })),
  };
}
