import { randomUUID } from "node:crypto";
import { open, readFile, rename, unlink } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { compareSnapshotIds, formatSnapshotValidationReport, meetsSnapshotCoverage, validateSnapshot, type SnapshotFeature, type SnapshotSource, type SnapshotValidationResult } from "../lib/snapshot-validation";

type SnapshotCollection = { type: string; features: unknown[]; [key: string]: unknown };

type SnapshotWriteOptions = {
  expected?: number;
  minimumRatio?: number;
};

export async function compareSnapshotFileIds(
  path: string,
  next: unknown,
  source: SnapshotSource,
): Promise<{ added: string[]; removed: string[] }> {
  let contents: string;
  try {
    contents = await readFile(path, "utf8");
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return compareSnapshotIds(undefined, next, source);
    }
    throw new Error(`No se pudo leer el snapshot anterior ${path}: ${error instanceof Error ? error.message : String(error)}`);
  }

  let previous: unknown;
  try {
    previous = JSON.parse(contents) as unknown;
  } catch (error) {
    throw new Error(`El snapshot anterior ${path} contiene JSON inválido: ${error instanceof Error ? error.message : String(error)}`);
  }

  const validation = validateSnapshot(previous, source);
  if (!validation.features.length || validation.report.discarded > 0) {
    throw new Error(`El snapshot anterior ${path} no cumple el esquema: ${formatSnapshotValidationReport(validation.report)}`);
  }
  return compareSnapshotIds(previous, next, source);
}

export async function writeValidatedSnapshotAtomically(
  destination: string,
  snapshot: SnapshotCollection,
  validation: SnapshotValidationResult,
  options: SnapshotWriteOptions = {},
): Promise<void> {
  if ((validation.report.discardedByReason["duplicate-id"] ?? 0) > 0) {
    throw new Error(`Hay ${validation.report.discardedByReason["duplicate-id"]} identificadores duplicados; snapshot conservado. ${validation.report.discardDetails.filter(({ reason }) => reason === "duplicate-id").map(({ index, id }) => `índice ${index}${id !== undefined ? ` (${id})` : ""}`).join(", ")}`);
  }
  if (!validation.features.length) throw new Error("No quedan registros válidos; snapshot conservado.");

  const minimumRatio = options.minimumRatio ?? 0.95;
  if (options.expected !== undefined && !meetsSnapshotCoverage(validation.report.accepted, options.expected, minimumRatio)) {
    throw new Error(`Cobertura válida inferior al ${minimumRatio * 100} % (${validation.report.accepted}/${options.expected}); snapshot conservado.`);
  }

  const temporaryPath = join(dirname(destination), `.${basename(destination)}.${randomUUID()}.tmp`);
  let file: Awaited<ReturnType<typeof open>> | undefined;
  try {
    file = await open(temporaryPath, "wx");
    await file.writeFile(`${JSON.stringify({ ...snapshot, features: validation.features as SnapshotFeature[] })}\n`, "utf8");
    await file.sync();
    await file.close();
    file = undefined;
    await rename(temporaryPath, destination);
  } catch (error) {
    if (file) await file.close().catch(() => undefined);
    await unlink(temporaryPath).catch(() => undefined);
    throw error;
  }
}
