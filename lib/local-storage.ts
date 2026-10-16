import type { Incident } from "./types";
import { incidentSchema } from "./validation";

const FAVORITES_KEY = "fuenteszgz:favorites:v1";
const INCIDENTS_KEY = "fuenteszgz:incidents:v1";

function readStringArray(key: string): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  } catch { return []; }
}
export function getFavorites(): string[] {
  return [...new Set(readStringArray(FAVORITES_KEY))];
}
export function saveFavorite(id: string): string[] {
  const values = new Set(getFavorites());
  if (values.has(id)) values.delete(id);
  else values.add(id);
  try { localStorage.setItem(FAVORITES_KEY, JSON.stringify([...values])); } catch { /* storage may be disabled or full */ }
  return [...values];
}
export function getIncidents(): Incident[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(INCIDENTS_KEY) ?? "[]");
    if (!Array.isArray(value)) return [];
    return value.map((item) => incidentSchema.safeParse(item)).filter((item) => item.success).map((item) => item.data);
  } catch { return []; }
}
export function saveIncident(incident: Incident): boolean {
  const parsed = incidentSchema.safeParse(incident);
  if (!parsed.success) return false;
  try { localStorage.setItem(INCIDENTS_KEY, JSON.stringify([...getIncidents(), parsed.data])); return true; } catch { return false; }
}
