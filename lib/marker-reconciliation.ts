export type MarkerEntry<Fountain, Marker> = { fountain: Fountain; marker: Marker };

export function reconcileMarkers<Fountain extends { id: string }, Marker>(
  entries: Map<string, MarkerEntry<Fountain, Marker>>,
  fountains: Fountain[],
  removeMarkers: (markers: Marker[]) => void,
  createMarker: (fountain: Fountain) => Marker,
  addMarkers: (markers: Marker[]) => void,
) {
  const nextFountains = new Map(fountains.map((fountain) => [fountain.id, fountain]));
  const markersToRemove: Marker[] = [];

  for (const [id, entry] of entries) {
    const nextFountain = nextFountains.get(id);
    if (!nextFountain || nextFountain !== entry.fountain) {
      markersToRemove.push(entry.marker);
      entries.delete(id);
    }
  }

  if (markersToRemove.length) removeMarkers(markersToRemove);

  const markersToAdd: Marker[] = [];
  const entriesToAdd: Array<[string, MarkerEntry<Fountain, Marker>]> = [];
  for (const fountain of fountains) {
    if (entries.has(fountain.id)) continue;
    const marker = createMarker(fountain);
    markersToAdd.push(marker);
    entriesToAdd.push([fountain.id, { fountain, marker }]);
  }

  if (markersToAdd.length) addMarkers(markersToAdd);
  for (const [id, entry] of entriesToAdd) entries.set(id, entry);
}
