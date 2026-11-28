import { beforeEach, describe, expect, it, vi } from "vitest";

const { prisma } = vi.hoisted(() => ({
  prisma: {
    guest: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn() },
    eventGuest: { findUnique: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("../src/db/prisma.js", () => ({ getPrisma: () => prisma }));

import { createGuest, updateEventGuest, updateGuest } from "../src/services/guest.service.js";

const guestId = "0b6f6f2e-6f7f-4f1e-8a1b-0f0f0f0f0f0f";
const eventId = "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d";

const guestRow = {
  id: guestId,
  fullName: "María López",
  email: "maria@example.com",
  familyId: null,
  tag: null,
  createdAt: new Date("2026-11-16T12:00:00.000Z"),
  family: null,
  private: null,
  eventGuests: [],
  invitationTokens: [],
};

function makeTx() {
  return {
    guest: {
      create: vi.fn().mockResolvedValue({ id: guestId }),
      update: vi.fn().mockResolvedValue({ id: guestId }),
      findUniqueOrThrow: vi.fn().mockResolvedValue(guestRow),
    },
    eventGuest: {
      createMany: vi.fn().mockResolvedValue({ count: 1 }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  };
}

function useTransaction(tx: ReturnType<typeof makeTx>) {
  prisma.$transaction.mockImplementation(async (callback: (client: unknown) => unknown) =>
    callback(tx),
  );
  return tx;
}

describe("Servicio de invitados (administración)", () => {
  beforeEach(() => {
    prisma.guest.findUnique.mockReset();
    prisma.eventGuest.findUnique.mockReset();
    prisma.eventGuest.update.mockReset();
    prisma.$transaction.mockReset();
  });

  it("crea el invitado con correo normalizado y lo inscribe en los eventos", async () => {
    const tx = useTransaction(makeTx());

    const result = await createGuest({
      full_name: "María López",
      email: "  Maria@Example.com ",
      event_ids: [eventId],
      family_id: null,
      tag: null,
    });

    expect(tx.guest.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ fullName: "María López", email: "maria@example.com" }),
    });
    expect(tx.eventGuest.createMany).toHaveBeenCalledWith({
      data: [{ eventId, guestId, status: "confirmed", respondedAt: expect.any(Date) }],
      skipDuplicates: true,
    });
    expect(result.email).toBe("maria@example.com");
  });

  it("responde 409 cuando el correo ya existe", async () => {
    useTransaction(makeTx());
    prisma.$transaction.mockRejectedValue(Object.assign(new Error("unique"), { code: "P2002" }));

    await expect(
      createGuest({
        full_name: "Otra Persona",
        email: "maria@example.com",
        family_id: null,
        tag: null,
      }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("sincroniza los eventos al actualizar y permite quitar el correo", async () => {
    prisma.guest.findUnique.mockResolvedValue({ id: guestId });
    const tx = useTransaction(makeTx());

    await updateGuest(guestId, { email: null, event_ids: [eventId] });

    expect(tx.guest.update).toHaveBeenCalledWith({
      where: { id: guestId },
      data: expect.objectContaining({ email: null }),
    });
    expect(tx.eventGuest.deleteMany).toHaveBeenCalledWith({
      where: { guestId, eventId: { notIn: [eventId] } },
    });
  });

  it("guarda el avatar al crear un invitado desde administración", async () => {
    const tx = useTransaction(makeTx());
    tx.guest.findUniqueOrThrow.mockResolvedValue({ ...guestRow, avatar: "avatar-3" });

    const result = await createGuest({ full_name: "María López", avatar: "avatar-3" });

    expect(tx.guest.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ avatar: "avatar-3" }),
    });
    expect(result.avatar).toBe("avatar-3");
  });

  it.each(["avatar-6", null] as const)("edita o quita el avatar: %s", async (avatar) => {
    prisma.guest.findUnique.mockResolvedValue({ id: guestId });
    const tx = useTransaction(makeTx());
    tx.guest.findUniqueOrThrow.mockResolvedValue({ ...guestRow, avatar });

    const result = await updateGuest(guestId, { avatar });

    expect(tx.guest.update).toHaveBeenCalledWith({
      where: { id: guestId },
      data: { avatar },
    });
    expect(result.avatar).toBe(avatar);
  });

  it("no cambia el avatar cuando solo se edita otro campo", async () => {
    prisma.guest.findUnique.mockResolvedValue({ id: guestId });
    const tx = useTransaction(makeTx());

    await updateGuest(guestId, { tag: "Prima" });

    expect(tx.guest.update).toHaveBeenCalledWith({
      where: { id: guestId },
      data: { tag: "Prima" },
    });
  });
});

const eventGuestId = "c1f2a3b4-5d6e-4f70-8a91-b2c3d4e5f607";

function eventGuestRow(overrides: Record<string, unknown> = {}) {
  return {
    id: eventGuestId,
    eventId,
    guestId,
    participatesInExchange: false,
    giftSuggestions: null,
    event: { slug: "navidad" },
    ...overrides,
  };
}

describe("Intercambio de regalos desde administración", () => {
  beforeEach(() => {
    prisma.eventGuest.findUnique.mockReset();
    prisma.eventGuest.update.mockReset();
  });

  it("activa el intercambio cuando hay regalos", async () => {
    prisma.eventGuest.findUnique.mockResolvedValue(eventGuestRow());
    prisma.eventGuest.update.mockResolvedValue({
      ...eventGuestRow({ participatesInExchange: true, giftSuggestions: "Libro" }),
      status: "pending",
      publicNote: null,
      respondedAt: null,
    });

    const result = await updateEventGuest(eventGuestId, {
      participates_in_exchange: true,
      gift_suggestions: "Libro",
    });

    expect(prisma.eventGuest.update).toHaveBeenCalledWith({
      where: { id: eventGuestId },
      data: expect.objectContaining({
        participatesInExchange: true,
        giftSuggestions: "Libro",
      }),
    });
    expect(result).toMatchObject({
      participates_in_exchange: true,
      gift_suggestions: "Libro",
    });
  });

  it("rechaza activar el intercambio sin regalos", async () => {
    prisma.eventGuest.findUnique.mockResolvedValue(eventGuestRow());

    await expect(
      updateEventGuest(eventGuestId, { participates_in_exchange: true }),
    ).rejects.toMatchObject({ status: 422 });
    expect(prisma.eventGuest.update).not.toHaveBeenCalled();
  });

  it("rechaza el intercambio en una celebración que no lo tiene", async () => {
    prisma.eventGuest.findUnique.mockResolvedValue(
      eventGuestRow({ event: { slug: "ano-nuevo" } }),
    );

    await expect(
      updateEventGuest(eventGuestId, {
        participates_in_exchange: true,
        gift_suggestions: "Libro",
      }),
    ).rejects.toMatchObject({ status: 422 });
    expect(prisma.eventGuest.update).not.toHaveBeenCalled();
  });

  it("al desactivarlo conserva los regalos para futuras referencias", async () => {
    prisma.eventGuest.findUnique.mockResolvedValue(
      eventGuestRow({ participatesInExchange: true, giftSuggestions: "Libro" }),
    );
    prisma.eventGuest.update.mockResolvedValue({
      ...eventGuestRow({ participatesInExchange: false, giftSuggestions: "Libro" }),
      status: "pending",
      publicNote: null,
      respondedAt: null,
    });

    await updateEventGuest(eventGuestId, { participates_in_exchange: false });

    const call = prisma.eventGuest.update.mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(call.data).toMatchObject({ participatesInExchange: false });
    expect(call.data).not.toHaveProperty("giftSuggestions");
  });
});
