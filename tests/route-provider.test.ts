import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/route/route";

afterEach(() => { vi.unstubAllGlobals(); delete process.env.ORS_API_KEY; });

describe("adaptador de rutas peatonales", () => {
  const request = (payload: unknown) => new Request("http://localhost/api/route", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });

  it("responde de forma útil si el proveedor no está configurado", async () => {
    delete process.env.ORS_API_KEY;
    const response = await POST(request({ origin: { lat: 41.65, lon: -.88 }, destination: { lat: 41.66, lon: -.88 } }));
    expect(response.status).toBe(503);
  });

  it("valida coordenadas antes de llamar al proveedor", async () => {
    process.env.ORS_API_KEY = "test-key";
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    const response = await POST(request({ origin: { lat: 190, lon: 0 }, destination: { lat: 41.65, lon: -.88 } }));
    expect(response.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("traduce el límite del proveedor sin filtrar su respuesta", async () => {
    process.env.ORS_API_KEY = "test-key";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("quota", { status: 429 })));
    const response = await POST(request({ origin: { lat: 41.65, lon: -.88 }, destination: { lat: 41.66, lon: -.88 } }));
    expect(response.status).toBe(429);
    expect(await response.json()).toMatchObject({ error: expect.stringContaining("limitado") });
  });
});
