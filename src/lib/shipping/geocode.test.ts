import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { buildAddressQuery, clearGeocodeCache, geocodeAddress, reverseGeocode } from "./geocode";

type FetchArgs = [string, RequestInit | undefined];

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}

const SANTA_FE_3253 = {
  lat: "-34.5881",
  lon: "-58.4103",
  display_name: "3253, Avenida Santa Fe, Palermo, Buenos Aires, Ciudad Autónoma de Buenos Aires, Argentina",
  place_rank: 30,
  addresstype: "building",
  boundingbox: ["-34.5882", "-34.5880", "-58.4104", "-58.4102"],
  address: { house_number: "3253", road: "Avenida Santa Fe", city: "Buenos Aires", "ISO3166-2-lvl4": "AR-C", postcode: "C1425" },
};

describe("geocode", () => {
  let calls: FetchArgs[];

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "Date"] });
    clearGeocodeCache();
    calls = [];
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  function stubFetch(responses: unknown[]) {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push([url, init]);
        return jsonResponse(responses.shift() ?? []);
      }),
    );
  }

  it("arma la query con provincia normalizada y sin repetir la ciudad", () => {
    expect(buildAddressQuery({ street: "Av. Santa Fe", number: "3253", city: "CABA", province: "Capital Federal" })).toBe(
      "Av. Santa Fe 3253, Ciudad Autónoma de Buenos Aires, Argentina",
    );
    expect(buildAddressQuery({ street: "Calle 7", number: "1200", city: "La Plata", province: "AR-B" }, false)).toBe(
      "Calle 7, La Plata, Buenos Aires, Argentina",
    );
  });

  it("geocodifica con UA propio, jsonv2 y countrycodes=ar", async () => {
    stubFetch([[SANTA_FE_3253]]);
    const promise = geocodeAddress({ street: "Av. Santa Fe", number: "3253", city: "CABA", province: "AR-C" });
    await vi.runAllTimersAsync();
    const res = await promise;
    expect(res).toMatchObject({ lat: -34.5881, lng: -58.4103, confidence: "high", province: "AR-C" });
    const [url, init] = calls[0];
    expect(url).toContain("https://nominatim.openstreetmap.org/search?");
    expect(url).toContain("format=jsonv2");
    expect(url).toContain("countrycodes=ar");
    expect(url).toContain("limit=5");
    expect((init?.headers as Record<string, string>)["User-Agent"]).toMatch(/^Ecommy\/0\.0/);
  });

  it("reintenta sin número si no encuentra la altura (confianza medium)", async () => {
    stubFetch([[], [{ ...SANTA_FE_3253, place_rank: 26, address: { ...SANTA_FE_3253.address, house_number: undefined } }]]);
    const promise = geocodeAddress({ street: "Av. Santa Fe", number: "99999", city: "CABA", province: "CABA" });
    await vi.runAllTimersAsync();
    const res = await promise;
    expect(calls).toHaveLength(2);
    expect(decodeURIComponent(calls[1][0])).not.toContain("99999");
    expect(res?.confidence).toBe("medium");
  });

  it("baja la confianza si la provincia no coincide", async () => {
    stubFetch([[SANTA_FE_3253]]);
    const promise = geocodeAddress({ street: "Santa Fe", number: "3253", city: "Rosario", province: "Santa Fe" });
    await vi.runAllTimersAsync();
    expect((await promise)?.confidence).toBe("low");
  });

  it("cachea por query", async () => {
    stubFetch([[SANTA_FE_3253]]);
    const a = geocodeAddress({ street: "Av. Santa Fe", number: "3253", province: "AR-C" });
    await vi.runAllTimersAsync();
    await a;
    const b = geocodeAddress({ street: "Av. Santa Fe", number: "3253", province: "AR-C" });
    await vi.runAllTimersAsync();
    expect((await b)?.lat).toBe(-34.5881);
    expect(calls).toHaveLength(1);
  });

  it("devuelve null sin calle ni ciudad y si Nominatim falla", async () => {
    expect(await geocodeAddress({ province: "AR-C" })).toBeNull();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("rate limited", { status: 429 })),
    );
    vi.spyOn(console, "error").mockImplementation(() => {});
    const promise = geocodeAddress({ street: "Corrientes", city: "CABA" });
    await vi.runAllTimersAsync();
    expect(await promise).toBeNull();
  });

  it("reverse devuelve el punto pedido con provincia y CP", async () => {
    stubFetch([SANTA_FE_3253]);
    const promise = reverseGeocode(-34.58805, -58.41025);
    await vi.runAllTimersAsync();
    const res = await promise;
    expect(res).toMatchObject({ lat: -34.58805, lng: -58.41025, province: "AR-C", postalCode: "C1425" });
    expect(calls[0][0]).toContain("/reverse?");
  });
});

describe("geocode: calle equivocada", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "Date"] });
    clearGeocodeCache();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("si el resultado es otra calle (ej. una estación con ese nombre), reintenta sin número", async () => {
    const station = {
      lat: "-34.6041",
      lon: "-58.4053",
      display_name: "Corrientes, Avenida Pueyrredón, Once, Balvanera, Buenos Aires",
      place_rank: 30,
      address: { road: "Avenida Pueyrredón", "ISO3166-2-lvl4": "AR-C" },
    };
    const avenue = {
      lat: "-34.6044",
      lon: "-58.3958",
      display_name: "Avenida Corrientes, Balvanera, Buenos Aires",
      place_rank: 26,
      address: { road: "Avenida Corrientes", "ISO3166-2-lvl4": "AR-C" },
    };
    const responses = [[station], [avenue]];
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(responses.shift() ?? []))));
    const promise = geocodeAddress({ street: "Corrientes", number: "1234", province: "AR-C" });
    await vi.runAllTimersAsync();
    const res = await promise;
    expect(res?.lng).toBe(-58.3958);
    expect(res?.confidence).toBe("medium");
  });
});
