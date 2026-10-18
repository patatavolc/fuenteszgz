import { NextResponse } from "next/server";
import { z } from "zod";

const proposalSchema = z.object({
  lat: z.number().finite().min(41.45).max(41.85),
  lon: z.number().finite().min(-1.15).max(-0.65),
  name: z.string().trim().max(120).optional().default(""),
  note: z.string().trim().max(500).optional().default(""),
});

export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Solicitud no válida." }, { status: 400 }); }
  const parsed = proposalSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Revisa las coordenadas y el texto de la propuesta." }, { status: 400 });

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return NextResponse.json({ error: "El envío compartido aún no está configurado. La propuesta no se ha guardado." }, { status: 503 });

  try {
    const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/fountain_proposals`, {
      method: "POST",
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ ...parsed.data, status: "pending" }),
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return NextResponse.json({ error: "No se pudo guardar la propuesta. Inténtalo más tarde." }, { status: 502 });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "No se pudo conectar para guardar la propuesta." }, { status: 502 });
  }
}
