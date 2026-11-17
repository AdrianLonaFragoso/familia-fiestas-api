import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getInvitation, setRsvp } = vi.hoisted(() => ({
  getInvitation: vi.fn(),
  setRsvp: vi.fn(),
}));

vi.mock("../src/services/invitation.service.js", () => ({
  getInvitation,
  setRsvp,
}));

import { createApp } from "../src/app.js";

const app = createApp();
const token = "a".repeat(64);
const eventId = "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d";

describe("Invitaciones personales", () => {
  beforeEach(() => {
    getInvitation.mockReset();
    setRsvp.mockReset();
  });

  it("valida el formato del token", async () => {
    const response = await request(app)
      .post("/api/v1/invitations/resolve")
      .send({ token: "no-es-un-token" });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe("validation_error");
    expect(getInvitation).not.toHaveBeenCalled();
  });

  it("devuelve 404 cuando el token no existe o fue revocado", async () => {
    getInvitation.mockResolvedValue(null);

    const response = await request(app)
      .post("/api/v1/invitations/resolve")
      .send({ token });

    expect(response.status).toBe(404);
    expect(response.body.error.message).toContain("enlace");
  });

  it("resuelve la invitación con el token en el body", async () => {
    getInvitation.mockResolvedValue({
      guest: { id: eventId, full_name: "Invitado" },
      events: [],
      responsibilities: [],
    });

    const response = await request(app)
      .post("/api/v1/invitations/resolve")
      .send({ token });

    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(getInvitation).toHaveBeenCalledWith(token);
  });

  it("actualiza el RSVP del invitado dueño del token", async () => {
    setRsvp.mockResolvedValue({
      ok: true,
      event_id: eventId,
      status: "confirmed",
      responded_at: new Date().toISOString(),
    });

    const response = await request(app)
      .patch("/api/v1/invitations/rsvp")
      .send({ token, event_id: eventId, status: "confirmed" });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ ok: true, status: "confirmed" });
    expect(setRsvp).toHaveBeenCalledWith({
      token,
      event_id: eventId,
      status: "confirmed",
    });
  });

  it("rechaza estados de RSVP desconocidos", async () => {
    const response = await request(app)
      .patch("/api/v1/invitations/rsvp")
      .send({ token, event_id: eventId, status: "quizas" });

    expect(response.status).toBe(422);
    expect(setRsvp).not.toHaveBeenCalled();
  });
});
