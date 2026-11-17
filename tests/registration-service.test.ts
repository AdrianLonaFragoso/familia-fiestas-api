import { beforeEach, describe, expect, it, vi } from "vitest";

const { prisma } = vi.hoisted(() => ({
  prisma: {
    event: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("../src/db/prisma.js", () => ({ getPrisma: () => prisma }));

import { registerForEvent } from "../src/services/registration.service.js";

const eventId = "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d";
const otherEventId = "6f1c2d3e-4a5b-4c6d-8e7f-9a0b1c2d3e4f";

const navidad = {
  id: eventId,
  slug: "navidad",
  name: "Cena de Navidad",
  eventDate: new Date("2026-12-24T00:00:00.000Z"),
};

const anoNuevo = {
  id: otherEventId,
  slug: "ano-nuevo",
  name: "Cena de Año Nuevo",
  eventDate: new Date("2026-12-31T00:00:00.000Z"),
};

const baseInput = {
  event_id: eventId,
  full_name: "María López",
  email: "maria@example.com",
  participates_in_exchange: false,
  gift_suggestions: undefined,
};

function makeTx(options: {
  guest?: unknown;
  matchingName?: unknown;
  existing?: unknown;
  createdGuest?: unknown;
} = {}) {
  const registeredAt = new Date("2026-11-16T12:00:00.000Z");
  return {
    guest: {
      findUnique: vi.fn().mockResolvedValue(options.guest ?? null),
      findFirst: vi.fn().mockResolvedValue(options.matchingName ?? null),
      create: vi
        .fn()
        .mockResolvedValue(options.createdGuest ?? { id: "guest-new" }),
      update: vi.fn().mockResolvedValue({ id: "guest-seed" }),
      findUniqueOrThrow: vi.fn().mockResolvedValue({
        id: "guest-new",
        fullName: "María López",
        email: "maria@example.com",
        family: { name: "Por clasificar" },
      }),
    },
    eventGuest: {
      findUnique: vi.fn().mockResolvedValue(options.existing ?? null),
      create: vi.fn().mockResolvedValue({
        id: "row-1",
        status: "pending",
        participatesInExchange: true,
        giftSuggestions: "Libro, bufanda",
        registeredAt,
      }),
      update: vi.fn().mockResolvedValue({
        id: "row-seed",
        status: "pending",
        participatesInExchange: false,
        giftSuggestions: null,
        registeredAt,
      }),
    },
  };
}

function useTransaction(tx: ReturnType<typeof makeTx>) {
  prisma.$transaction.mockImplementation(async (callback: (client: unknown) => unknown) =>
    callback(tx),
  );
  return tx;
}

describe("Servicio de inscripciones", () => {
  beforeEach(() => {
    prisma.event.findUnique.mockReset();
    prisma.$transaction.mockReset();
  });

  it("rechaza el intercambio en una celebración que no lo tiene", async () => {
    prisma.event.findUnique.mockResolvedValue(anoNuevo);

    await expect(
      registerForEvent({ ...baseInput, participates_in_exchange: true }),
    ).rejects.toMatchObject({ status: 422 });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("exige regalos sugeridos cuando participa en el intercambio", async () => {
    prisma.event.findUnique.mockResolvedValue(navidad);

    await expect(
      registerForEvent({ ...baseInput, participates_in_exchange: true, gift_suggestions: "  " }),
    ).rejects.toMatchObject({ status: 422 });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("crea el invitado y la asistencia cuando el correo es nuevo", async () => {
    prisma.event.findUnique.mockResolvedValue(navidad);
    const tx = useTransaction(makeTx());

    const result = await registerForEvent({
      ...baseInput,
      email: "Maria@Example.com ",
      participates_in_exchange: true,
      gift_suggestions: " Libro, bufanda ",
    });

    expect(tx.guest.create).toHaveBeenCalledOnce();
    expect(tx.eventGuest.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventId,
        guestId: "guest-new",
        participatesInExchange: true,
        giftSuggestions: "Libro, bufanda",
      }),
    });
    expect(result).toMatchObject({
      event_slug: "navidad",
      email: "maria@example.com",
      participates_in_exchange: true,
      gift_suggestions: "Libro, bufanda",
    });
  });

  it("vincula un invitado sembrado sin correo cuando coincide el nombre", async () => {
    prisma.event.findUnique.mockResolvedValue(navidad);
    const tx = useTransaction(makeTx({ matchingName: { id: "guest-seed" } }));

    await registerForEvent(baseInput);

    expect(tx.guest.update).toHaveBeenCalledWith({
      where: { id: "guest-seed" },
      data: { email: "maria@example.com" },
    });
    expect(tx.guest.create).not.toHaveBeenCalled();
  });

  it("responde 409 si el correo ya se inscribió a esa celebración", async () => {
    prisma.event.findUnique.mockResolvedValue(navidad);
    useTransaction(
      makeTx({
        guest: { id: "guest-1" },
        existing: { id: "row-1", registeredAt: new Date() },
      }),
    );

    await expect(registerForEvent(baseInput)).rejects.toMatchObject({
      status: 409,
      message: "Ese correo ya está inscrito en esta celebración.",
    });
  });

  it("permite el mismo correo en una celebración distinta", async () => {
    prisma.event.findUnique.mockResolvedValue(anoNuevo);
    const tx = useTransaction(makeTx({ guest: { id: "guest-1" } }));

    await registerForEvent({ ...baseInput, event_id: otherEventId });

    expect(tx.eventGuest.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventId: otherEventId,
        guestId: "guest-1",
        participatesInExchange: false,
        giftSuggestions: null,
      }),
    });
  });

  it("guarda el avatar al crear un invitado", async () => {
    prisma.event.findUnique.mockResolvedValue(navidad);
    const tx = useTransaction(makeTx({
      createdGuest: { id: "guest-new", avatar: "avatar-2" },
    }));
    tx.guest.findUniqueOrThrow.mockResolvedValue({
      id: "guest-new",
      fullName: "María López",
      email: "maria@example.com",
      avatar: "avatar-2",
      family: { name: "Por clasificar" },
    });

    const result = await registerForEvent({ ...baseInput, avatar: "avatar-2" });

    expect(tx.guest.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ avatar: "avatar-2" }),
    });
    expect(result.avatar).toBe("avatar-2");
  });

  it("actualiza el avatar al reutilizar un correo en otra celebración", async () => {
    prisma.event.findUnique.mockResolvedValue(anoNuevo);
    const tx = useTransaction(makeTx({
      guest: { id: "guest-1", avatar: "avatar-1" },
    }));

    await registerForEvent({ ...baseInput, event_id: otherEventId, avatar: "avatar-6" });

    expect(tx.guest.update).toHaveBeenCalledWith({
      where: { id: "guest-1" },
      data: { avatar: "avatar-6" },
    });
  });

  it("guarda el avatar al vincular por nombre un invitado sin correo", async () => {
    prisma.event.findUnique.mockResolvedValue(navidad);
    const tx = useTransaction(makeTx({ matchingName: { id: "guest-seed" } }));

    await registerForEvent({ ...baseInput, avatar: "avatar-5" });

    expect(tx.guest.update).toHaveBeenCalledWith({
      where: { id: "guest-seed" },
      data: { email: "maria@example.com", avatar: "avatar-5" },
    });
    expect(tx.guest.update).toHaveBeenCalledOnce();
  });

  it("conserva el avatar existente si se omite y permite quitarlo con null", async () => {
    prisma.event.findUnique.mockResolvedValue(anoNuevo);
    const tx = useTransaction(makeTx({
      guest: { id: "guest-1", avatar: "avatar-1" },
    }));

    await registerForEvent(baseInput);
    expect(tx.guest.update).not.toHaveBeenCalled();

    await registerForEvent({ ...baseInput, avatar: null });
    expect(tx.guest.update).toHaveBeenCalledWith({
      where: { id: "guest-1" },
      data: { avatar: null },
    });
  });

  it("no cambia el avatar cuando la inscripción está duplicada", async () => {
    prisma.event.findUnique.mockResolvedValue(navidad);
    const tx = useTransaction(makeTx({
      guest: { id: "guest-1", avatar: "avatar-1" },
      existing: { id: "row-1", registeredAt: new Date() },
    }));

    await expect(
      registerForEvent({ ...baseInput, avatar: "avatar-5" }),
    ).rejects.toMatchObject({ status: 409 });
    expect(tx.guest.update).not.toHaveBeenCalled();
  });
});
