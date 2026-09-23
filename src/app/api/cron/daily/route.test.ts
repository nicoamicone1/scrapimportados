import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const rpc = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ createPublicClient: () => ({ rpc }) }));
vi.mock("@/lib/email/trial-notices", () => ({
  collectTrialNotices: vi.fn(async () => null),
  deliverTrialNotices: vi.fn(async () => ({ trial_ending: 0, trial_ended: 0 })),
}));
vi.mock("@/lib/email/activation-notices", () => ({
  collectActivationNotices: vi.fn(async () => null),
  deliverActivationNotices: vi.fn(async () => ({})),
}));

import { NextRequest } from "next/server";

import { GET } from "./route";

function request(authorization?: string): NextRequest {
  return new NextRequest("https://www.ecommy.app/api/cron/daily", {
    headers: authorization === undefined ? {} : { authorization },
  });
}

describe("GET /api/cron/daily", () => {
  beforeEach(() => {
    rpc.mockReset();
    rpc.mockResolvedValue({ data: { trials_expired: 0, orders_expired: 0 }, error: null });
    vi.stubEnv("CRON_SECRET", "s3creto-largo");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("secreto incorrecto, de otro largo o ausente → 401 sin tocar la base", async () => {
    for (const auth of ["Bearer s3creto-larga", "Bearer s3", "s3creto-largo", "", undefined]) {
      const res = await GET(request(auth));
      expect(res.status).toBe(401);
    }
    expect(rpc).not.toHaveBeenCalled();
  });

  it("sin CRON_SECRET configurado → 401 aunque manden 'Bearer '", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await GET(request("Bearer "))).status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("secreto correcto → corre el mantenimiento", async () => {
    const res = await GET(request("Bearer s3creto-largo"));
    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("run_daily_maintenance");
  });
});
