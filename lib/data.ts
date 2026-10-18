import collection from "@/data/municipal-snapshot.geojson";
import osmCollection from "@/data/osm-candidates.geojson";
import { validateSnapshot, type SnapshotValidationReport } from "./snapshot-validation";
import type { CommunitySource, Fountain, OperatingStatus, Point } from "./types";

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
    const displayName = [location, address].filter(Boolean).join(" · ") || "Fuente municipal";
    output.push({
      id: `municipal:${code}`, name: displayName, officialCode: code, ...(address ? { address } : {}), ...(location ? { location } : {}),
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

/** Normalize only records returned by the approved community-source API. */
export function normalizeCommunitySources(input: unknown): Fountain[] {
  if (!Array.isArray(input)) return [];
  return input.flatMap((row): Fountain[] => {
    if (!row || typeof row !== "object") return [];
    const source = row as Partial<CommunitySource>;
    if (source.status !== "approved" || typeof source.id !== "string"
      || typeof source.lat !== "number" || typeof source.lon !== "number"
      || !Number.isFinite(source.lat) || !Number.isFinite(source.lon)
      || Math.abs(source.lat) > 90 || Math.abs(source.lon) > 180) return [];
    const name = clean(source.name) ?? clean(source.location) ?? "Fuente comunitaria";
    const location = clean(source.location);
    const description = clean(source.description);
    return [{
      id: `community:${source.id}`, name, lat: source.lat, lon: source.lon,
      ...(location ? { location } : {}), ...(description ? { description } : {}),
      status: "desconocida", source: "Fuente propuesta (comunidad)",
      sourceUrl: `/proponer#${encodeURIComponent(source.id)}`, confidence: "media", communityStatus: "approved",
    }];
  });
}

function normalizeEvidence(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const normalized = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/\b(calle|c\.?|avenida|av\.?|paseo|pso\.?|plaza|pza\.?|parque)\b/g, " ")
    .replace(/\([^)]*\)|\b\d+[a-z]?\b/g, " ")
    .replace(/[^a-z]+/g, " ").trim().replace(/\s+/g, " ");
  return normalized || undefined;
}

function streetEvidence(fountain: Fountain): string | undefined {
  const address = normalizeEvidence(fountain.address);
  if (address) return address;
  const tags = fountain.osmTags;
  return normalizeEvidence(tags?.["addr:street"]);
}

function parkEvidence(fountain: Fountain): string | undefined {
  return normalizeEvidence(fountain.location);
}

function hasMatchingEvidence(municipal: Fountain, osm: Fountain): boolean {
  const municipalStreet = streetEvidence(municipal);
  const osmStreet = streetEvidence(osm);
  if (municipalStreet && osmStreet) return municipalStreet === osmStreet;
  const municipalPark = parkEvidence(municipal);
  const osmPark = parkEvidence(osm);
  return Boolean(municipalPark && osmPark && municipalPark === osmPark);
}

/**
 * Returns a display set led by municipal records. OSM is attached only when
 * the pair is close, has corroborating address/location evidence, and is the
 * unique closest candidate in both directions. Ambiguous records stay separate.
 */
export function buildPrioritizedDisplaySet(municipal: Fountain[], osm: Fountain[], toleranceMeters = 15): Fountain[] {
  const candidates = new Map<string, Array<{ osm: Fountain; distance: number }>>();
  for (const city of municipal) {
    const nearby = osm.map((community) => ({ osm: community, distance: distanceMeters(city, community) }))
      .filter(({ osm: community, distance }) => distance <= toleranceMeters && hasMatchingEvidence(city, community))
      .sort((a, b) => a.distance - b.distance);
    candidates.set(city.id, nearby);
  }

  const reverse = new Map<string, Array<{ municipal: Fountain; distance: number }>>();
  for (const city of municipal) for (const candidate of candidates.get(city.id) ?? []) {
    const rows = reverse.get(candidate.osm.id) ?? [];
    rows.push({ municipal: city, distance: candidate.distance });
    reverse.set(candidate.osm.id, rows);
  }

  const matchedOsmIds = new Set<string>();
  const displayedMunicipal = municipal.map((city) => {
    const nearby = candidates.get(city.id) ?? [];
    if (!nearby.length) return city;
    const nearest = nearby[0];
    const equallyClose = nearby.filter((candidate) => Math.abs(candidate.distance - nearest.distance) < 0.5);
    const reverseNearby = reverse.get(nearest.osm.id) ?? [];
    const reverseNearest = [...reverseNearby].sort((a, b) => a.distance - b.distance);
    const reverseTied = reverseNearest.filter((candidate) => Math.abs(candidate.distance - reverseNearest[0].distance) < 0.5);
    if (equallyClose.length !== 1 || reverseTied.length !== 1 || reverseTied[0].municipal.id !== city.id) return city;
    matchedOsmIds.add(nearest.osm.id);
    return { ...city, matchedOsm: [nearest.osm] };
  });
  return [...displayedMunicipal, ...osm.filter((community) => !matchedOsmIds.has(community.id))];
}

export type Filters = { maxDistanceKm: number; greenOnly: boolean; status: OperatingStatus | "todas"; excludeSeasonal?: boolean };
export function hasSeasonalEvidence(fountain: Fountain) {
  return Boolean(fountain.seasonal && fountain.seasonal !== "no")
    || Boolean(fountain.matchedOsm?.some((match) => match.seasonal && match.seasonal !== "no"));
}
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
export const fountains = buildPrioritizedDisplaySet(municipalFountains, osmFountains);
