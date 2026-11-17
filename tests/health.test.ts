import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";

const app = createApp();

describe("API pública", () => {
  it("responde el estado del servicio", async () => {
    const response = await request(app).get("/api/v1/health");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: "ok" });
    expect(typeof response.body.timestamp).toBe("string");
  });

  it("devuelve 404 con formato uniforme para rutas inexistentes", async () => {
    const response = await request(app).get("/api/v1/no-existe");

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("not_found");
  });

  it("expone la documentación OpenAPI", async () => {
    const response = await request(app).get("/api/openapi.json");

    expect(response.status).toBe(200);
    expect(response.body.openapi).toBe("3.0.3");
    expect(response.body.info.title).toBe("Familia Fiestas API");
  });
});
