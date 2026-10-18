export type SnapshotSource = "municipal" | "osm";
export type SnapshotDiscardReason =
  | "invalid-collection"
  | "invalid-feature"
  | "invalid-properties"
  | "invalid-property-type"
  | "invalid-geometry"
  | "invalid-coordinate"
  | "missing-id"
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
};

export type SnapshotValidationResult = { features: SnapshotFeature[]; report: SnapshotValidationReport };

const municipalTextFields = ["ubicacion", "vial", "distrito", "barrio", "color", "superficie"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function printableId(value: unknown): string | number | undefined {
  return typeof value === "string" || (typeof value === "number" && Number.isFinite(value)) ? value : undefined;
}

export function validateSnapshot(input: unknown, source: SnapshotSource): SnapshotValidationResult {
  const discardDetails: SnapshotValidationReport["discardDetails"] = [];
  const discardedByReason: SnapshotValidationReport["discardedByReason"] = {};
  const discard = (index: number, id: string | number | undefined, reason: SnapshotDiscardReason) => {
    discardedByReason[reason] = (discardedByReason[reason] ?? 0) + 1;
    discardDetails.push({ index, ...(id !== undefined ? { id } : {}), reason });
  };

  if (!isRecord(input) || input.type !== "FeatureCollection" || !Array.isArray(input.features)) {
    discard(-1, undefined, "invalid-collection");
    return {
      features: [],
      report: { source, total: 0, accepted: 0, normalized: 0, discarded: 1, discardedByReason, discardDetails },
    };
  }

  const valid: SnapshotFeature[] = [];
  input.features.forEach((item: unknown, index: number) => {
    if (!isRecord(item)) { discard(index, undefined, "invalid-feature"); return; }
    const id = printableId(item.id);
    if (item.type !== "Feature") { discard(index, id, "invalid-feature"); return; }
    if (!isRecord(item.properties)) { discard(index, id, "invalid-properties"); return; }
    const properties = item.properties;

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
    } else {
      if (typeof item.id !== "string" || !item.id.trim()) { discard(index, id, "missing-id"); return; }
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

    valid.push(item as unknown as SnapshotFeature);
  });

  const total = input.features.length;
  return {
    features: valid,
    report: { source, total, accepted: valid.length, normalized: valid.length, discarded: discardDetails.length, discardedByReason, discardDetails },
  };
}

export function meetsSnapshotCoverage(accepted: number, expected: number, minimumRatio = 0.95): boolean {
  return expected > 0 && accepted / expected >= minimumRatio;
}

export function formatSnapshotValidationReport(report: SnapshotValidationReport): string {
  const sourceName = report.source === "municipal" ? "Municipal" : "OSM";
  const summary = `${sourceName}: ${report.accepted}/${report.total} registros válidos; ${report.discarded} descartados; ${report.normalized} normalizados`;
  if (!report.discarded) return summary;
  const reasons = Object.entries(report.discardedByReason).map(([reason, count]) => `${reason}=${count}`).join(", ");
  const details = report.discardDetails.map(({ index, id, reason }) => `índice ${index}${id !== undefined ? ` (${id})` : ""}: ${reason}`).join("; ");
  return `${summary} (${reasons}). Detalle: ${details}`;
}
