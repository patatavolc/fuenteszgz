"use client";

import { useEffect, useRef, useState } from "react";
import { CircleMarker, MapContainer, Marker, TileLayer, ZoomControl, useMap, useMapEvents } from "react-leaflet";
import "leaflet.markercluster";
import L from "leaflet";
import { reconcileMarkers, type MarkerEntry } from "@/lib/marker-reconciliation";
import type { Fountain, Point } from "@/lib/types";

const userIcon = L.divIcon({ className: "", html: '<span class="user-pin"><i></i></span>', iconSize: [22, 22], iconAnchor: [11, 11] });

function Recenter({ point }: { point: Point | null }) {
  const map = useMap();
  useEffect(() => { if (point) map.flyTo([point.lat, point.lon], Math.max(map.getZoom(), 16), { duration: 0.6 }); }, [point, map]);
  return null;
}
function ClickOrigin({ enabled, onClick, selectingSource, onSourcePoint }: { enabled: boolean; onClick: (point: Point) => void; selectingSource: boolean; onSourcePoint: (point: Point) => void }) {
  useMapEvents({ click(event) { const point = { lat: event.latlng.lat, lon: event.latlng.lng }; if (selectingSource) onSourcePoint(point); else if (enabled) onClick(point); } });
  return null;
}
const fountainIcon = (status: Fountain["status"], community: boolean) => {
  const statusClass = status === "averiada" || status === "cerrada" || status === "fuera-de-servicio"
    ? "pin-off"
    : status === "desconocida" ? "pin-unknown" : "";
  return L.divIcon({
    className: "fountain-marker-icon",
    html: `<span class="map-pin ${community ? "pin-community" : statusClass}" aria-hidden="true"><i></i></span>`,
    iconSize: [38, 38],
    // The rotated pin's tip sits at the bottom center of the icon box.
    iconAnchor: [19, 37],
    tooltipAnchor: [0, -35],
  });
};

const statusLabel = (status: Fountain["status"]) => ({
  operativa: "operativa",
  averiada: "averiada",
  cerrada: "cerrada",
  "fuera-de-servicio": "fuera de servicio",
  desconocida: "estado desconocido",
}[status]);

function ClusteredFountains({ fountains, onSelect }: { fountains: Fountain[]; onSelect: (fountain: Fountain) => void }) {
  const map = useMap();
  const groupRef = useRef<L.MarkerClusterGroup | null>(null);
  const markerEntriesRef = useRef(new Map<string, MarkerEntry<Fountain, L.Marker>>());
  const onSelectRef = useRef(onSelect);
  const initialLoadPreparedRef = useRef(false);
  const [groupReady, setGroupReady] = useState(false);
  onSelectRef.current = onSelect;

  useEffect(() => {
    const markerEntries = markerEntriesRef.current;
    setGroupReady(false);
    initialLoadPreparedRef.current = false;
    const group = L.markerClusterGroup({
      chunkedLoading: true,
      maxClusterRadius: 42,
      showCoverageOnHover: false,
      chunkProgress(processed, total) {
        if (processed >= total && groupRef.current === group) setGroupReady(true);
      },
    });
    groupRef.current = group;
    return () => {
      groupRef.current = null;
      markerEntries.clear();
      initialLoadPreparedRef.current = false;
    };
  }, [map]);

  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    if (initialLoadPreparedRef.current && !groupReady) return;
    initialLoadPreparedRef.current = true;
    const markerEntries = markerEntriesRef.current;

    reconcileMarkers(markerEntries, fountains, (markers) => group.removeLayers(markers), (fountain) => {
      const community = fountain.source !== "Ayuntamiento de Zaragoza";
      const sourceLabel = fountain.source === "OpenStreetMap (comunidad)" ? "OpenStreetMap, comunidad" : fountain.source === "Ayuntamiento de Zaragoza" ? "Ayuntamiento de Zaragoza" : "propuesta comunitaria aprobada";
      const accessibleLabel = `${fountain.name}, ${statusLabel(fountain.status)}, ${sourceLabel}`;
      const marker = L.marker([fountain.lat, fountain.lon], { icon: fountainIcon(fountain.status, community), title: accessibleLabel, alt: accessibleLabel, keyboard: true });
      marker.bindTooltip(`${fountain.name} · ${statusLabel(fountain.status)} · ${sourceLabel}`, { direction: "top", offset: [0, -4] });
      marker.on("click", () => onSelectRef.current(fountain));
      return marker;
    }, (markers) => {
      const groupOptions = group.options as L.MarkerClusterGroupOptions;
      const chunkedLoading = groupOptions.chunkedLoading;
      // Finish a delta synchronously so a rapid next filter cannot race a pending chunk.
      if (map.hasLayer(group)) groupOptions.chunkedLoading = false;
      try { group.addLayers(markers); } finally { groupOptions.chunkedLoading = chunkedLoading; }
    });
  }, [fountains, groupReady, map]);

  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    map.addLayer(group);
    return () => { map.removeLayer(group); };
  }, [map]);
  return null;
}

export function MapView({ fountains, selectedId, userPoint, origin, recenter, chooseOrigin, onSelect, selectingOrigin, selectingSource = false, onSourcePoint = () => {} }: {
  fountains: Fountain[]; selectedId?: string; userPoint?: Point | null; origin?: Point | null;
  recenter?: Point | null; chooseOrigin: (point: Point) => void; onSelect: (fountain: Fountain) => void; selectingOrigin: boolean; selectingSource?: boolean; onSourcePoint?: (point: Point) => void;
}) {
  const selected = fountains.find((item) => item.id === selectedId);
  return <MapContainer center={[41.6488, -0.8891]} zoom={13} zoomControl={false} scrollWheelZoom keyboard className="map-canvas">
    <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
    <ZoomControl position="bottomright"/>
    <Recenter point={recenter ?? (selected ? selected : null)} />
    <ClickOrigin enabled={selectingOrigin} onClick={chooseOrigin} selectingSource={selectingSource} onSourcePoint={onSourcePoint} />
    <ClusteredFountains fountains={fountains} onSelect={onSelect}/>
    {userPoint && <CircleMarker center={[userPoint.lat, userPoint.lon]} radius={9} pathOptions={{ color: "white", weight: 3, fillColor: "#2476ff", fillOpacity: 1 }} />}
    {origin && <Marker position={[origin.lat, origin.lon]} icon={userIcon} title="Origen seleccionado" />}
  </MapContainer>;
}
