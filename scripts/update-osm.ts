import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { formatSnapshotValidationReport, validateSnapshot } from "../lib/snapshot-validation";

const output = resolve("data/osm-candidates.geojson");
const query = `[out:json][timeout:25];(node["amenity"="drinking_water"](41.56,-1.05,41.76,-0.70);way["amenity"="drinking_water"](41.56,-1.05,41.76,-0.70);relation["amenity"="drinking_water"](41.56,-1.05,41.76,-0.70);node["amenity"="fountain"]["fountain"="drinking"](41.56,-1.05,41.76,-0.70);way["amenity"="fountain"]["fountain"="drinking"](41.56,-1.05,41.76,-0.70);node["amenity"="fountain"]["drinking_water"="yes"](41.56,-1.05,41.76,-0.70);way["amenity"="fountain"]["drinking_water"="yes"](41.56,-1.05,41.76,-0.70););out center;`;

async function main() {
  const response = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "FuentesZaragoza/0.1 (personal open data map)" },
    body: new URLSearchParams({ data: query }), signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) throw new Error(`Overpass respondió ${response.status}; el snapshot existente se conserva.`);
  const data = await response.json() as { elements?: Array<{ type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }>; osm3s?: { timestamp_osm_base?: string } };
  if (!data.elements?.length) throw new Error("Overpass devolvió cero elementos; el snapshot existente se conserva.");
  const features = data.elements.map((element) => {
    const point = element.lat !== undefined && element.lon !== undefined ? { lat: element.lat, lon: element.lon } : element.center;
    const tags = element.tags ?? {};
    return { type: "Feature", id: `${element.type}/${element.id}`, geometry: { type: "Point", coordinates: point ? [point.lon, point.lat] : [] }, properties: { tags } };
  });
  const snapshot = { type: "FeatureCollection", name: "Candidatos comunitarios de agua para beber — OpenStreetMap", license: "ODbL", timestamp: data.osm3s?.timestamp_osm_base ?? new Date().toISOString(), queryBounds: "41.56,-1.05,41.76,-0.70", features };
  const validation = validateSnapshot(snapshot, "osm");
  console.info(formatSnapshotValidationReport(validation.report));
  if (!validation.features.length) throw new Error("No quedan candidatos OSM válidos; snapshot conservado.");
  const validatedSnapshot = { ...snapshot, features: validation.features };
  await writeFile(output, `${JSON.stringify(validatedSnapshot)}\n`, "utf8");
  console.info(`Candidatos OSM guardados: ${validation.report.accepted}; base ${snapshot.timestamp}`);
}

main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : "Error al actualizar OSM"); process.exitCode = 1; });
