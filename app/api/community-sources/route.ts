import { NextResponse } from "next/server";
import { communitySourceSubmissionSchema } from "@/lib/validation";
import { hasNearbyCommunitySource, toCommunitySource, type CommunitySourceRow } from "@/lib/community-sources";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const submissionTimes = new Map<string, number[]>();
function allowSubmission(request: Request): boolean {
  const address = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? request.headers.get("x-real-ip") ?? "unknown";
  const now = Date.now();
  const recent = (submissionTimes.get(address) ?? []).filter((time) => now - time < 60 * 60 * 1000);
  if (recent.length >= 5) return false;
  recent.push(now);
  submissionTimes.set(address, recent);
  return true;
}

export async function GET() {
  const supabase = getSupabaseServiceClient();
  if (!supabase) return NextResponse.json({ error: "Las propuestas comunitarias no están configuradas." }, { status: 503 });
  const { data, error } = await supabase.from("community_sources")
    .select("id,lat,lon,name,location,description,status,created_at")
    .eq("status", "approved").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: "No se pudieron cargar las fuentes comunitarias." }, { status: 502 });
  return NextResponse.json((data as CommunitySourceRow[]).map(toCommunitySource), {
    headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" },
  });
}

export async function POST(request: Request) {
  if (!allowSubmission(request)) return NextResponse.json({ error: "Has enviado varias propuestas. Inténtalo más tarde." }, { status: 429 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Solicitud no válida." }, { status: 400 }); }
  const parsed = communitySourceSubmissionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Revisa las coordenadas y los campos del formulario." }, { status: 400 });
  const supabase = getSupabaseServiceClient();
  if (!supabase) return NextResponse.json({ error: "Las propuestas comunitarias no están configuradas." }, { status: 503 });
  const point = { lat: parsed.data.lat, lon: parsed.data.lon };
  const duplicateNearby = await hasNearbyCommunitySource(point);
  const { data, error } = await supabase.from("community_sources").insert({
    ...point,
    name: parsed.data.name ?? null,
    location: parsed.data.location ?? null,
    description: parsed.data.description ?? null,
    status: "pending",
  }).select("id,lat,lon,name,location,description,status,created_at").single();
  if (error || !data) return NextResponse.json({ error: "No se pudo guardar la propuesta." }, { status: 502 });
  return NextResponse.json({ source: toCommunitySource(data as CommunitySourceRow), duplicateNearby }, { status: 201 });
}
