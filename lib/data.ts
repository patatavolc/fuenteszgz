import collection from "@/data/municipal-snapshot.geojson";
import osmCollection from "@/data/osm-candidates.geojson";
import { validateSnapshot, type SnapshotValidationReport } from "./snapshot-validation";
import type { Fountain, OperatingStatus, Point } from "./types";

export function normalizeMunicipalData(input: unknown): Fountain[] {
  return normalizeMunicipalDataWithReport(input).fountains;
}

export function normalizeMunicipalDataWithReport(input: unknown): { fountains: Fountain[]; report: SnapshotValidationReport } {
  const { features, report } = validateSnapshot(input, "municipal");
  const output: Fountain[] = [];
  for (const feature of features) {
    const coordinates = feature.geometry.coordinates;
    const [lon, lat] = coordinates;
    const properties = feature.properties;
    const code = String(properties.codigo ?? feature.id ?? "").trim();
    const location = clean(properties.ubicacion);
    const address = clean(properties.vial);
    const service = properties.en_servicio;
    const status: OperatingStatus = service === true ? "operativa" : service === false ? "fuera-de-servicio" : "desconocida";
    output.push({
      id: `municipal:${code}`, name: `Fuente ${code}`, ...(address ? { address } : {}), ...(location ? { location } : {}),
      ...(typeof properties.distrito === "string" ? { district: clean(properties.distrito) } : {}),
      ...(typeof properties.barrio === "string" ? { neighborhood: clean(properties.barrio) } : {}),
      lat, lon, status, ...(service === true || service === false ? { statusSource: "Ayuntamiento de Zaragoza · campo en_servicio" } : {}),
      ...(location && /parque|jard[ií]n|z\.\s*v\.|zona verde/i.test(location) ? { isGreenArea: true } : {}),
      source: "Ayuntamiento de Zaragoza", sourceUrl: "https://www.zaragoza.es/web/espacio-de-datos/servicio/catalogo/2860", confidence: "alta",
    });
  }
  const fountains = deduplicateFountains(output);
  return { fountains, report: { ...report, normalized: fountains.length } };
}

export function normalizeOsmData(input: unknown): Fountain[] {
  return normalizeOsmDataWithReport(input).fountains;
}

export function normalizeOsmDataWithReport(input: unknown): { fountains: Fountain[]; report: SnapshotValidationReport } {
  const { features, report } = validateSnapshot(input, "osm");
  const metadata = input && typeof input === "object" ? input as { timestamp?: unknown } : {};
  const output: Fountain[] = [];
  for (const feature of features) {
    const coordinates = feature.geometry.coordinates;
    const [lon, lat] = coordinates;
    const properties = feature.properties;
    const tags = properties.tags as Record<string, string>;
    const rawId = String(feature.id ?? "").trim();
    const id = rawId.startsWith("osm:") ? rawId.slice(4) : rawId;
    const addressParts = [tags["addr:street"], tags["addr:housenumber"]].filter(Boolean);
    const location = tags["is_in:park"] ?? (tags.location === "park" ? "Parque (según OSM)" : undefined);
    const isClosed = Boolean(tags["disused:amenity"] || tags.disused === "yes" || tags.abandoned === "yes");
    output.push({
      id: `osm:${id}`, name: tags.name?.trim() || `Punto comunitario ${id}`, ...(addressParts.length ? { address: addressParts.join(" ") } : {}), ...(location ? { location } : {}),
      ...(tags["addr:suburb"] ? { neighborhood: tags["addr:suburb"] } : {}), lat, lon,
      status: isClosed ? "fuera-de-servicio" : "desconocida", ...(isClosed ? { statusSource: "Etiqueta comunitaria OSM; sin confirmación municipal" } : {}),
      ...(location || tags.leisure === "park" ? { isGreenArea: true } : {}),
      ...(tags.seasonal && tags.seasonal !== "no" ? { seasonal: tags.seasonal } : {}),
      ...(tags.wheelchair ? { accessibility: tags.wheelchair } : {}), source: "OpenStreetMap (comunidad)",
      sourceUrl: `https://www.openstreetmap.org/${id.replace("/", "/")}`, ...(typeof metadata.timestamp === "string" ? { sourceUpdatedAt: metadata.timestamp } : {}),
      confidence: "media", osmTags: tags,
    });
  }
  const fountains = deduplicateFountains(output);
  return { fountains, report: { ...report, normalized: fountains.length } };
}

function clean(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const text = value.replace(/\s+/g, " ").trim();
  return text || undefined;
}

export function deduplicateFountains(fountains: Fountain[], toleranceMeters = 15): Fountain[] {
  const byId = new Map<string, Fountain>();
  for (const fountain of fountains) {
    if (!byId.has(fountain.id)) byId.set(fountain.id, fountain);
  }
  const seen: Fountain[] = [];
  for (const fountain of byId.values()) {
    const nearby = seen.find((item) => item.source === fountain.source && distanceMeters(item, fountain) <= toleranceMeters && item.name === fountain.name);
    if (!nearby) seen.push(fountain);
  }
  return seen;
}

export function distanceMeters(a: Point, b: Point): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const lat1 = a.lat * rad;
  const lat2 = b.lat * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export type Filters = { maxDistanceKm: number; greenOnly: boolean; status: OperatingStatus | "todas"; excludeSeasonal?: boolean };
export function hasSeasonalEvidence(fountain: Fountain) { return Boolean(fountain.seasonal && fountain.seasonal !== "no"); }
export function findNearby(fountains: Fountain[], origin: Point, filters: Filters, limit = 2500) {
  return fountains.map((fountain) => ({ fountain, distance: distanceMeters(origin, fountain) }))
    .filter(({ fountain, distance }) => distance <= filters.maxDistanceKm * 1000
      && (!filters.greenOnly || fountain.isGreenArea === true)
      && (!filters.excludeSeasonal || !hasSeasonalEvidence(fountain))
      && (filters.status === "todas" || fountain.status === filters.status))
    .sort((a, b) => a.distance - b.distance).slice(0, limit);
}

export const municipalFountains = normalizeMunicipalData(collection);
export const osmFountains = normalizeOsmData(osmCollection);
export const fountains = [...municipalFountains, ...osmFountains];
