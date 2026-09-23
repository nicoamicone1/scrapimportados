import { createHmac } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (fn: () => unknown) => void fn(),
}));
vi.mock("./service", () => ({ billingServiceClient: vi.fn(() => ({ fake: true })) }));
vi.mock("./notify", () => ({ sendBillingEmail: vi.fn(async () => undefined) }));
vi.mock("./sync", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./sync")>()),
  processNotification: vi.fn(),
  supabaseBillingRepo: vi.fn(() => ({})),
}));

import { NextRequest } from "next/server";

import { POST } from "@/app/api/billing/mercadopago/webhook/route";

import { sendBillingEmail } from "./notify";
import { processNotification } from "./sync";

const SECRET = "whsec_test";

function request(opts: { dataId?: string; type?: string; body?: unknown; signature?: string | null; requestId?: string }) {
  const dataId = opts.dataId ?? "pre_1";
  const requestId = opts.requestId ?? "req-1";
  const ts = "1704908010";
  const sig =
    opts.signature === undefined
      ? `ts=${ts},v1=${createHmac("sha256", SECRET).update(`id:${dataId.toLowerCase()};request-id:${requestId};ts:${ts};`).digest("hex")}`
      : opts.signature;
  const headers: Record<string, string> = { "content-type": "application/json", "x-request-id": requestId };
  if (sig) headers["x-signature"] = sig;
  const body = opts.body ?? { id: 555, type: opts.type ?? "subscription_preapproval", action: "updated", data: { id: dataId } };
  return new NextRequest(`https://www.ecommy.app/api/billing/mercadopago/webhook?data.id=${dataId}&type=${opts.type ?? "subscription_preapproval"}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

describe("POST /api/billing/mercadopago/webhook", () => {
  beforeEach(() => {
    vi.stubEnv("MP_ACCESS_TOKEN", "APP_USR-test");
    vi.stubEnv("MP_WEBHOOK_SECRET", SECRET);
    vi.mocked(processNotification).mockReset();
    vi.mocked(sendBillingEmail).mockClear();
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("503 sin credenciales de MercadoPago", async () => {
    vi.stubEnv("MP_ACCESS_TOKEN", "");
    expect((await POST(request({}))).status).toBe(503);
  });

  it("401 con firma inválida o ausente", async () => {
    expect((await POST(request({ signature: "ts=1,v1=" + "0".repeat(64) }))).status).toBe(401);
    expect((await POST(request({ signature: null }))).status).toBe(401);
    expect(processNotification).not.toHaveBeenCalled();
  });

  it("200 con firma válida aunque el tipo no interese", async () => {
    const res = await POST(request({ type: "payment", dataId: "123" }));
    expect(res.status).toBe(200);
    expect(processNotification).not.toHaveBeenCalled();
  });

  it("procesa el aviso con el id de la notificación como event_id y manda el mail después", async () => {
    vi.mocked(processNotification).mockResolvedValueOnce({
      outcome: "applied",
      storeId: "3f1c2a9e-8b7d-4c6e-9a5f-1b2c3d4e5f60",
      preapprovalId: "pre_1",
      paymentId: null,
      previous: {} as never,
      decision: {
        status: "active",
        planCode: "pro",
        periodStart: null,
        periodEnd: null,
        providerStatus: "authorized",
        cancelAtPeriodEnd: false,
        lastPaymentAt: null,
        email: "activated",
      },
    });
    const res = await POST(request({}));
    expect(res.status).toBe(200);
    expect(vi.mocked(processNotification).mock.calls[0][0]).toMatchObject({ eventId: "555", type: "subscription_preapproval", dataId: "pre_1" });
    expect(sendBillingEmail).toHaveBeenCalledTimes(1);
  });

  it("500 si MP o la base fallan (MP reintenta)", async () => {
    vi.mocked(processNotification).mockRejectedValueOnce(new Error("MercadoPago GET /preapproval/pre_1: HTTP 500"));
    expect((await POST(request({}))).status).toBe(500);
  });
});
