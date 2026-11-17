import { describe, expect, it } from "vitest";

import {
  buildIcs,
  calendarMissing,
  formatDateLong,
  formatTime,
  googleCalendarUrl,
} from "../src/lib/dates.js";

const event = {
  name: "Cena de Navidad",
  event_date: "2026-12-24",
  start_time: "19:30:00",
  end_time: "23:30:00",
  description: "Cena familiar",
  venue: { name: "Casa", address: "Calle Principal 123" },
};

describe("Calendario", () => {
  it("formatea horas y fechas en español", () => {
    expect(formatTime("19:30:00")).toBe("7:30 PM");
    expect(formatTime("00:05:00")).toBe("12:05 AM");
    expect(formatTime(null)).toBe("Por confirmar");
    expect(formatDateLong("2026-12-24")).toContain("diciembre");
  });

  it("detecta cuándo falta la hora de inicio", () => {
    expect(calendarMissing({ ...event, start_time: null })).toContain("hora de inicio");
    expect(calendarMissing(event)).toBeNull();
  });

  it("genera una URL de Google Calendar con la zona de México", () => {
    const url = googleCalendarUrl(event);

    expect(url).toContain("calendar.google.com");
    expect(url).toContain("ctz=America%2FMexico_City");
  });

  it("genera un ICS válido con fechas en UTC", () => {
    const ics = buildIcs(event, "navidad");

    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("DTSTART:20261225T013000Z");
    expect(ics).toContain("DTEND:20261225T053000Z");
    expect(ics).toContain("SUMMARY:Cena de Navidad");
    expect(ics).toContain("END:VCALENDAR");
  });
});
