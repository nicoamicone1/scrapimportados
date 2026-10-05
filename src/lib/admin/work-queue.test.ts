import { describe, expect, it } from "vitest";

import { groupWorkQueue, isWorkQueueStatus, prioritizeWorkQueue, todoHeadline, WORK_QUEUE_LIMIT } from "./work-queue";

const order = (id: string, status: string, createdAt: string, extra: { expiresAt?: string | null; paymentStatus?: string } = {}) => ({
  id,
  status,
  createdAt,
  expiresAt: extra.expiresAt ?? null,
  paymentStatus: extra.paymentStatus ?? "pending",
});

const ids = (rows: { id: string }[]) => rows.map((r) => r.id);

describe("isWorkQueueStatus", () => {
  it("sólo pendientes, confirmados y en preparación", () => {
    expect(["pending", "confirmed", "preparing"].every(isWorkQueueStatus)).toBe(true);
    expect(["shipped", "delivered", "cancelled", "otro"].some(isWorkQueueStatus)).toBe(false);
  });
});

describe("prioritizeWorkQueue", () => {
  it("primero los pendientes, después los confirmados y en preparación", () => {
    const rows = [
      order("c1", "confirmed", "2026-10-01T10:00:00Z"),
      order("p1", "pending", "2026-10-04T10:00:00Z"),
      order("x1", "preparing", "2026-09-30T10:00:00Z"),
      order("p2", "pending", "2026-10-03T10:00:00Z"),
    ];
    expect(ids(prioritizeWorkQueue(rows))).toEqual(["p2", "p1", "x1", "c1"]);
  });

  it("entre pendientes, la reserva que vence primero va adelante", () => {
    const rows = [
      order("viejo", "pending", "2026-10-01T10:00:00Z", { paymentStatus: "paid" }),
      order("vence-tarde", "pending", "2026-10-02T10:00:00Z", { expiresAt: "2026-10-06T10:00:00Z" }),
      order("vence-ya", "pending", "2026-10-03T10:00:00Z", { expiresAt: "2026-10-05T12:00:00Z" }),
    ];
    expect(ids(prioritizeWorkQueue(rows))).toEqual(["vence-ya", "vence-tarde", "viejo"]);
  });

  it("un vencimiento sin reserva viva (ya pagado) no adelanta el pedido", () => {
    const rows = [
      order("a", "pending", "2026-10-01T10:00:00Z"),
      order("b", "pending", "2026-10-02T10:00:00Z", { expiresAt: "2026-10-03T10:00:00Z", paymentStatus: "paid" }),
    ];
    expect(ids(prioritizeWorkQueue(rows))).toEqual(["a", "b"]);
  });

  it("descarta estados no accionables y duplicados, y corta en el límite", () => {
    const rows = [
      order("s", "shipped", "2026-10-01T10:00:00Z"),
      order("d", "delivered", "2026-10-01T10:00:00Z"),
      order("k", "cancelled", "2026-10-01T10:00:00Z"),
      ...Array.from({ length: 12 }, (_, i) => order(`p${i}`, "pending", `2026-10-0${1 + (i % 4)}T1${i % 10}:00:00Z`)),
      order("p0", "pending", "2026-10-01T10:00:00Z"),
    ];
    const out = prioritizeWorkQueue(rows);
    expect(out).toHaveLength(WORK_QUEUE_LIMIT);
    expect(new Set(ids(out)).size).toBe(out.length);
    expect(out.every((o) => o.status === "pending")).toBe(true);
    expect(prioritizeWorkQueue(rows, 2)).toHaveLength(2);
    expect(prioritizeWorkQueue(rows, -1)).toEqual([]);
  });

  it("no muta la lista original", () => {
    const rows = [order("c", "confirmed", "2026-10-01T10:00:00Z"), order("p", "pending", "2026-10-02T10:00:00Z")];
    prioritizeWorkQueue(rows);
    expect(ids(rows)).toEqual(["c", "p"]);
  });
});

describe("groupWorkQueue", () => {
  it("agrupa en orden y sin grupos vacíos", () => {
    expect(groupWorkQueue([{ status: "pending" }, { status: "pending" }, { status: "confirmed" }, { status: "preparing" }])).toEqual([
      { group: "confirm", items: [{ status: "pending" }, { status: "pending" }] },
      { group: "fulfil", items: [{ status: "confirmed" }, { status: "preparing" }] },
    ]);
    expect(groupWorkQueue([{ status: "preparing" }])).toEqual([{ group: "fulfil", items: [{ status: "preparing" }] }]);
    expect(groupWorkQueue([])).toEqual([]);
  });
});

describe("todoHeadline", () => {
  it("singular, plural y miles", () => {
    expect(todoHeadline(1, true)).toBe("Tenés 1 cosa para resolver");
    expect(todoHeadline(7, true)).toBe("Tenés 7 cosas para resolver");
    expect(todoHeadline(1200, true)).toBe("Tenés 1.200 cosas para resolver");
  });

  it("sin pendientes: listo por hoy, o nada si todavía no hubo pedidos", () => {
    expect(todoHeadline(0, true)).toBe("Listo por hoy");
    expect(todoHeadline(0, false)).toBeNull();
  });
});
