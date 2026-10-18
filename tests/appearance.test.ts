import { describe, expect, it } from "vitest";
import { getAppearancePreference, saveAppearancePreference } from "@/lib/appearance";

describe("preferencia de apariencia", () => {
  it("guarda y recupera la opción del usuario en almacenamiento local", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };

    expect(getAppearancePreference(storage)).toBe("system");
    saveAppearancePreference("dark", storage);
    expect(getAppearancePreference(storage)).toBe("dark");
  });

  it("ignora valores almacenados que no sean opciones válidas", () => {
    const storage = { getItem: () => "ultraviolet", setItem: () => undefined };
    expect(getAppearancePreference(storage)).toBe("system");
  });
});
