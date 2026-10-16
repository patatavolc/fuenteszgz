import { NextResponse } from "next/server";
import { routeRequestSchema } from "@/lib/validation";

export const runtime = "nodejs";
const cache = new Map<string, { expires: number; result: unknown }>();
const requestsByClient = new Map<string, number[]>();

function allowRouteRequest(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",").map((value) => value.trim()).filter(Boolean);
  const client = request.headers.get("x-real-ip") ?? forwarded?.at(-1) ?? "unknown";
  const now = Date.now();
  const recent = (requestsByClient.get(client) ?? []).filter((time) => now - time < 60_000);
  if (recent.length >= 15) return false;
  recent.push(now);
  requestsByClient.set(client, recent);
  if (requestsByClient.size > 500) requestsByClient.delete(requestsByClient.keys().next().value as string);
  return true;
}

export async function POST(request: Request) {
  const key = process.env.ORS_API_KEY;
  if (!key) return NextResponse.json({ error: "La ruta a pie no está configurada. Añade ORS_API_KEY en el servidor." }, { status: 503 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Solicitud JSON no válida." }, { status: 400 }); }
  const parsed = routeRequestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Coordenadas no válidas." }, { status: 400 });
  const { origin, destination } = parsed.data;
  if (Math.abs(origin.lat - destination.lat) + Math.abs(origin.lon - destination.lon) > 1.5) {
    return NextResponse.json({ error: "El origen y destino deben estar en el entorno de Zaragoza." }, { status: 400 });
  }
  const cacheKey = [origin.lat, origin.lon, destination.lat, destination.lon].map((n) => n.toFixed(4)).join(",");
  const hit = cache.get(cacheKey);
  if (hit && hit.expires > Date.now()) return NextResponse.json(hit.result);
  if (!allowRouteRequest(request)) return NextResponse.json({ error: "Se ha alcanzado el límite temporal de rutas. Espera un minuto y vuelve a intentarlo." }, { status: 429 });
  try {
    const response = await fetch("https://api.openrouteservice.org/v2/directions/foot-walking/geojson", {
      method: "POST", headers: { Authorization: key, "Content-Type": "application/json" },
      body: JSON.stringify({ coordinates: [[origin.lon, origin.lat], [destination.lon, destination.lat]] }),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      const status = response.status === 429 ? 429 : response.status >= 500 ? 502 : 422;
      const error = response.status === 429 ? "El proveedor ha limitado las rutas. Prueba más tarde." : response.status === 403 ? "El proveedor rechazó la ruta por cuota o configuración de clave." : "No se pudo calcular una ruta peatonal para este origen.";
      return NextResponse.json({ error }, { status });
    }
    const data = await response.json() as { features?: Array<{ geometry?: { coordinates?: number[][] }; properties?: { summary?: { distance?: number; duration?: number } } }> };
    const feature = data.features?.[0];
    const summary = feature?.properties?.summary;
    const coordinates = feature?.geometry?.coordinates;
    if (!summary || !coordinates?.length || !Number.isFinite(summary.distance) || !Number.isFinite(summary.duration)) {
      return NextResponse.json({ error: "El proveedor devolvió una ruta incompleta." }, { status: 502 });
    }
    const result = { coordinates: coordinates.map(([lon, lat]) => ({ lat, lon })), distanceMeters: summary.distance, durationSeconds: summary.duration };
    cache.set(cacheKey, { result, expires: Date.now() + 5 * 60_000 });
    if (cache.size > 250) cache.delete(cache.keys().next().value as string);
    return NextResponse.json(result, { headers: { "Cache-Control": "private, max-age=60" } });
  } catch {
    return NextResponse.json({ error: "El servicio de rutas no responde. Comprueba tu conexión e inténtalo de nuevo." }, { status: 502 });
  }
}
