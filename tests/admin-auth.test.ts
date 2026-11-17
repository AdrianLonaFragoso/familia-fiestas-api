import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { listGuests } = vi.hoisted(() => ({
  listGuests: vi.fn(),
}));

vi.mock("../src/services/guest.service.js", () => ({
  listGuests,
}));

import { createApp } from "../src/app.js";

const app = createApp();

describe("Autenticación de administración", () => {
  beforeEach(() => {
    listGuests.mockReset();
    listGuests.mockResolvedValue([
      {
        id: "0b6f6f2e-6f7f-4f1e-8a1b-0f0f0f0f0f0f",
        full_name: "Invitado de prueba",
        family_id: null,
        family_name: null,
        tag: null,
        created_at: new Date().toISOString(),
        event_statuses: [],
        private: null,
        invitation_tokens: [],
      },
    ]);
  });

  it("rechaza el acceso sin X-Admin-Key", async () => {
    const response = await request(app).get("/api/v1/admin/guests");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("unauthorized");
    expect(listGuests).not.toHaveBeenCalled();
  });

  it("permite el acceso con la clave correcta", async () => {
    const response = await request(app)
      .get("/api/v1/admin/guests")
      .set("X-Admin-Key", "test-admin-key");

    expect(response.status).toBe(200);
    expect(response.body[0].full_name).toBe("Invitado de prueba");
    expect(listGuests).toHaveBeenCalledOnce();
  });

  it("rechaza una clave incorrecta", async () => {
    const response = await request(app)
      .get("/api/v1/admin/guests")
      .set("X-Admin-Key", "clave-incorrecta");

    expect(response.status).toBe(401);
  });
});
