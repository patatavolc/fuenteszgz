import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  plugins: [{
    name: "geojson-modules",
    transform(code, id) { return id.endsWith(".geojson") ? `export default ${code}` : null; },
  }],
  test: { environment: "node", include: ["tests/**/*.test.ts"] },
});
