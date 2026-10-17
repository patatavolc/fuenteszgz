import { describe, expect, it } from "vitest";
import { normalizeCommunitySources, normalizeMunicipalData } from "@/lib/data";
import { communitySourceSubmissionSchema, moderationDecisionSchema } from "@/lib/validation";

describe("community source normalization", () => {
  it("publishes only approved, valid points with a community identity", () => {
    const sources = normalizeCommunitySources([
      { id: "approved-id", lat: 41.65, lon: -0.89, name: null, location: "Parque", description: "Junto al camino", status: "approved", createdAt: "2026-10-17" },
      { id: "pending-id", lat: 41.65, lon: -0.89, status: "pending" },
      { id: "bad-id", lat: 100, lon: -0.89, status: "approved" },
    ]);
    expect(sources).toHaveLength(1);
    expect(sources[0]).toMatchObject({ id: "community:approved-id", name: "Parque", source: "Fuente propuesta (comunidad)", communityStatus: "approved" });
  });

  it("uses a safe fallback when an approved proposal has no label", () => {
    expect(normalizeCommunitySources([{ id: "no-label", lat: 41.65, lon: -0.89, status: "approved" }])[0].name).toBe("Fuente comunitaria");
  });
});

describe("municipal display labels", () => {
  it("uses location and street for the label and retains the stable official code", () => {
    const result = normalizeMunicipalData({ features: [{ id: "F-42", geometry: { type: "Point", coordinates: [-0.89, 41.65] }, properties: { codigo: "F-42", ubicacion: "Parque Grande", vial: "Paseo San Sebastián" } }] });
    expect(result[0]).toMatchObject({ id: "municipal:F-42", name: "Parque Grande · Paseo San Sebastián", officialCode: "F-42" });
  });

  it("falls back to Fuente municipal while retaining the code", () => {
    const result = normalizeMunicipalData({ features: [{ id: "F-43", geometry: { type: "Point", coordinates: [-0.89, 41.65] }, properties: { codigo: "F-43" } }] });
    expect(result[0]).toMatchObject({ name: "Fuente municipal", officialCode: "F-43" });
  });
});

describe("community API validation", () => {
  it("requires exact valid coordinates and explicit public-coordinate consent", () => {
    expect(communitySourceSubmissionSchema.safeParse({ lat: 41.65, lon: -0.89, location: "Parque", consent: true }).success).toBe(true);
    expect(communitySourceSubmissionSchema.safeParse({ lat: 91, lon: -0.89, consent: true }).success).toBe(false);
    expect(communitySourceSubmissionSchema.safeParse({ lat: 41.65, lon: -0.89, consent: false }).success).toBe(false);
    expect(communitySourceSubmissionSchema.safeParse({ lat: 41.65, lon: -0.89, consent: true }).success).toBe(false);
    expect(communitySourceSubmissionSchema.safeParse({ lat: 41.65, lon: -0.89, description: "Junto al parque", consent: true }).success).toBe(true);
    expect(communitySourceSubmissionSchema.safeParse({ lat: 41.65, lon: -0.89, consent: true, status: "approved" }).success).toBe(false);
  });

  it("allows only a server-controlled approve/reject decision", () => {
    expect(moderationDecisionSchema.safeParse({ id: "3b7d4a51-0d1d-45ac-a6a0-a2636ce93401", decision: "approved" }).success).toBe(true);
    expect(moderationDecisionSchema.safeParse({ id: "3b7d4a51-0d1d-45ac-a6a0-a2636ce93401", decision: "pending" }).success).toBe(false);
    expect(moderationDecisionSchema.safeParse({ id: "3b7d4a51-0d1d-45ac-a6a0-a2636ce93401", decision: "approved", reviewed_by: "spoof" }).success).toBe(false);
  });
});
