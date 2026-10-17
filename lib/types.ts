export type Point = { lat: number; lon: number };
export type OperatingStatus = "operativa" | "averiada" | "cerrada" | "fuera-de-servicio" | "desconocida";
export type Provenance = "Ayuntamiento de Zaragoza" | "OpenStreetMap (comunidad)";

export type Fountain = Point & {
  id: string;
  name: string;
  address?: string;
  location?: string;
  district?: string;
  neighborhood?: string;
  status: OperatingStatus;
  statusSource?: string;
  isGreenArea?: boolean;
  seasonal?: string | boolean;
  accessibility?: string;
  source: Provenance;
  sourceUrl: string;
  sourceUpdatedAt?: string;
  confidence: "alta" | "media";
  osmTags?: Record<string, string>;
  matchedOsm?: Fountain[];
};

export type IncidentKind = "averiada" | "cerrada" | "inaccesible" | "informacion-incorrecta";
export type Incident = { id: string; fountainId: string; kind: IncidentKind; observedAt: string; note?: string };
export type Origin = Point & { label: string };
