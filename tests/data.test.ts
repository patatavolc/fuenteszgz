import { describe, expect, it } from "vitest";
import { deduplicateFountains, distanceMeters, findNearby, normalizeMunicipalData, normalizeOsmData } from "@/lib/data";
import type { Fountain } from "@/lib/types";

const fountain = (id: string, lat: number, lon: number, overrides: Partial<Fountain> = {}): Fountain => ({
  id, name: `Fuente ${id}`, lat, lon, status: "desconocida", source: "Ayuntamiento de Zaragoza", sourceUrl: "https://example.org", confidence: "alta", ...overrides,
});

describe("normalización municipal", () => {
  it("normaliza coordenadas WGS84 y campos de ubicación", () => {
    const data = normalizeMunicipalData({ features: [{ id: "f.1", geometry: { type: "Point", coordinates: [-0.88, 41.65] }, properties: { codigo: "F1", vial: " Calle Mayor ", ubicacion: "Parque Central", en_servicio: true } }] });
    expect(data).toHaveLength(1);
    expect(data[0]).toMatchObject({ id: "municipal:F1", lat: 41.65, lon: -0.88, address: "Calle Mayor", status: "operativa", isGreenArea: true });
  });

  it("descarta registros sin coordenadas válidas o identificador", () => {
    const data = normalizeMunicipalData({ features: [
      { id: "x", geometry: { type: "Point", coordinates: [220, 41] }, properties: { codigo: "bad" } },
      { id: "", geometry: { type: "Point", coordinates: [-.8, 41] }, properties: {} },
    ] });
    expect(data).toEqual([]);
  });

  it("deduplica solo coincidencias plausibles sin fusionar fuentes distintas", () => {
    const a = fountain("a", 41.65, -.88, { name: "Fuente A" });
    const near = fountain("b", 41.65001, -.88, { name: "Fuente A" });
    const other = fountain("osm", 41.65, -.88, { name: "Fuente A", source: "OpenStreetMap (comunidad)" });
    expect(deduplicateFountains([a, near, other])).toHaveLength(2);
  });

  it("acepta únicamente etiquetas OSM explícitas y conserva procedencia/estacionalidad", () => {
    const data = normalizeOsmData({ timestamp: "2026-10-16T10:41:20Z", features: [
      { id: "node/1", geometry: { type: "Point", coordinates: [-.88, 41.65] }, properties: { tags: { amenity: "drinking_water", seasonal: "summer" } } },
      { id: "node/2", geometry: { type: "Point", coordinates: [-.88, 41.65] }, properties: { tags: { amenity: "drinking_water", access: "private" } } },
      { id: "node/3", geometry: { type: "Point", coordinates: [-.88, 41.65] }, properties: { tags: { amenity: "fountain" } } },
    ] });
    expect(data).toHaveLength(1);
    expect(data[0]).toMatchObject({ id: "osm:node/1", source: "OpenStreetMap (comunidad)", status: "desconocida", seasonal: "summer", sourceUpdatedAt: "2026-10-16T10:41:20Z" });
  });
});

describe("distancias, orden y filtros", () => {
  it("calcula distancia geodésica y ordena los resultados más cercanos", () => {
    const origin = { lat: 41.65, lon: -.88 };
    expect(distanceMeters(origin, { lat: 41.651, lon: -.88 })).toBeGreaterThan(100);
    const results = findNearby([fountain("lejos", 41.66, -.88), fountain("cerca", 41.6501, -.88)], origin, { maxDistanceKm: 2, greenOnly: false, status: "todas" });
    expect(results.map(({ fountain: item }) => item.id)).toEqual(["cerca", "lejos"]);
  });

  it("combina límite de distancia, zona verde y estado", () => {
    const origin = { lat: 41.65, lon: -.88 };
    const values = [
      fountain("ok", 41.6501, -.88, { status: "operativa", isGreenArea: true }),
      fountain("unknown", 41.6502, -.88, { status: "desconocida", isGreenArea: true }),
      fountain("street", 41.6501, -.88, { status: "operativa", isGreenArea: false }),
      fountain("far", 41.68, -.88, { status: "operativa", isGreenArea: true }),
    ];
    expect(findNearby(values, origin, { maxDistanceKm: 1, greenOnly: true, status: "operativa" }).map(({ fountain: item }) => item.id)).toEqual(["ok"]);
  });

  it("permite excluir solo los puntos marcados estacionales", () => {
    const origin = { lat: 41.65, lon: -.88 };
    const values = [fountain("seasonal", 41.6501, -.88, { seasonal: true }), fountain("unknown-season", 41.6502, -.88)];
    expect(findNearby(values, origin, { maxDistanceKm: 1, greenOnly: false, status: "todas", excludeSeasonal: true }).map(({ fountain: item }) => item.id)).toEqual(["unknown-season"]);
  });
});
