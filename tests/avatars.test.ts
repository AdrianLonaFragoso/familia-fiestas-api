import { describe, expect, it } from "vitest";
import { guestCreateSchema, guestUpdateSchema } from "../src/schemas/admin.js";
import { registrationSchema } from "../src/schemas/registration.js";
import { AVATAR_IDS } from "../src/schemas/common.js";

const registration = {
  event_id: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  full_name: "María López",
  email: "maria@example.com",
};

describe("Avatares de invitados", () => {
  it.each(AVATAR_IDS)("acepta %s en registro, alta y edición", (avatar) => {
    expect(registrationSchema.safeParse({ ...registration, avatar }).success).toBe(true);
    expect(guestCreateSchema.safeParse({ full_name: "María", avatar }).success).toBe(true);
    expect(guestUpdateSchema.safeParse({ avatar }).success).toBe(true);
  });

  it.each([undefined, null])("acepta un avatar opcional: %s", (avatar) => {
    expect(registrationSchema.safeParse({ ...registration, avatar }).success).toBe(true);
    expect(guestCreateSchema.safeParse({ full_name: "María", avatar }).success).toBe(true);
    expect(guestUpdateSchema.safeParse({ avatar }).success).toBe(true);
  });

  it.each(["avatar-0", "avatar-26", "", "/avatar-1.png", "https://example.com/avatar.png"])(
    "rechaza un avatar fuera de la galería: %s",
    (avatar) => {
      expect(registrationSchema.safeParse({ ...registration, avatar }).success).toBe(false);
      expect(guestCreateSchema.safeParse({ full_name: "María", avatar }).success).toBe(false);
      expect(guestUpdateSchema.safeParse({ avatar }).success).toBe(false);
    },
  );
});
