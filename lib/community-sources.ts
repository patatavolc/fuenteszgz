import "server-only";
import { distanceMeters, municipalFountains, osmFountains } from "./data";
import type { CommunitySource, Point } from "./types";

export type CommunitySourceRow = {
  id: string;
  lat: number;
  lon: number;
  name: string | null;
  location: string | null;
  description: string | null;
  status: CommunitySource["status"];
  created_at: string;
};

export function toCommunitySource(row: CommunitySourceRow): CommunitySource {
  return { id: row.id, lat: row.lat, lon: row.lon, name: row.name, location: row.location,
    description: row.description, status: row.status, createdAt: row.created_at };
}

export async function hasNearbyCommunitySource(point: Point): Promise<boolean> {
  if ([...municipalFountains, ...osmFountains].some((source) => distanceMeters(point, source) <= 100)) return true;
  const { getSupabaseServiceClient } = await import("./supabase/server");
  const supabase = getSupabaseServiceClient();
  if (!supabase) return false;
  const deltaLat = 100 / 111_000;
  const deltaLon = deltaLat / Math.max(0.2, Math.cos(point.lat * Math.PI / 180));
  const { data } = await supabase.from("community_sources").select("lat,lon")
    .in("status", ["pending", "approved"])
    .gte("lat", point.lat - deltaLat).lte("lat", point.lat + deltaLat)
    .gte("lon", point.lon - deltaLon).lte("lon", point.lon + deltaLon);
  return Boolean(data?.some((row) => distanceMeters(point, row as Point) <= 100));
}
