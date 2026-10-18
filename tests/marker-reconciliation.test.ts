import { describe, expect, it } from "vitest";
import { reconcileMarkers, type MarkerEntry } from "@/lib/marker-reconciliation";

type Fountain = { id: string; name: string };
type Marker = { fountainId: string };

describe("reconcileMarkers", () => {
  it("reuses retained markers and only creates or removes changed IDs", () => {
    const retained = { id: "kept", name: "Retained source" };
    const removed = { id: "removed", name: "Removed source" };
    const added = { id: "added", name: "Added source" };
    const retainedMarker = { fountainId: retained.id };
    const removedMarker = { fountainId: removed.id };
    const entries = new Map<string, MarkerEntry<Fountain, Marker>>([
      [retained.id, { fountain: retained, marker: retainedMarker }],
      [removed.id, { fountain: removed, marker: removedMarker }],
    ]);
    const removedBatches: Marker[][] = [];
    const createdMarkers: Marker[] = [];
    const addedBatches: Marker[][] = [];

    reconcileMarkers(entries, [added, retained], (markers) => removedBatches.push(markers), (fountain) => {
      const marker = { fountainId: fountain.id };
      createdMarkers.push(marker);
      return marker;
    }, (markers) => addedBatches.push(markers));

    expect(entries.get(retained.id)).toEqual({ fountain: retained, marker: retainedMarker });
    expect(removedBatches).toEqual([[removedMarker]]);
    expect(createdMarkers).toEqual([{ fountainId: added.id }]);
    expect(addedBatches).toEqual([[createdMarkers[0]]]);
    expect([...entries.keys()]).toEqual([retained.id, added.id]);
  });

  it("replaces the marker when a fountain with the same ID has updated data", () => {
    const oldFountain = { id: "source", name: "Old name" };
    const updatedFountain = { id: "source", name: "Updated name" };
    const oldMarker = { fountainId: oldFountain.id };
    const entries = new Map<string, MarkerEntry<Fountain, Marker>>([
      [oldFountain.id, { fountain: oldFountain, marker: oldMarker }],
    ]);
    const removedBatches: Marker[][] = [];
    const createdMarkers: Marker[] = [];

    reconcileMarkers(entries, [updatedFountain], (markers) => removedBatches.push(markers), (fountain) => {
      const marker = { fountainId: fountain.id };
      createdMarkers.push(marker);
      return marker;
    }, () => undefined);

    expect(removedBatches).toEqual([[oldMarker]]);
    expect(createdMarkers).toHaveLength(1);
    expect(entries.get(updatedFountain.id)).toEqual({ fountain: updatedFountain, marker: createdMarkers[0] });
  });
});
