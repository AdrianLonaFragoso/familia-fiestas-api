import type { CalendarInfo, VenueLike } from "../types.js";

export const TZ = "America/Mexico_City";
// Mexico City has no daylight saving time since 2022: fixed UTC-6.
export const TZ_OFFSET = "-06:00";

export type DateLike = Date | string;

export function dateOnly(value: DateLike): string {
  return typeof value === "string" ? value.slice(0, 10) : value.toISOString().slice(0, 10);
}

export function timeOnly(value: DateLike | null): string | null {
  if (value == null) return null;
  return typeof value === "string" ? value.slice(0, 8) : value.toISOString().slice(11, 19);
}

export function isoDate(value: DateLike | null): string | null {
  if (value == null) return null;
  return typeof value === "string" ? value : value.toISOString();
}

export function isoRequired(value: DateLike): string {
  return typeof value === "string" ? value : value.toISOString();
}

export function decimal(value: { toString(): string } | number | null): number | null {
  if (value == null) return null;
  return typeof value === "number" ? value : Number(value.toString());
}

/** "19:30:00" -> "7:30 PM"; null -> "Por confirmar" */
export function formatTime(time: string | null | undefined): string {
  if (!time) return "Por confirmar";
  const [hourText, minuteText] = time.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText ?? 0);
  if (Number.isNaN(hour)) return "Por confirmar";
  const suffix = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${String(minute).padStart(2, "0")} ${suffix}`;
}

export function formatDateLong(date: string): string {
  const value = new Date(`${date}T12:00:00${TZ_OFFSET}`);
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(value);
}

export function formatDateShort(date: string): string {
  const value = new Date(`${date}T12:00:00${TZ_OFFSET}`);
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: TZ,
    day: "numeric",
    month: "short",
  }).format(value);
}

export function formatDateTime(value: DateLike): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: TZ,
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

/** Instant for a local Mexico City date + time, or null when time is missing. */
export function eventInstant(date: string, time: string | null | undefined): Date | null {
  if (!time) return null;
  const hhmm = time.slice(0, 5);
  return new Date(`${date}T${hhmm}:00${TZ_OFFSET}`);
}

export function eventStartTime(event: {
  arrival_time?: string | null;
  start_time?: string | null;
}): string | null {
  return event.start_time ?? event.arrival_time ?? null;
}

/** End of the celebration day (used to decide when an event is over). */
export function eventDayEnd(date: string): Date {
  return new Date(`${date}T23:59:59${TZ_OFFSET}`);
}

export function hasLocation(venue: VenueLike | null | undefined): boolean {
  if (!venue) return false;
  return Boolean(
    (venue.address && venue.address.trim()) ||
      (venue.latitude != null && venue.longitude != null),
  );
}

export function googleMapsUrl(venue: VenueLike | null | undefined): string | null {
  if (!venue || !hasLocation(venue)) return null;
  const query =
    venue.latitude != null && venue.longitude != null
      ? `${venue.latitude},${venue.longitude}`
      : venue.address!.trim();
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function wazeUrl(venue: VenueLike | null | undefined): string | null {
  if (!venue || !hasLocation(venue)) return null;
  if (venue.latitude != null && venue.longitude != null) {
    return `https://waze.com/ul?ll=${venue.latitude},${venue.longitude}&navigate=yes`;
  }
  return `https://waze.com/ul?q=${encodeURIComponent(venue.address!.trim())}&navigate=yes`;
}

export type CalendarInput = {
  name: string;
  event_date: string;
  arrival_time?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  description?: string | null;
  venue?: VenueLike | null;
  url?: string;
};

export function calendarMissing(event: CalendarInput): string | null {
  if (!eventStartTime(event)) return "Falta definir la hora de inicio de la celebración.";
  return null;
}

function toUtcStamp(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

export function calendarRange(event: CalendarInput): { start: Date; end: Date } | null {
  const start = eventInstant(event.event_date, eventStartTime(event));
  if (!start) return null;
  let end = eventInstant(event.event_date, event.end_time);
  if (!end || end <= start) {
    end =
      end && end <= start
        ? new Date(end.getTime() + 86_400_000)
        : new Date(start.getTime() + 4 * 3_600_000);
  }
  return { start, end };
}

function locationText(venue?: VenueLike | null): string {
  if (!venue) return "";
  return [venue.name, venue.address].filter(Boolean).join(", ");
}

export function googleCalendarUrl(event: CalendarInput): string | null {
  if (calendarMissing(event)) return null;
  const range = calendarRange(event);
  if (!range) return null;
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.name,
    dates: `${toUtcStamp(range.start)}/${toUtcStamp(range.end)}`,
    details: [event.description ?? "", event.url ?? ""].filter(Boolean).join("\n\n"),
    location: locationText(event.venue),
    ctz: TZ,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function icsEscape(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

export function buildIcs(event: CalendarInput, uid: string): string | null {
  if (calendarMissing(event)) return null;
  const range = calendarRange(event);
  if (!range) return null;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Navidad en Familia 2026//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}@navidad-en-familia`,
    `DTSTAMP:${toUtcStamp(new Date())}`,
    `DTSTART:${toUtcStamp(range.start)}`,
    `DTEND:${toUtcStamp(range.end)}`,
    `SUMMARY:${icsEscape(event.name)}`,
    `DESCRIPTION:${icsEscape(
      [event.description ?? "", event.url ?? ""].filter(Boolean).join("\n\n"),
    )}`,
    `LOCATION:${icsEscape(locationText(event.venue))}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.join("\r\n");
}

export function calendarInfo(
  event: CalendarInput,
  slug: string,
): CalendarInfo {
  const missing = calendarMissing(event);
  const range = calendarRange(event);
  return {
    available: missing == null,
    missing_reason: missing,
    google_url: googleCalendarUrl(event),
    ics_url: missing == null ? `/api/v1/events/${slug}/calendar.ics` : null,
    start_instant: range?.start.toISOString() ?? null,
    end_instant: range?.end.toISOString() ?? null,
  };
}
