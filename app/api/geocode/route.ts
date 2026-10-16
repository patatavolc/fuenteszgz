import { NextResponse } from "next/server";
import { z } from "zod";

const querySchema = z.string().trim().min(3).max(120);
let lastRequestAt = 0;
export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Solicitud no válida." }, { status: 400 }); }
  const query = querySchema.safeParse((body as { query?: unknown })?.query);
  if (!query.success) return NextResponse.json({ error: "Escribe al menos 3 caracteres." }, { status: 400 });
  if (Date.now() - lastRequestAt < 1000) return NextResponse.json({ error: "Espera un segundo antes de buscar otra dirección." }, { status: 429 });
  lastRequestAt = Date.now();
  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.search = new URLSearchParams({ q: `${query.data}, Zaragoza, España`, format: "jsonv2", limit: "5", countrycodes: "es", viewbox: "-1.15,41.76,-0.70,41.50", bounded: "1" }).toString();
    const response = await fetch(url, { headers: { "User-Agent": "FuentesZaragoza/0.1 (personal open-data map)" }, signal: AbortSignal.timeout(10000), next: { revalidate: 86400 } });
    if (!response.ok) return NextResponse.json({ error: "El geocodificador no responde." }, { status: 502 });
    const data = await response.json() as Array<{ lat: string; lon: string; display_name: string }>;
    return NextResponse.json(data.map((item) => ({ lat: Number(item.lat), lon: Number(item.lon), label: item.display_name })));
  } catch { return NextResponse.json({ error: "No se pudo buscar esa dirección." }, { status: 502 }); }
}
