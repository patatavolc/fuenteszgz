import { z } from "zod";

export const pointSchema = z.object({ lat: z.number().finite().min(-90).max(90), lon: z.number().finite().min(-180).max(180) });
export const routeRequestSchema = z.object({ origin: pointSchema, destination: pointSchema });
export const incidentSchema = z.object({
  id: z.string().min(1).max(100), fountainId: z.string().min(1).max(100),
  kind: z.enum(["averiada", "cerrada", "inaccesible", "informacion-incorrecta"]),
  observedAt: z.string().datetime(), note: z.string().max(500).optional(),
});
