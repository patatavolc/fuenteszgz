export type Point = { lat: number; lon: number };
export type OperatingStatus = "operativa" | "averiada" | "cerrada" | "fuera-de-servicio" | "desconocida";
export type Provenance = "Ayuntamiento de Zaragoza" | "OpenStreetMap (comunidad)" | "Fuente propuesta (comunidad)";

export type Fountain = Point & {
  id: string;
  name: string;
  /** Official source code, kept as secondary metadata rather than the public label. */
  officialCode?: string;
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
  /** Local generation time for the snapshot; it is not a source update time. */
  snapshotGeneratedAt?: string;
  confidence: "alta" | "media";
  osmTags?: Record<string, string>;
  matchedOsm?: Fountain[];
  communityStatus?: "pending" | "approved" | "rejected";
  description?: string;
};

export type CommunitySourceStatus = "pending" | "approved" | "rejected";
export type CommunitySource = Point & {
  id: string;
  name: string | null;
  location: string | null;
  description: string | null;
  status: CommunitySourceStatus;
  createdAt: string;
};

export type IncidentKind = "averiada" | "cerrada" | "inaccesible" | "informacion-incorrecta";
export type Incident = { id: string; fountainId: string; kind: IncidentKind; observedAt: string; note?: string };
export type Origin = Point & { label: string };
