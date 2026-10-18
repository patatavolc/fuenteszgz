import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { formatSnapshotValidationReport, meetsSnapshotCoverage, validateSnapshot } from "../lib/snapshot-validation";

const endpoint = "https://idezar-sig.zaragoza.es/servicios/geoserver/medioambiente/wfs";
const input = resolve("data/municipal-snapshot.geojson");

async function main() {
  const features: unknown[] = [];
  let total = 0;
  let sourceTimestamp: string | undefined;
  const fetchPage = async (start: number, count: number): Promise<unknown[]> => {
    const url = new URL(endpoint);
    url.search = new URLSearchParams({
      REQUEST: "GetFeature", SERVICE: "WFS", VERSION: "2.0.0", outputFormat: "application/json",
      typeName: "medioambiente:fuente_agua_potable", srsName: "EPSG:4326", count: String(count), startIndex: String(start),
    }).toString();
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const collection = await response.json() as { features?: unknown[]; totalFeatures?: number; timeStamp?: string };
      total = collection.totalFeatures ?? total;
      sourceTimestamp ??= collection.timeStamp;
      return collection.features ?? [];
    } catch (error) {
      if (count === 1) {
        console.warn(`Se omite el índice WFS ${start}: ${error instanceof Error ? error.message : "error de transformación"}`);
        return [];
      }
      const half = Math.floor(count / 2);
      return [...await fetchPage(start, half), ...await fetchPage(start + half, count - half)];
    }
  };
  for (let start = 0; start <= 700; start += 100) {
    const page = await fetchPage(start, 100);
    features.push(...page);
    if (!page.length || (total > 0 && start + 100 >= total)) break;
  }
  const result = { type: "FeatureCollection", name: "Fuentes de agua potable — Ayuntamiento de Zaragoza", timestamp: sourceTimestamp ?? new Date().toISOString(), crs: { type: "name", properties: { name: "EPSG:4326" } }, features };
  const validation = validateSnapshot(result, "municipal");
  console.info(formatSnapshotValidationReport(validation.report));
  if (!total || features.length < total * 0.95) {
    throw new Error(`Descarga incompleta: recibidos ${features.length} de ${total || "un total desconocido"}. No se reemplazó el snapshot.`);
  }
  if (!meetsSnapshotCoverage(validation.report.accepted, total)) {
    throw new Error(`Descarga incompleta tras validar: ${validation.report.accepted} registros válidos de ${total}. No se reemplazó el snapshot.`);
  }
  await writeFile(input, `${JSON.stringify({ ...result, features: validation.features })}\n`, "utf8");
  console.info(`Snapshot actualizado: ${validation.report.accepted} registros WFS válidos; ${new Date().toISOString()}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Error al actualizar el inventario");
  process.exitCode = 1;
});
