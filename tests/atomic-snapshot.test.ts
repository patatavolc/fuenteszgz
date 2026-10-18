import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { writeValidatedSnapshotAtomically } from "@/scripts/write-snapshot";
import { validateSnapshot } from "@/lib/snapshot-validation";

const temporaryDirectories: string[] = [];

async function createDirectory() {
  const directory = await mkdtemp(join(tmpdir(), "fuentes-snapshot-test-"));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("escritura atómica de snapshots validados", () => {
  it("reemplaza el snapshot tras validar y no deja archivos temporales", async () => {
    const directory = await createDirectory();
    const destination = join(directory, "snapshot.geojson");
    await writeFile(destination, "snapshot anterior", "utf8");
    const snapshot = { type: "FeatureCollection", name: "prueba", features: [
      { type: "Feature", id: "source.1", geometry: { type: "Point", coordinates: [-.88, 41.65] }, properties: { codigo: "F1" } },
      { type: "Feature", id: "source.2", geometry: { type: "Point", coordinates: [181, 41] }, properties: { codigo: "F2" } },
    ] };
    const validation = validateSnapshot(snapshot, "municipal");

    await writeValidatedSnapshotAtomically(destination, snapshot, validation);

    expect(JSON.parse(await readFile(destination, "utf8"))).toEqual({ ...snapshot, features: [snapshot.features[0]] });
    expect(await readdir(directory)).toEqual(["snapshot.geojson"]);
  });

  it("mantiene el snapshot si la cobertura válida no alcanza el umbral configurado", async () => {
    const directory = await createDirectory();
    const destination = join(directory, "snapshot.geojson");
    await writeFile(destination, "snapshot anterior", "utf8");
    const snapshot = { type: "FeatureCollection", features: [
      { type: "Feature", id: "source.1", geometry: { type: "Point", coordinates: [-.88, 41.65] }, properties: { codigo: "F1" } },
    ] };
    const validation = validateSnapshot(snapshot, "municipal");

    await expect(writeValidatedSnapshotAtomically(destination, snapshot, validation, { expected: 100 }))
      .rejects.toThrow("95 %");

    expect(await readFile(destination, "utf8")).toBe("snapshot anterior");
    expect(await readdir(directory)).toEqual(["snapshot.geojson"]);
  });

  it("mantiene el destino y limpia el temporal si falla el reemplazo", async () => {
    const directory = await createDirectory();
    const destination = join(directory, "snapshot.geojson");
    await mkdir(destination);
    await writeFile(join(destination, "marker"), "conservar", "utf8");
    const snapshot = { type: "FeatureCollection", features: [
      { type: "Feature", id: "source.1", geometry: { type: "Point", coordinates: [-.88, 41.65] }, properties: { codigo: "F1" } },
    ] };
    const validation = validateSnapshot(snapshot, "municipal");

    await expect(writeValidatedSnapshotAtomically(destination, snapshot, validation)).rejects.toThrow();

    expect(await readFile(join(destination, "marker"), "utf8")).toBe("conservar");
    expect(await readdir(directory)).toEqual(["snapshot.geojson"]);
  });
});
