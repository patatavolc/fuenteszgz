export type GeolocationState = "sin-solicitar" | "pendiente" | "concedida" | "denegada" | "no-disponible";
export function geolocationStateFromError(code: number): GeolocationState {
  if (code === 1) return "denegada";
  if (code === 2 || code === 3) return "no-disponible";
  return "no-disponible";
}

export function locateOnce(onState: (state: GeolocationState) => void, onPosition: (point: { lat: number; lon: number }) => void) {
  if (!navigator.geolocation) { onState("no-disponible"); return undefined; }
  onState("pendiente");
  navigator.geolocation.getCurrentPosition(
    ({ coords }) => { onPosition({ lat: coords.latitude, lon: coords.longitude }); onState("concedida"); },
    ({ code }) => onState(geolocationStateFromError(code)), { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
  );
  return true;
}
