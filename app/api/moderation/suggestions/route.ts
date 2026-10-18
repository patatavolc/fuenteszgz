import { NextResponse } from "next/server";
import { moderationDecisionSchema } from "@/lib/validation";
import { toCommunitySource, type CommunitySourceRow } from "@/lib/community-sources";
import { isAuthorizedModerator } from "@/lib/supabase/moderator";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function authorize(request: Request) {
  return isAuthorizedModerator(request.headers.get("authorization"));
}

export async function GET(request: Request) {
  if (!await authorize(request)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const supabase = getSupabaseServiceClient();
  if (!supabase) return NextResponse.json({ error: "Moderación no configurada." }, { status: 503 });
  const { data, error } = await supabase.from("community_sources")
    .select("id,lat,lon,name,location,description,status,created_at")
    .eq("status", "pending").order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: "No se pudieron cargar las propuestas." }, { status: 502 });
  return NextResponse.json((data as CommunitySourceRow[]).map(toCommunitySource));
}

export async function PATCH(request: Request) {
  if (!await authorize(request)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Solicitud no válida." }, { status: 400 }); }
  const parsed = moderationDecisionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Decisión no válida." }, { status: 400 });
  const supabase = getSupabaseServiceClient();
  if (!supabase) return NextResponse.json({ error: "Moderación no configurada." }, { status: 503 });
  const { data, error } = await supabase.from("community_sources").update({
    status: parsed.data.decision,
    reviewed_at: new Date().toISOString(),
  }).eq("id", parsed.data.id).eq("status", "pending")
    .select("id,lat,lon,name,location,description,status,created_at").maybeSingle();
  if (error) return NextResponse.json({ error: "No se pudo actualizar la propuesta." }, { status: 502 });
  if (!data) return NextResponse.json({ error: "La propuesta ya no está pendiente o no existe." }, { status: 409 });
  return NextResponse.json(toCommunitySource(data as CommunitySourceRow));
}
