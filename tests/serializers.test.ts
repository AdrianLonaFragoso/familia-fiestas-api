import { describe, expect, it } from "vitest";

import {
  countStatuses,
  mapAdminGuest,
  mapEvent,
  mapGuest,
  mapParticipant,
  mapRegistration,
  mapVenue,
} from "../src/serializers/index.js";

const now = new Date("2026-11-16T12:00:00.000Z");

const eventRecord = {
  id: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  slug: "navidad",
  name: "Cena de Navidad",
  eventDate: new Date("2026-12-24T00:00:00.000Z"),
  arrivalTime: new Date("1970-01-01T18:30:00.000Z"),
  startTime: new Date("1970-01-01T19:30:00.000Z"),
  dinnerTime: null,
  endTime: new Date("1970-01-02T01:00:00.000Z"),
  description: "Cena familiar",
  observations: null,
  venueId: null,
  updatedAt: now,
};

const venueRecord = {
  id: "6f1c2d3e-4a5b-4c6d-8e7f-9a0b1c2d3e4f",
  name: "Casa de la familia",
  address: "Calle Principal 123",
  referencesText: null,
  accessNotes: null,
  parking: null,
  photoPath: null,
  observations: null,
  latitude: 19.4326,
  longitude: -99.1332,
  updatedAt: now,
};

describe("Serializadores", () => {
  it("calcula los contadores de asistencia", () => {
    expect(
      countStatuses([
        { status: "confirmed" },
        { status: "confirmed" },
        { status: "declined" },
        { status: "pending" },
      ]),
    ).toEqual({ total: 4, confirmed: 2, pending: 1, declined: 1 });
  });

  it("genera fecha, horas y calendario listos para renderizar", () => {
    const mapped = mapEvent(eventRecord, venueRecord);

    expect(mapped.display.date_long).toContain("diciembre");
    expect(mapped.display.start_time).toBe("7:30 PM");
    expect(mapped.calendar.available).toBe(true);
    expect(mapped.calendar.start_instant).toBe("2026-12-25T01:30:00.000Z");
    expect(mapped.calendar.ics_url).toBe("/api/v1/events/navidad/calendar.ics");
    expect(mapped.gift_exchange_enabled).toBe(true);
    expect(
      mapEvent({ ...eventRecord, slug: "ano-nuevo" }, venueRecord).gift_exchange_enabled,
    ).toBe(false);
  });

  it("expone correo e intercambio solo en la vista de administración", () => {
    const adminGuest = mapAdminGuest({
      id: "0b6f6f2e-6f7f-4f1e-8a1b-0f0f0f0f0f0f",
      fullName: "María López",
      avatar: "avatar-4",
      email: "maria@example.com",
      familyId: null,
      tag: null,
      createdAt: now,
      family: { name: "Por clasificar" },
      eventGuests: [
        {
          id: "8a7b6c5d-4e3f-4a2b-9c1d-0e9f8a7b6c5d",
          eventId: eventRecord.id,
          guestId: "0b6f6f2e-6f7f-4f1e-8a1b-0f0f0f0f0f0f",
          status: "pending",
          publicNote: null,
          participatesInExchange: true,
          giftSuggestions: "Libro",
          registeredAt: now,
          respondedAt: null,
          event: {
            id: eventRecord.id,
            slug: "navidad",
            name: "Cena de Navidad",
            eventDate: eventRecord.eventDate,
            startTime: eventRecord.startTime,
            arrivalTime: eventRecord.arrivalTime,
          },
        },
      ],
    });

    expect(adminGuest.email).toBe("maria@example.com");
    expect(adminGuest.avatar).toBe("avatar-4");
    expect(adminGuest.event_statuses[0]).toMatchObject({
      id: "8a7b6c5d-4e3f-4a2b-9c1d-0e9f8a7b6c5d",
      participates_in_exchange: true,
      gift_suggestions: "Libro",
    });
    expect(adminGuest.event_statuses[0]?.registered_at).toBe(now.toISOString());
  });

  it("genera enlaces de mapas a partir de la sede", () => {
    const venue = mapVenue(venueRecord);

    expect(venue.links.google_maps_url).toContain("19.4326");
    expect(venue.links.waze_url).toContain("waze.com");
  });

  it("el directorio público no expone datos privados", () => {
    const participant = mapParticipant(
      {
        id: "0b6f6f2e-6f7f-4f1e-8a1b-0f0f0f0f0f0f",
        fullName: "Invitado",
        avatar: "avatar-2",
        familyId: null,
        tag: "adulto",
        createdAt: now,
        family: { name: "Familia" },
      },
      [
        {
          id: "8a7b6c5d-4e3f-4a2b-9c1d-0e9f8a7b6c5d",
          eventId: eventRecord.id,
          guestId: "0b6f6f2e-6f7f-4f1e-8a1b-0f0f0f0f0f0f",
          status: "confirmed",
          publicNote: "Llevaré postre",
          participatesInExchange: false,
          giftSuggestions: null,
          registeredAt: null,
          respondedAt: now,
          event: {
            id: eventRecord.id,
            slug: "navidad",
            name: "Cena de Navidad",
            eventDate: eventRecord.eventDate,
            startTime: eventRecord.startTime,
            arrivalTime: eventRecord.arrivalTime,
          },
        },
      ],
    );

    expect(participant.event_statuses[0]?.status_label).toBe("Confirmado");
    expect(participant.avatar).toBe("avatar-2");
    expect(participant).not.toHaveProperty("private");
    expect(participant).not.toHaveProperty("admin_notes");
    expect(participant).not.toHaveProperty("dietary_notes");
    expect(participant).not.toHaveProperty("invitation_tokens");
    expect(JSON.stringify(participant)).not.toContain("Llevaré postre");
  });

  it("serializa invitados anteriores sin avatar como null", () => {
    expect(mapGuest({
      id: "guest-1",
      fullName: "Invitado",
      familyId: null,
      tag: null,
      createdAt: now,
    }).avatar).toBeNull();
  });

  it("incluye el avatar en la inscripción sin exponer una ruta de archivo", () => {
    const registration = mapRegistration({
      id: "registration-1",
      status: "pending",
      participatesInExchange: false,
      giftSuggestions: null,
      registeredAt: now,
      event: eventRecord,
      guest: {
        id: "guest-1",
        fullName: "Invitado",
        avatar: "avatar-6",
        email: "guest@example.com",
      },
    });
    expect(registration.avatar).toBe("avatar-6");
  });
});
