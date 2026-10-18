import { randomUUID } from "node:crypto";
import { open, rename, unlink } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { meetsSnapshotCoverage, type SnapshotFeature, type SnapshotValidationResult } from "../lib/snapshot-validation";

type SnapshotCollection = { type: string; features: unknown[]; [key: string]: unknown };

type SnapshotWriteOptions = {
  expected?: number;
  minimumRatio?: number;
};

export async function writeValidatedSnapshotAtomically(
  destination: string,
  snapshot: SnapshotCollection,
  validation: SnapshotValidationResult,
  options: SnapshotWriteOptions = {},
): Promise<void> {
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
