import { beforeEach, describe, expect, it } from "vitest";
import { getFavorites, getIncidents, saveFavorite, saveIncident } from "@/lib/local-storage";
import { geolocationStateFromError } from "@/lib/geolocation";
import { incidentSchema } from "@/lib/validation";

const memory = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => memory.set(key, value),
  removeItem: (key: string) => memory.delete(key),
} });

beforeEach(() => memory.clear());

describe("favoritos e incidencias locales", () => {
  it("añade y elimina favoritos sin duplicados", () => {
    expect(saveFavorite("f1")).toEqual(["f1"]);
    expect(saveFavorite("f2")).toEqual(["f1", "f2"]);
    expect(getFavorites()).toEqual(["f1", "f2"]);
    expect(saveFavorite("f1")).toEqual(["f2"]);
  });

  it("recupera con seguridad datos corruptos y filtra incidencias inválidas", () => {
    memory.set("fuenteszgz:favorites:v1", "{");
    memory.set("fuenteszgz:incidents:v1", JSON.stringify([{ bad: true }]));
    expect(getFavorites()).toEqual([]);
    expect(getIncidents()).toEqual([]);
  });

  it("valida y guarda observaciones con fecha y tipo admitido", () => {
    const incident = { id: "x1", fountainId: "municipal:F1", kind: "averiada", observedAt: new Date().toISOString(), note: "No sale agua" } as const;
    expect(incidentSchema.safeParse(incident).success).toBe(true);
    expect(saveIncident(incident)).toBe(true);
    expect(getIncidents()).toHaveLength(1);
    expect(incidentSchema.safeParse({ ...incident, kind: "confirmada-oficial" }).success).toBe(false);
  });
});

describe("estados de geolocalización", () => {
  it("clasifica permisos denegados y ubicación no disponible", () => {
    expect(geolocationStateFromError(1)).toBe("denegada");
    expect(geolocationStateFromError(2)).toBe("no-disponible");
    expect(geolocationStateFromError(3)).toBe("no-disponible");
  });
});
