import { describe, expect, it } from "vitest";
import municipalSnapshot from "@/data/municipal-snapshot.geojson";
import { buildPrioritizedDisplaySet, deduplicateFountains, distanceMeters, findNearby, normalizeMunicipalData, normalizeMunicipalDataWithReport, normalizeOsmDataWithReport } from "@/lib/data";
import type { Fountain } from "@/lib/types";

const fountain = (id: string, lat: number, lon: number, overrides: Partial<Fountain> = {}): Fountain => ({
  id, name: `Fuente ${id}`, lat, lon, status: "desconocida", source: "Ayuntamiento de Zaragoza", sourceUrl: "https://example.org", confidence: "alta", ...overrides,
});

describe("normalización municipal", () => {
  it("normaliza coordenadas WGS84 y campos de ubicación", () => {
    const data = normalizeMunicipalData({ type: "FeatureCollection", features: [{ type: "Feature", id: "f.1", geometry: { type: "Point", coordinates: [-0.88, 41.65] }, properties: { codigo: "F1", vial: " Calle Mayor ", ubicacion: "Parque Central", en_servicio: true } }] });
    expect(data).toHaveLength(1);
    expect(data[0]).toMatchObject({ id: "municipal:F1", lat: 41.65, lon: -0.88, address: "Calle Mayor", status: "operativa", isGreenArea: true });
  });

  it("descarta registros sin coordenadas válidas o identificador", () => {
    const data = normalizeMunicipalData({ type: "FeatureCollection", features: [
      { type: "Feature", id: "x", geometry: { type: "Point", coordinates: [220, 41] }, properties: { codigo: "bad" } },
      { type: "Feature", id: "", geometry: { type: "Point", coordinates: [-.8, 41] }, properties: {} },
    ] });
    expect(data).toEqual([]);
  });

  it("expone conteos y causas de descarte al normalizar", () => {
    const result = normalizeMunicipalDataWithReport({ type: "FeatureCollection", features: [
      { type: "Feature", id: "good", geometry: { type: "Point", coordinates: [-.8, 41] }, properties: { codigo: "F1" } },
      { type: "Feature", id: "bad", geometry: { type: "Point", coordinates: [181, 41] }, properties: { codigo: "F2" } },
    ] });
    expect(result.fountains).toHaveLength(1);
    expect(result.report).toMatchObject({ total: 2, accepted: 1, discarded: 1, discardedByReason: { "invalid-coordinate": 1 } });
  });

  it("deduplica solo coincidencias plausibles sin fusionar fuentes distintas", () => {
    const a = fountain("a", 41.65, -.88, { name: "Fuente A" });
    const near = fountain("b", 41.65001, -.88, { name: "Fuente A" });
    const other = fountain("osm", 41.65, -.88, { name: "Fuente A", source: "OpenStreetMap (comunidad)" });
    expect(deduplicateFountains([a, near, other])).toHaveLength(3);
  });

  it("conserva fuentes municipales distintas con códigos oficiales aunque compartan nombre y ubicación", () => {
    const result = normalizeMunicipalData({ type: "FeatureCollection", features: [
      { type: "Feature", id: "source.1", geometry: { type: "Point", coordinates: [-.88, 41.65] }, properties: { codigo: "F1", vial: "Calle Mayor" } },
      { type: "Feature", id: "source.2", geometry: { type: "Point", coordinates: [-.880001, 41.65] }, properties: { codigo: "F2", vial: "Calle Mayor" } },
    ] });

    expect(result.map(({ officialCode }) => officialCode)).toEqual(["F1", "F2"]);
  });

  it("conserva todos los registros del snapshot municipal actual", () => {
    const snapshot = municipalSnapshot as { features: unknown[] };
    expect(normalizeMunicipalData(snapshot)).toHaveLength(snapshot.features.length);
  });

  it("no atribuye a la base OSM una fecha local generada", () => {
    const { fountains } = normalizeOsmDataWithReport({ type: "FeatureCollection", generatedAt: "2026-10-18T10:00:00Z", features: [
      { type: "Feature", id: "node/1", geometry: { type: "Point", coordinates: [-.88, 41.65] }, properties: { tags: { amenity: "drinking_water" } } },
    ] });

    expect(fountains[0].sourceUpdatedAt).toBeUndefined();
    expect(fountains[0].snapshotGeneratedAt).toBe("2026-10-18T10:00:00Z");
  });

  it("normaliza identificadores OSM válidos con prefijo para la interfaz y el enlace de origen", () => {
    const { fountains, report } = normalizeOsmDataWithReport({ type: "FeatureCollection", features: [
      { type: "Feature", id: "osm:node/9", geometry: { type: "Point", coordinates: [-.88, 41.65] }, properties: { tags: { amenity: "drinking_water" } } },
    ] });

    expect(report).toMatchObject({ accepted: 1, discarded: 0 });
    expect(fountains[0]).toMatchObject({ id: "osm:node/9", sourceUrl: "https://www.openstreetmap.org/node/9" });
  });

  it("acepta únicamente etiquetas OSM explícitas y conserva procedencia/estacionalidad", () => {
    const { fountains: data, report } = normalizeOsmDataWithReport({ type: "FeatureCollection", timestamp: "2026-10-16T10:41:20Z", features: [
      { type: "Feature", id: "node/1", geometry: { type: "Point", coordinates: [-.88, 41.65] }, properties: { tags: { amenity: "drinking_water", seasonal: "summer" } } },
      { type: "Feature", id: "node/2", geometry: { type: "Point", coordinates: [-.88, 41.65] }, properties: { tags: { amenity: "drinking_water", access: "private" } } },
      { type: "Feature", id: "node/3", geometry: { type: "Point", coordinates: [-.88, 41.65] }, properties: { tags: { amenity: "fountain" } } },
    ] });
    expect(data).toHaveLength(1);
    expect(data[0]).toMatchObject({ id: "osm:node/1", source: "OpenStreetMap (comunidad)", status: "desconocida", seasonal: "summer", sourceUpdatedAt: "2026-10-16T10:41:20Z" });
    expect(report).toMatchObject({ total: 3, accepted: 1, discarded: 2, discardedByReason: { "restricted-access": 1, "non-candidate": 1 } });
  });
});

describe("distancias, orden y filtros", () => {
  it("prioriza el registro municipal y adjunta el OSM con calle coincidente", () => {
    const city = fountain("municipal:F1", 41.65, -.88, { address: "CALLE CALLE MAYOR (00012) 10" });
    const community = fountain("osm:node/1", 41.65001, -.88, {
      source: "OpenStreetMap (comunidad)", address: "Calle Mayor 10", osmTags: { "addr:street": "Calle Mayor", amenity: "drinking_water" },
    });
    const display = buildPrioritizedDisplaySet([city], [community]);
    expect(display).toHaveLength(1);
    expect(display[0]).toMatchObject({ id: city.id, source: "Ayuntamiento de Zaragoza", matchedOsm: [{ id: community.id }] });
  });

  it("conserva como pines separados los candidatos cercanos sin evidencia común", () => {
    const city = fountain("municipal:F1", 41.65, -.88, { address: "Calle Mayor 10" });
    const community = fountain("osm:node/1", 41.65001, -.88, {
      source: "OpenStreetMap (comunidad)", address: "Calle Nueva 10", osmTags: { "addr:street": "Calle Nueva" },
    });
    expect(buildPrioritizedDisplaySet([city], [community]).map(({ id }) => id)).toEqual([city.id, community.id]);
  });

  it("deja separadas las relaciones ambiguas y mantiene candidatos OSM no emparejados", () => {
    const city = fountain("municipal:F1", 41.65, -.88, { address: "Calle Mayor 10" });
    const osmA = fountain("osm:node/1", 41.65001, -.88, { source: "OpenStreetMap (comunidad)", address: "Calle Mayor 10", osmTags: { "addr:street": "Calle Mayor" } });
    const osmB = fountain("osm:node/2", 41.65001, -.88, { source: "OpenStreetMap (comunidad)", address: "Calle Mayor 10", osmTags: { "addr:street": "Calle Mayor" } });
    const display = buildPrioritizedDisplaySet([city], [osmA, osmB]);
    expect(display.map(({ id }) => id)).toEqual([city.id, osmA.id, osmB.id]);
    expect(display[0].matchedOsm).toBeUndefined();
  });

  it("usa la etiqueta estacional comunitaria solo como evidencia del filtro, sin reemplazar el registro municipal", () => {
    const city = fountain("municipal:F1", 41.65, -.88, { location: "Parque del Agua" });
    const community = fountain("osm:node/1", 41.65001, -.88, { source: "OpenStreetMap (comunidad)", location: "Parque del Agua", seasonal: "summer" });
    const [prioritized] = buildPrioritizedDisplaySet([city], [community]);
    const results = findNearby([prioritized], { lat: 41.65, lon: -.88 }, { maxDistanceKm: 1, greenOnly: false, status: "todas", excludeSeasonal: true });
    expect(prioritized.source).toBe("Ayuntamiento de Zaragoza");
    expect(results).toHaveLength(0);
  });

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
