import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { registerForEvent } = vi.hoisted(() => ({
  registerForEvent: vi.fn(),
}));

vi.mock("../src/services/registration.service.js", () => ({
  registerForEvent,
  listRegistrations: vi.fn(),
}));

import { createApp } from "../src/app.js";

const app = createApp();
const eventId = "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d";

describe("Inscripciones públicas", () => {
  beforeEach(() => {
    registerForEvent.mockReset();
  });

  it("rechaza correos inválidos antes de llamar al servicio", async () => {
    const response = await request(app).post("/api/v1/registrations").send({
      event_id: eventId,
      full_name: "María López",
      email: "no-es-un-correo",
    });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe("validation_error");
    expect(registerForEvent).not.toHaveBeenCalled();
  });

  it("rechaza nombres demasiado cortos", async () => {
    const response = await request(app).post("/api/v1/registrations").send({
      event_id: eventId,
      full_name: "M",
      email: "maria@example.com",
    });

    expect(response.status).toBe(422);
    expect(registerForEvent).not.toHaveBeenCalled();
  });

  it("rechaza un avatar que no pertenece a la galería", async () => {
    const response = await request(app).post("/api/v1/registrations").send({
      event_id: eventId,
      full_name: "María López",
      email: "maria@example.com",
      avatar: "avatar-9",
    });

    expect(response.status).toBe(422);
    expect(registerForEvent).not.toHaveBeenCalled();
  });

  it("normaliza el correo y delega la inscripción al servicio", async () => {
    registerForEvent.mockResolvedValue({
      id: "row-1",
      event_id: eventId,
      event_slug: "navidad",
      event_name: "Cena de Navidad",
      event_date: "2026-12-24",
      event_date_label: "24 de diciembre de 2026",
      guest_id: "guest-1",
      full_name: "María López",
      avatar: "avatar-3",
      email: "maria@example.com",
      family_name: "Por clasificar",
      status: "pending",
      status_label: "Pendiente de confirmar",
      participates_in_exchange: true,
      gift_suggestions: "Libro, bufanda",
      registered_at: new Date().toISOString(),
    });

    const response = await request(app).post("/api/v1/registrations").send({
      event_id: eventId,
      full_name: "  María López ",
      avatar: "avatar-3",
      email: "  Maria@Example.com ",
      participates_in_exchange: true,
      gift_suggestions: "Libro, bufanda",
    });

    expect(response.status).toBe(201);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.body.avatar).toBe("avatar-3");
    expect(registerForEvent).toHaveBeenCalledWith({
      event_id: eventId,
      full_name: "María López",
      avatar: "avatar-3",
      email: "maria@example.com",
      participates_in_exchange: true,
      gift_suggestions: "Libro, bufanda",
    });
  });
});
