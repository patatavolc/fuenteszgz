import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync(new URL("../components/community-source.module.css", import.meta.url), "utf8");

describe("tema oscuro del formulario comunitario", () => {
  it("adapta sus campos y acciones secundarias a las superficies oscuras", () => {
    expect(styles).toContain(':global(html[data-theme="dark"]) .form input:not([type="checkbox"])');
    expect(styles).toContain(':global(html[data-theme="dark"]) .actions .secondary');
  });
});
