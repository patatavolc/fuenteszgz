import { describe, expect, it } from "vitest";
import { formatSnapshotValidationReport, meetsSnapshotCoverage, validateSnapshot } from "@/lib/snapshot-validation";

describe("validación común de snapshots", () => {
  it("valida tipos, coordenadas e identificadores municipales y reporta cada descarte", () => {
    const result = validateSnapshot({ type: "FeatureCollection", features: [
      { type: "Feature", id: "source.1", geometry: { type: "Point", coordinates: [-.88, 41.65] }, properties: { codigo: "F1", en_servicio: true } },
      { type: "Feature", id: "source.2", geometry: { type: "LineString", coordinates: [] }, properties: { codigo: "F2" } },
      { type: "Feature", id: "source.3", geometry: { type: "Point", coordinates: [181, 41] }, properties: { codigo: "F3" } },
      { type: "Feature", id: "source.4", geometry: { type: "Point", coordinates: [-.88, 41] }, properties: { codigo: "F4", en_servicio: "yes" } },
    ] }, "municipal");

    expect(result.features).toHaveLength(1);
    expect(result.report).toMatchObject({
      source: "municipal", total: 4, accepted: 1, normalized: 1, discarded: 3,
      discardedByReason: { "invalid-geometry": 1, "invalid-coordinate": 1, "invalid-property-type": 1 },
    });
    expect(result.report.discardDetails).toEqual([
      { index: 1, id: "source.2", reason: "invalid-geometry" },
      { index: 2, id: "source.3", reason: "invalid-coordinate" },
      { index: 3, id: "source.4", reason: "invalid-property-type" },
    ]);
  });

  it("exige etiquetas candidatas explícitas y excluye agua no potable o acceso restringido", () => {
    const result = validateSnapshot({ type: "FeatureCollection", features: [
      { type: "Feature", id: "node/1", geometry: { type: "Point", coordinates: [-.88, 41.65] }, properties: { tags: { amenity: "drinking_water", access: "yes" } } },
      { type: "Feature", id: "node/2", geometry: { type: "Point", coordinates: [-.88, 41.65] }, properties: { tags: { amenity: "drinking_water", access: "private" } } },
      { type: "Feature", id: "node/3", geometry: { type: "Point", coordinates: [-.88, 41.65] }, properties: { tags: { amenity: "drinking_water", access: "no" } } },
      { type: "Feature", id: "node/4", geometry: { type: "Point", coordinates: [-.88, 41.65] }, properties: { tags: { amenity: "drinking_water", drinking_water: "no" } } },
      { type: "Feature", id: "node/5", geometry: { type: "Point", coordinates: [-.88, 41.65] }, properties: { tags: { amenity: "fountain" } } },
    ] }, "osm");

    expect(result.features.map(({ id }) => id)).toEqual(["node/1"]);
    expect(result.report).toMatchObject({
      source: "osm", total: 5, accepted: 1, discarded: 4,
      discardedByReason: { "restricted-access": 2, "non-potable": 1, "non-candidate": 1 },
    });
  });

  it("informa cuando la colección o las etiquetas no tienen el tipo esperado", () => {
    const result = validateSnapshot({ type: "FeatureCollection", features: [
      { type: "Feature", id: "node/1", geometry: { type: "Point", coordinates: [-.88, 41.65] }, properties: { tags: ["amenity", "drinking_water"] } },
    ] }, "osm");
    const invalidCollection = validateSnapshot({ features: [] }, "municipal");

    expect(result.report.discardedByReason).toEqual({ "invalid-tags": 1 });
    expect(invalidCollection.report).toMatchObject({ total: 0, accepted: 0, normalized: 0, discarded: 1, discardedByReason: { "invalid-collection": 1 } });
    expect(formatSnapshotValidationReport(result.report)).toContain("OSM: 0/1 registros válidos; 1 descartados; 0 normalizados");
  });

  it("conserva la regla de cobertura mínima al comparar conteos válidos con el WFS", () => {
    expect(meetsSnapshotCoverage(95, 100)).toBe(true);
    expect(meetsSnapshotCoverage(94, 100)).toBe(false);
    expect(meetsSnapshotCoverage(0, 0)).toBe(false);
  });
});
