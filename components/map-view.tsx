"use client";

import { useEffect } from "react";
import { CircleMarker, MapContainer, Marker, Polyline, TileLayer, ZoomControl, useMap, useMapEvents } from "react-leaflet";
import "leaflet.markercluster";
import L from "leaflet";
import type { Fountain, Point, RouteResult } from "@/lib/types";

const fountainIcon = (status: string, community: boolean) => L.divIcon({ className: "", html: `<span class="map-pin ${community ? "pin-community" : status === "averiada" || status === "cerrada" || status === "fuera-de-servicio" ? "pin-off" : status === "desconocida" ? "pin-unknown" : ""}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8c-3.2 4.2-6.2 7.5-6.2 11.4a6.2 6.2 0 0 0 12.4 0C18.2 10.3 15.2 7 12 2.8Z"/><path d="M9.1 15a3 3 0 0 0 3 2.7"/></svg></span>`, iconSize: [34, 42], iconAnchor: [17, 40], popupAnchor: [0, -36] });
const userIcon = L.divIcon({ className: "", html: '<span class="user-pin"><i></i></span>', iconSize: [22, 22], iconAnchor: [11, 11] });

function Recenter({ point }: { point: Point | null }) {
  const map = useMap();
  useEffect(() => { if (point) map.flyTo([point.lat, point.lon], Math.max(map.getZoom(), 16), { duration: 0.6 }); }, [point, map]);
  return null;
}
function ClickOrigin({ enabled, onClick }: { enabled: boolean; onClick: (point: Point) => void }) {
  useMapEvents({ click(event) { if (enabled) onClick({ lat: event.latlng.lat, lon: event.latlng.lng }); } });
  return null;
}
function ClusteredFountains({ fountains, onSelect }: { fountains: Fountain[]; onSelect: (fountain: Fountain) => void }) {
  const map = useMap();
  useEffect(() => {
    const group = L.markerClusterGroup({ chunkedLoading: true, maxClusterRadius: 42, showCoverageOnHover: false });
    fountains.forEach((fountain) => {
      const community = fountain.source === "OpenStreetMap (comunidad)";
      const marker = L.marker([fountain.lat, fountain.lon], { icon: fountainIcon(fountain.status, community), title: `${fountain.name} · ${community ? "OSM" : "Ayuntamiento"}`, alt: fountain.name });
      marker.bindTooltip(fountain.name, { direction: "top", offset: [0, -30] });
      marker.on("click", () => onSelect(fountain));
      group.addLayer(marker);
    });
    map.addLayer(group);
    return () => { map.removeLayer(group); };
  }, [fountains, map, onSelect]);
  return null;
}

export function MapView({ fountains, selectedId, userPoint, origin, route, recenter, chooseOrigin, onSelect, selectingOrigin }: {
  fountains: Fountain[]; selectedId?: string; userPoint?: Point | null; origin?: Point | null; route?: RouteResult | null;
  recenter?: Point | null; chooseOrigin: (point: Point) => void; onSelect: (fountain: Fountain) => void; selectingOrigin: boolean;
}) {
  const selected = fountains.find((item) => item.id === selectedId);
  return <MapContainer center={[41.6488, -0.8891]} zoom={13} zoomControl={false} scrollWheelZoom keyboard className="map-canvas">
    <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
    <ZoomControl position="bottomright"/>
    <Recenter point={recenter ?? (selected ? selected : null)} />
    <ClickOrigin enabled={selectingOrigin} onClick={chooseOrigin} />
    <ClusteredFountains fountains={fountains} onSelect={onSelect}/>
    {userPoint && <CircleMarker center={[userPoint.lat, userPoint.lon]} radius={9} pathOptions={{ color: "white", weight: 3, fillColor: "#2476ff", fillOpacity: 1 }} />}
    {origin && <Marker position={[origin.lat, origin.lon]} icon={userIcon} title="Origen seleccionado" />}
    {route && <Polyline positions={route.coordinates.map((point) => [point.lat, point.lon])} pathOptions={{ color: "#2476ff", weight: 5, opacity: 0.88 }} />}
  </MapContainer>;
}
