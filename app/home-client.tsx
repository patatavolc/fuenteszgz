"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bookmark, Check, ChevronDown, Compass, Droplets, LocateFixed, MapPin, Navigation, Search, Send, ShieldAlert, SlidersHorizontal, X } from "lucide-react";
import { distanceMeters, findNearby, fountains, hasSeasonalEvidence, municipalFountains, osmFountains } from "@/lib/data";
import { geolocationStateFromError, type GeolocationState } from "@/lib/geolocation";
import { getFavorites, getIncidents, saveFavorite, saveIncident } from "@/lib/local-storage";
import { incidentSchema } from "@/lib/validation";
import type { Fountain, Incident, IncidentKind, Origin, Point } from "@/lib/types";

const MapView = dynamic(() => import("@/components/map-view").then((module) => module.MapView), {
  ssr: false, loading: () => <div className="map-loading"><span className="spinner"/>Preparando el mapa…</div>,
});
const center: Origin = { lat: 41.6488, lon: -0.8891, label: "Centro de Zaragoza (referencia)" };
const statusLabels = { operativa: "En servicio según el Ayuntamiento", averiada: "Averiada", cerrada: "Cerrada", "fuera-de-servicio": "Fuera de servicio según el Ayuntamiento", desconocida: "Estado desconocido" };
const statusText = (fountain: Fountain) => fountain.source === "OpenStreetMap (comunidad)"
  ? fountain.status === "fuera-de-servicio" ? "Marcada fuera de servicio en OSM · no confirmada" : "Candidato comunitario · sin confirmación municipal"
  : statusLabels[fountain.status];

function useLocation() {
  const [state, setState] = useState<GeolocationState>("sin-solicitar");
  const [point, setPoint] = useState<Point | null>(null);
  const [following, setFollowing] = useState(false);
  const watchId = useRef<number | null>(null);
  const stopFollowing = useCallback(() => {
    if (watchId.current !== null && navigator.geolocation) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
    setFollowing(false);
  }, []);
  const toggleFollowing = useCallback((onLocated?: (point: Point) => void) => {
    if (watchId.current !== null) { stopFollowing(); return; }
    if (!navigator.geolocation) { setState("no-disponible"); return; }
    setState("pendiente");
    setFollowing(true);
    watchId.current = navigator.geolocation.watchPosition(({ coords }) => {
      const value = { lat: coords.latitude, lon: coords.longitude };
      setPoint(value);
      setState("concedida");
      onLocated?.(value);
    }, ({ code }) => {
      setState(geolocationStateFromError(code));
      if (code === 1) stopFollowing();
    }, { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 });
  }, [stopFollowing]);
  useEffect(() => () => {
    if (watchId.current !== null && navigator.geolocation) navigator.geolocation.clearWatch(watchId.current);
  }, []);
  return { state, point, following, toggleFollowing };
}

export default function HomeClient() {
  const location = useLocation();
  const [origin, setOrigin] = useState<Origin>(center);
  const [hasChosenOrigin, setHasChosenOrigin] = useState(false);
  const [selected, setSelected] = useState<Fountain | null>(null);
  const [sheetCollapsed, setSheetCollapsed] = useState(false);
  const [tab, setTab] = useState<"mapa" | "lista" | "favoritos">("mapa");
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [searchText, setSearchText] = useState("");
  const [searchError, setSearchError] = useState("");
  const [selectingOrigin, setSelectingOrigin] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [maxKm, setMaxKm] = useState(8);
  const [greenOnly, setGreenOnly] = useState(false);
  const [excludeSeasonal, setExcludeSeasonal] = useState(false);
  const [statusFilter, setStatusFilter] = useState("todas");
  const [geocoding, setGeocoding] = useState(false);
  const [incidentType, setIncidentType] = useState<IncidentKind>("averiada");
  const [incidentNote, setIncidentNote] = useState("");
  const [showIncident, setShowIncident] = useState(false);
  const [notice, setNotice] = useState("");
  const [recenter, setRecenter] = useState<Point | null>(null);
  const lastGeocodeAt = useRef(0);

  useEffect(() => { setFavoriteIds(getFavorites()); setIncidents(getIncidents()); }, []);

  const actualOrigin = useMemo(() => location.point && !hasChosenOrigin ? { ...location.point, label: "Tu ubicación" } : origin, [location.point, hasChosenOrigin, origin]);
  const results = useMemo(() => findNearby(fountains, actualOrigin, { maxDistanceKm: maxKm, greenOnly, excludeSeasonal, status: statusFilter as "todas" | Fountain["status"] })
    .filter(({ fountain }) => !searchText.trim() || `${fountain.name} ${fountain.address ?? ""} ${fountain.location ?? ""} ${fountain.neighborhood ?? ""}`.toLocaleLowerCase("es").includes(searchText.trim().toLocaleLowerCase("es"))),
  [actualOrigin, maxKm, greenOnly, excludeSeasonal, statusFilter, searchText]);
  const visibleResults = useMemo(() => tab === "favoritos" ? results.filter(({ fountain }) => favoriteIds.includes(fountain.id)) : results, [tab, results, favoriteIds]);
  const mapFountains = useMemo(() => visibleResults.map((entry) => entry.fountain), [visibleResults]);
  const activeFilterCount = Number(maxKm < 8) + Number(greenOnly) + Number(excludeSeasonal) + Number(statusFilter !== "todas");

  const toggleGeolocation = () => {
    if (location.following) { location.toggleFollowing(); return; }
    setHasChosenOrigin(false);
    location.toggleFollowing(setRecenter);
  };
  const useMapOrigin = (point: Point) => { setOrigin({ ...point, label: "Punto elegido en el mapa" }); setHasChosenOrigin(true); setSelectingOrigin(false); };
  const chooseFountain = useCallback((fountain: Fountain) => { setSelected(fountain); setRecenter(fountain); }, []);
  const toggleFavorite = (id: string) => setFavoriteIds(saveFavorite(id));

  const searchAddress = async (event: React.FormEvent) => {
    event.preventDefault();
    const query = searchText.trim();
    if (query.length < 3) { setSearchError("Escribe una dirección o lugar (3 caracteres como mínimo). El mapa también permite elegir el origen."); return; }
    if (Date.now() - lastGeocodeAt.current < 1000) { setSearchError("Espera un segundo antes de buscar otra dirección."); return; }
    lastGeocodeAt.current = Date.now();
    setGeocoding(true); setSearchError("");
    try {
      const response = await fetch("/api/geocode", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "No se encontraron resultados.");
      if (!data.length) throw new Error("No se encontró ese lugar dentro de Zaragoza.");
      const candidate = data[0] as Origin;
      setOrigin({ ...candidate, label: candidate.label.split(",").slice(0, 3).join(",") }); setHasChosenOrigin(true); setRecenter(candidate); setSelected(null); setSearchText("");
    } catch (error) { setSearchError(error instanceof Error ? error.message : "No se pudo buscar el lugar."); }
    finally { setGeocoding(false); }
  };

  const submitIncident = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected) return;
    const incident = { id: crypto.randomUUID(), fountainId: selected.id, kind: incidentType, observedAt: new Date().toISOString(), ...(incidentNote.trim() ? { note: incidentNote.trim() } : {}) };
    const parsed = incidentSchema.safeParse(incident);
    if (!parsed.success || !saveIncident(parsed.data)) { setNotice("No se pudo guardar la observación en este dispositivo."); return; }
    setIncidents((current) => [...current, parsed.data]); setIncidentNote(""); setShowIncident(false);
    setNotice("Observación guardada solo en este dispositivo; no se ha enviado al Ayuntamiento ni se ha cambiado el estado oficial.");
  };

  return <main className="app-shell relative">
    <div className="map-region" aria-label="Mapa de fuentes públicas de agua">
      <MapView fountains={mapFountains} selectedId={selected?.id} userPoint={location.point} origin={hasChosenOrigin ? origin : null} recenter={recenter} chooseOrigin={useMapOrigin} onSelect={chooseFountain} selectingOrigin={selectingOrigin}/>
      <header className="topbar">
        <button className="icon-button location-button" onClick={toggleGeolocation} aria-label={location.following ? "Dejar de seguir mi ubicación" : "Seguir mi ubicación"} title={location.following ? "Dejar de seguir" : "Seguir mi ubicación"} aria-pressed={location.following}><LocateFixed size={21}/></button>
      </header>
      <section className="search-box" aria-label="Buscar un lugar">
        <form onSubmit={searchAddress}><Search size={18} aria-hidden="true"/><input value={searchText} onChange={(event) => { setSearchText(event.target.value); setSearchError(""); }} placeholder="Dirección, parque o fuente" aria-label="Buscar dirección, parque o fuente"/><button type="submit" disabled={geocoding} aria-label="Buscar">{geocoding ? <span className="tiny-spinner"/> : <Navigation size={17}/>}</button></form>
        {searchError && <p className="inline-error" role="alert">{searchError}</p>}
        <div className="search-subrow"><button type="button" className="subtle-button" onClick={() => { setSelectingOrigin(true); setNotice("Toca un punto del mapa para elegir el origen."); }}>Elegir origen en el mapa</button><button type="button" className="filter-trigger" onClick={() => setShowFilters((value) => !value)} aria-expanded={showFilters} aria-controls="filters-panel"><SlidersHorizontal size={16}/> Filtros{activeFilterCount > 0 && <span className="count-badge" aria-label={`${activeFilterCount} filtros activos`}>{activeFilterCount}</span>} <ChevronDown size={14}/></button></div>
        <div className="filters-panel" id="filters-panel" hidden={!showFilters}><label>Distancia máxima <span>{maxKm} km</span><input type="range" min="0.5" max="20" step="0.5" value={maxKm} onChange={(event) => setMaxKm(Number(event.target.value))}/></label><label className="check-label"><input type="checkbox" checked={greenOnly} onChange={(event) => setGreenOnly(event.target.checked)}/> Solo parques y zonas verdes identificados</label><label>Estado disponible<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="todas">Todos los estados</option><option value="operativa">En servicio municipal</option><option value="averiada">Averiada (con evidencia)</option><option value="cerrada">Cerrada (con evidencia)</option><option value="fuera-de-servicio">Fuera de servicio</option><option value="desconocida">Desconocido</option></select></label><label className="check-label"><input type="checkbox" checked={excludeSeasonal} onChange={(event) => setExcludeSeasonal(event.target.checked)}/> Excluir puntos marcados estacionales</label><p>La estacionalidad solo se muestra cuando la etiqueta existe en OSM.</p><button type="button" className="clear-filters" onClick={() => { setMaxKm(8); setGreenOnly(false); setExcludeSeasonal(false); setStatusFilter("todas"); }}>Restablecer filtros</button></div>
      </section>
      {selectingOrigin && <div className="map-controls"><button className="map-control active" onClick={() => setSelectingOrigin(false)}><X size={18}/><span>Cancelar origen</span></button></div>}
      <div className="map-legend" aria-label="Leyenda del mapa"><span><i className="legend-dot"/> Ayuntamiento</span><span><i className="legend-dot community"/> OSM · sin coincidencia municipal</span><span><i className="legend-dot unknown"/> Estado desconocido</span></div>
      <div className="attribution-note">Mapa © OpenStreetMap · <a href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noreferrer">Informar de un error</a></div>
      <section className={`bottom-sheet ${selected ? "has-selection" : ""} ${sheetCollapsed ? "collapsed" : ""}`} aria-label="Resultados de fuentes">
        <div className="sheet-handle" aria-label="Arrastra para plegar o mostrar la tarjeta" onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); event.currentTarget.dataset.startY = String(event.clientY); }} onPointerUp={(event) => { const startY = Number(event.currentTarget.dataset.startY); const delta = event.clientY - startY; if (delta > 40) setSheetCollapsed(true); else if (delta < -40) setSheetCollapsed(false); }} /><div className="sheet-header"><div><span className="eyebrow">{tab === "favoritos" ? "TUS PUNTOS GUARDADOS" : "CERCA DE TI"}</span><h1>{selected ? selected.name : `${visibleResults.length} fuentes`}</h1><p>{selected ? selected.location ?? selected.address ?? "Zaragoza" : `Desde ${location.point ? "tu ubicación" : actualOrigin.label}`}</p></div><button className="collapse-button" onClick={() => setSheetCollapsed((value) => !value)} aria-label={sheetCollapsed ? "Mostrar resultados" : "Ocultar resultados"} aria-expanded={!sheetCollapsed}><ChevronDown size={18}/></button></div>
        {!selected ? <>
          <nav className="tabs" aria-label="Vistas"><button className={tab !== "favoritos" ? "selected" : ""} aria-pressed={tab !== "favoritos"} onClick={() => setTab("mapa")}><MapPin size={16}/> Cercanas</button><button className={tab === "favoritos" ? "selected" : ""} aria-pressed={tab === "favoritos"} onClick={() => { setFavoriteIds(getFavorites()); setTab("favoritos"); }}><Bookmark size={15}/> Favoritos {favoriteIds.length > 0 && <span className="count-badge">{favoriteIds.length}</span>}</button></nav>
          <div className="list-meta"><span>En línea recta · ordenadas por distancia</span><button onClick={() => { setRecenter(location.point ?? origin); }}><Compass size={15}/> Centrar</button></div>
          <div className="results-list" role="list">
            {visibleResults.slice(0, 40).map(({ fountain, distance }) => <button className="result-row" key={fountain.id} onClick={() => chooseFountain(fountain)} role="listitem"><span className={`result-drop ${fountain.source === "OpenStreetMap (comunidad)" ? "community" : ""}`}><Droplets size={18}/></span><span className="result-copy"><strong>{fountain.name}</strong><small>{fountain.location ?? fountain.address ?? (fountain.source === "OpenStreetMap (comunidad)" ? "Punto cartografiado por la comunidad" : "Ubicación municipal")}</small><span className={`status-mini ${fountain.source === "OpenStreetMap (comunidad)" ? "unknown" : fountain.status === "operativa" ? "ok" : fountain.status === "desconocida" ? "unknown" : "off"}`}>{statusText(fountain)}</span></span><span className="result-distance">{formatDistance(distance)}</span></button>)}
            {visibleResults.length === 0 && <div className="empty-state"><Droplets size={25}/><strong>No hay fuentes con estos filtros</strong><span>Amplía la distancia o cambia algún filtro.</span><button onClick={() => { setMaxKm(20); setGreenOnly(false); setExcludeSeasonal(false); setStatusFilter("todas"); setSearchText(""); }}>Quitar filtros</button></div>}
            {visibleResults.length > 40 && <p className="more-results">Mostrando las 40 más cercanas. Acerca el mapa para explorar más.</p>}
          </div>
        </> : <div className="detail-content">
          <button className="back-link" onClick={() => setSelected(null)}><X size={15}/> Volver a resultados</button>
          <div className={`status-pill ${selected.source === "OpenStreetMap (comunidad)" ? "community-pill" : selected.status === "operativa" ? "good" : selected.status === "desconocida" ? "muted" : "bad"}`}><span/> {statusText(selected)}</div>
          <p className="address-line"><MapPin size={16}/>{selected.address ?? selected.location ?? "Sin dirección publicada"}</p>
          <div className="detail-distance"><span>Distancia en línea recta</span><strong>{formatDistance(distanceMeters(actualOrigin, selected))}</strong></div>
          {hasSeasonalEvidence(selected) && <p className="detail-extra">Disponibilidad estacional según OSM: {typeof selected.seasonal === "string" && selected.seasonal !== "yes" ? selected.seasonal : "marcada como estacional"}. No es un calendario verificado.</p>}
          {selected.accessibility && <p className="detail-extra">Accesibilidad según OSM: {selected.accessibility === "yes" ? "accesible para silla de ruedas" : selected.accessibility === "no" ? "no accesible para silla de ruedas" : selected.accessibility}.</p>}
          <div className="action-grid single-action"><button className="secondary-action" onClick={() => toggleFavorite(selected.id)}>{favoriteIds.includes(selected.id) ? <Check size={17}/> : <Bookmark size={17}/>} {favoriteIds.includes(selected.id) ? "Guardado" : "Guardar"}</button></div>
          <div className="external-links"><a href={`https://www.google.com/maps/dir/?api=1&destination=${selected.lat},${selected.lon}&travelmode=walking`} target="_blank" rel="noreferrer">Google Maps ↗</a><a href={`https://maps.apple.com/?daddr=${selected.lat},${selected.lon}&dirflg=w`} target="_blank" rel="noreferrer">Apple Maps ↗</a></div>
          <div className="source-card"><div><ShieldAlert size={16}/><strong>Procedencia y fiabilidad</strong></div><p>{selected.source === "Ayuntamiento de Zaragoza" ? "Ayuntamiento de Zaragoza · conjunto publicado en julio de 2023. La ficha no aporta fecha de inspección individual." : `OpenStreetMap · dato comunitario${selected.sourceUpdatedAt ? ` (base de datos ${new Date(selected.sourceUpdatedAt).toLocaleDateString("es-ES")})` : ""}. No es una confirmación municipal.`} Nivel de confianza de procedencia: {selected.confidence}.</p><a href={selected.sourceUrl} target="_blank" rel="noreferrer">Ver fuente original ↗</a>{selected.matchedOsm?.map((match) => <p className="matched-source" key={match.id}>También figura en OpenStreetMap (comunidad){match.seasonal && match.seasonal !== "no" ? ` con disponibilidad estacional: ${match.seasonal === "yes" ? "marcada como estacional" : match.seasonal}` : ""}{match.accessibility ? ` y accesibilidad etiquetada como ${match.accessibility}` : ""}. <a href={match.sourceUrl} target="_blank" rel="noreferrer">Ver dato comunitario ↗</a>. No confirma el estado municipal.</p>)}</div>
          <button className="report-link" onClick={() => setShowIncident((value) => !value)}><ShieldAlert size={16}/> Informar de una incidencia <span>(solo local)</span></button>
          {showIncident && <form className="incident-form" onSubmit={submitIncident}><label>¿Qué has observado?<select value={incidentType} onChange={(event) => setIncidentType(event.target.value as IncidentKind)}><option value="averiada">Parece averiada</option><option value="cerrada">Cerrada temporalmente</option><option value="inaccesible">Parece inaccesible</option><option value="informacion-incorrecta">Información incorrecta</option></select></label><label>Nota (opcional)<textarea maxLength={500} value={incidentNote} onChange={(event) => setIncidentNote(event.target.value)} placeholder="Describe brevemente lo observado"/></label><button className="primary-action" type="submit"><Send size={15}/> Guardar observación en este dispositivo</button><small>No se envía al Ayuntamiento ni cambia el estado de la fuente.</small></form>}
          {incidents.filter((item) => item.fountainId === selected.id).length > 0 && <p className="local-observation">Hay {incidents.filter((item) => item.fountainId === selected.id).length} observaciones locales en este dispositivo.</p>}
        </div>}
      </section>
      {notice && <div className="toast" role="status">{notice}<button aria-label="Cerrar aviso" onClick={() => setNotice("")}><X size={16}/></button></div>}
      <div className="location-status" aria-live="polite">{location.state === "denegada" ? "Ubicación denegada. Puedes elegir el origen en el mapa." : location.state === "no-disponible" ? "Ubicación no disponible." : location.state === "pendiente" ? "Buscando ubicación precisa…" : location.state === "concedida" ? "Ubicación disponible" : ""}</div>
    </div>
    <footer className="site-footer"><span><Droplets size={14}/> {municipalFountains.length} municipales + {osmFountains.length} candidatos OSM</span><Link href="/fuentes">Datos</Link><Link href="/privacidad">Privacidad</Link></footer>
  </main>;
}

function formatDistance(meters: number) { return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1).replace(".", ",")} km`; }
