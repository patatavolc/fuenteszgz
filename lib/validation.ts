import { z } from "zod";

export const pointSchema = z.object({ lat: z.number().finite().min(-90).max(90), lon: z.number().finite().min(-180).max(180) });
export const incidentSchema = z.object({
  id: z.string().min(1).max(100), fountainId: z.string().min(1).max(100),
  kind: z.enum(["averiada", "cerrada", "inaccesible", "informacion-incorrecta"]),
  observedAt: z.string().datetime(), note: z.string().max(500).optional(),
});

export const communitySourceSubmissionSchema = z.object({
  lat: pointSchema.shape.lat,
  lon: pointSchema.shape.lon,
  name: z.string().trim().max(80).optional().transform((value) => value || undefined),
  location: z.string().trim().max(160).optional().transform((value) => value || undefined),
  description: z.string().trim().max(500).optional().transform((value) => value || undefined),
  consent: z.literal(true),
}).strict().refine((value) => Boolean(value.name || value.location || value.description), {
  message: "Añade al menos un nombre, una referencia de ubicación o una descripción.",
});

export const moderationDecisionSchema = z.object({
  id: z.string().uuid(),
  decision: z.enum(["approved", "rejected"]),
}).strict();
