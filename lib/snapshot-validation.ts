export type SnapshotSource = "municipal" | "osm";
export type SnapshotDiscardReason =
  | "invalid-collection"
  | "invalid-feature"
  | "invalid-properties"
  | "invalid-property-type"
  | "invalid-geometry"
  | "invalid-coordinate"
  | "missing-id"
  | "duplicate-id"
  | "invalid-tags"
  | "restricted-access"
  | "non-potable"
  | "non-candidate";

export type SnapshotFeature = {
  type: "Feature";
  id?: string | number;
  geometry: { type: "Point"; coordinates: number[] };
  properties: Record<string, unknown>;
};

export type SnapshotValidationReport = {
  source: SnapshotSource;
  total: number;
  accepted: number;
  normalized: number;
  discarded: number;
  discardedByReason: Partial<Record<SnapshotDiscardReason, number>>;
  discardDetails: Array<{ index: number; id?: string | number; reason: SnapshotDiscardReason }>;
  warnings: Array<{ index: number; id?: string | number; reason: "outside-query-bounds" }>;
};

export type SnapshotValidationResult = { features: SnapshotFeature[]; report: SnapshotValidationReport };

export function compareSnapshotIds(previous: unknown, next: unknown, source: SnapshotSource): { added: string[]; removed: string[] } {
  const ids = (input: unknown, label: string, missingAllowed = false): Set<string> => {
    if (input === undefined && missingAllowed) return new Set();
    const validation = validateSnapshot(input, source);
    if (!validation.features.length || validation.report.discarded > 0) {
      throw new Error(`${label} inválido: ${formatSnapshotValidationReport(validation.report)}`);
    }
    return new Set(validation.features.flatMap((feature) => {
      if (!isRecord(feature)) return [];
      if (source === "municipal") {
        if (!isRecord(feature.properties)) return [];
        const value = feature.properties.codigo ?? feature.id;
        return typeof value === "string" || (typeof value === "number" && Number.isFinite(value)) ? [String(value).trim()] : [];
      }
      return typeof feature.id === "string" ? [normalizeOsmId(feature.id)] : [];
    }).filter(Boolean));
  };
  const previousIds = ids(previous, "Snapshot anterior", true);
  const nextIds = ids(next, "Snapshot nuevo");
  return {
    added: [...nextIds].filter((id) => !previousIds.has(id)).sort(),
    removed: [...previousIds].filter((id) => !nextIds.has(id)).sort(),
  };
}

const municipalTextFields = ["ubicacion", "vial", "distrito", "barrio", "color", "superficie"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function printableId(value: unknown): string | number | undefined {
  return typeof value === "string" || (typeof value === "number" && Number.isFinite(value)) ? value : undefined;
}

function normalizeOsmId(value: string): string {
  const id = value.trim();
  return id.startsWith("osm:") ? id.slice(4) : id;
}

export function validateSnapshot(input: unknown, source: SnapshotSource): SnapshotValidationResult {
  const discardDetails: SnapshotValidationReport["discardDetails"] = [];
  const warnings: SnapshotValidationReport["warnings"] = [];
  const discardedByReason: SnapshotValidationReport["discardedByReason"] = {};
  const discard = (index: number, id: string | number | undefined, reason: SnapshotDiscardReason) => {
    discardedByReason[reason] = (discardedByReason[reason] ?? 0) + 1;
    discardDetails.push({ index, ...(id !== undefined ? { id } : {}), reason });
  };

  if (!isRecord(input) || input.type !== "FeatureCollection" || !Array.isArray(input.features)) {
    discard(-1, undefined, "invalid-collection");
    return {
      features: [],
      report: { source, total: 0, accepted: 0, normalized: 0, discarded: 1, discardedByReason, discardDetails, warnings },
    };
  }

  const valid: SnapshotFeature[] = [];
  const seenIds = new Set<string>();
  const bounds = source === "osm" && typeof input.queryBounds === "string"
    ? input.queryBounds.split(",").map(Number) : [];
  const queryBounds = bounds.length === 4 && bounds.every(Number.isFinite)
    ? { south: bounds[0], west: bounds[1], north: bounds[2], east: bounds[3] } : undefined;
  input.features.forEach((item: unknown, index: number) => {
    if (!isRecord(item)) { discard(index, undefined, "invalid-feature"); return; }
    const id = printableId(item.id);
    if (item.type !== "Feature") { discard(index, id, "invalid-feature"); return; }
    if (!isRecord(item.properties)) { discard(index, id, "invalid-properties"); return; }
    const properties = item.properties;
    let logicalId: string;

    if (source === "municipal") {
      const code = properties.codigo;
      if (code !== undefined && code !== null && !(typeof code === "string" || (typeof code === "number" && Number.isFinite(code)))) {
        discard(index, id, "invalid-property-type"); return;
      }
      if (properties.en_servicio !== undefined && properties.en_servicio !== null && typeof properties.en_servicio !== "boolean") {
        discard(index, id, "invalid-property-type"); return;
      }
      if (municipalTextFields.some((field) => properties[field] !== undefined && properties[field] !== null && typeof properties[field] !== "string")) {
        discard(index, id, "invalid-property-type"); return;
      }
      const codeText = String(code ?? id ?? "").trim();
      if (!codeText) { discard(index, id, "missing-id"); return; }
      logicalId = codeText;
    } else {
      if (typeof item.id !== "string" || !item.id.trim()) { discard(index, id, "missing-id"); return; }
      logicalId = normalizeOsmId(item.id);
      if (!logicalId) { discard(index, id, "missing-id"); return; }
      if (!isRecord(properties.tags) || Object.values(properties.tags).some((tag) => typeof tag !== "string")) {
        discard(index, id, "invalid-tags"); return;
      }
      const tags = properties.tags as Record<string, string>;
      if (tags.access === "no" || tags.access === "private") { discard(index, id, "restricted-access"); return; }
      if (tags.drinking_water === "no") { discard(index, id, "non-potable"); return; }
      const isCandidate = tags.amenity === "drinking_water"
        || (tags.amenity === "fountain" && (tags.fountain === "drinking" || tags.drinking_water === "yes"));
      if (!isCandidate) { discard(index, id, "non-candidate"); return; }
    }

    if (!isRecord(item.geometry) || item.geometry.type !== "Point") { discard(index, id, "invalid-geometry"); return; }
    const coordinates = item.geometry.coordinates;
    if (!Array.isArray(coordinates) || coordinates.length < 2
      || coordinates.some((coordinate) => typeof coordinate !== "number" || !Number.isFinite(coordinate))) {
      discard(index, id, "invalid-coordinate"); return;
    }
    const [lon, lat] = coordinates;
    if (Math.abs(lon) > 180 || Math.abs(lat) > 90) { discard(index, id, "invalid-coordinate"); return; }
    if (seenIds.has(logicalId)) { discard(index, id, "duplicate-id"); return; }
    seenIds.add(logicalId);
    if (queryBounds && (lat < queryBounds.south || lat > queryBounds.north || lon < queryBounds.west || lon > queryBounds.east)) {
      warnings.push({ index, ...(id !== undefined ? { id } : {}), reason: "outside-query-bounds" });
    }

    valid.push(item as unknown as SnapshotFeature);
  });

  const total = input.features.length;
  return {
    features: valid,
    report: { source, total, accepted: valid.length, normalized: valid.length, discarded: discardDetails.length, discardedByReason, discardDetails, warnings },
  };
}

export function meetsSnapshotCoverage(accepted: number, expected: number, minimumRatio = 0.95): boolean {
  return expected > 0 && accepted / expected >= minimumRatio;
}

export function formatSnapshotValidationReport(report: SnapshotValidationReport): string {
  const sourceName = report.source === "municipal" ? "Municipal" : "OSM";
  const summary = `${sourceName}: ${report.accepted}/${report.total} registros válidos; ${report.discarded} descartados; ${report.normalized} normalizados`;
  if (!report.discarded && !report.warnings.length) return summary;
  const reasons = Object.entries(report.discardedByReason).map(([reason, count]) => `${reason}=${count}`).join(", ");
  const details = report.discardDetails.map(({ index, id, reason }) => `índice ${index}${id !== undefined ? ` (${id})` : ""}: ${reason}`).join("; ");
  const discardedSummary = report.discarded ? ` (${reasons}). Detalle: ${details}` : "";
  const warnings = report.warnings.length ? ` Advertencias: ${report.warnings.map(({ index, id, reason }) => `índice ${index}${id !== undefined ? ` (${id})` : ""}: ${reason}`).join("; ")}` : "";
  return `${summary}${discardedSummary}${warnings}`;
}
