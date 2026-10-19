import { expect, test } from "@playwright/test";

test("mobile layout keeps geolocation opt-in and controls accessible", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  let requests = 0;
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "geolocation", { configurable: true, value: {
      getCurrentPosition: (success: PositionCallback, error: PositionErrorCallback) => { (window as Window & { __geoRequests?: number }).__geoRequests = ((window as Window & { __geoRequests?: number }).__geoRequests ?? 0) + 1; error({ code: 1, message: "denied", PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 }); },
      watchPosition: (_success: PositionCallback, error: PositionErrorCallback) => { (window as Window & { __geoRequests?: number }).__geoRequests = ((window as Window & { __geoRequests?: number }).__geoRequests ?? 0) + 1; error({ code: 1, message: "denied", PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 }); return 1; },
      clearWatch: () => undefined,
    } });
  });
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.route("https://tile.openstreetmap.org/**", (route) => route.abort());
  await page.goto("/");
  await expect(page.locator(".leaflet-container")).toBeVisible();
  requests = await page.evaluate(() => (window as Window & { __geoRequests?: number }).__geoRequests ?? 0);
  expect(requests).toBe(0);
  await page.getByRole("button", { name: /Seguir mi ubicación/ }).first().click();
  await expect(page.locator(".location-status")).toContainText("Ubicación denegada");
  requests = await page.evaluate(() => (window as Window & { __geoRequests?: number }).__geoRequests ?? 0);
  expect(requests).toBe(1);
  const list = page.getByRole("list");
  await expect(list.getByRole("listitem").first().getByRole("button")).toBeVisible();
  const collapse = page.getByRole("button", { name: "Ocultar resultados" });
  await collapse.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Mostrar resultados" })).toHaveAttribute("aria-expanded", "false");
  await page.keyboard.press("Space");
  await expect(page.getByRole("button", { name: "Ocultar resultados" })).toHaveAttribute("aria-expanded", "true");
  const collapseBox = await collapse.boundingBox();
  if (!collapseBox) throw new Error("Collapse control is not visible");
  await page.mouse.move(collapseBox.x + collapseBox.width / 2, collapseBox.y + collapseBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(collapseBox.x + collapseBox.width / 2, collapseBox.y + collapseBox.height / 2 + 60);
  await page.mouse.up();
  await expect(page.getByRole("button", { name: "Mostrar resultados" })).toHaveAttribute("aria-expanded", "false");
  const dimensions = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width);
  await expect(page.getByRole("textbox", { name: "Buscar dirección, parque o fuente" })).toBeVisible();
  await expect(page.locator(".bottom-sheet")).toBeVisible();
  const zoomBox = await page.locator(".leaflet-control-zoom").boundingBox();
  const sheetBox = await page.locator(".bottom-sheet").boundingBox();
  expect(zoomBox && sheetBox && zoomBox.y + zoomBox.height < sheetBox.y).toBe(true);
  expect(pageErrors).toEqual([]);
});

test("desktop layout remains within the viewport and keeps map controls accessible", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.route("https://tile.openstreetmap.org/**", (route) => route.abort());
  await page.goto("/");
  await expect(page.locator(".leaflet-container")).toBeVisible();
  const dimensions = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width);
  await expect(page.getByRole("button", { name: /Seguir mi ubicación/ }).first()).toBeVisible();
  await expect(page.locator(".leaflet-control-zoom")).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test("location and search stay usable across viewports and the legend distinguishes data provenance", async ({ page }) => {
  await page.route("https://tile.openstreetmap.org/**", (route) => route.abort());
  await page.goto("/");
  const location = page.getByRole("button", { name: /Seguir mi ubicación/ });
  const search = page.getByRole("textbox", { name: "Buscar dirección, parque o fuente" });
  const legend = page.getByRole("region", { name: "Leyenda del mapa" });
  await expect(legend).toBeVisible();
  await expect(legend).toContainText("Ayuntamiento");
  await expect(legend).toContainText("Candidato OpenStreetMap");
  await expect(legend).toContainText("Propuesta comunitaria aprobada");

  for (const viewport of [{ width: 320, height: 720 }, { width: 390, height: 844 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(viewport);
    const [locationBox, searchBox] = await Promise.all([location.boundingBox(), search.boundingBox()]);
    expect(locationBox, `location button at ${viewport.width}px`).not.toBeNull();
    expect(searchBox, `search input at ${viewport.width}px`).not.toBeNull();
    await expect(location).toBeEnabled();
    await expect(search).toBeEnabled();
    expect(locationBox!.width).toBeGreaterThanOrEqual(44);
    expect(locationBox!.height).toBeGreaterThanOrEqual(44);
    for (const [label, box] of [["location", locationBox!], ["search", searchBox!]] as const) {
      expect(box.x, `${label} left edge at ${viewport.width}px`).toBeGreaterThanOrEqual(0);
      expect(box.y, `${label} top edge at ${viewport.width}px`).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width, `${label} right edge at ${viewport.width}px`).toBeLessThanOrEqual(viewport.width);
      expect(box.y + box.height, `${label} bottom edge at ${viewport.width}px`).toBeLessThanOrEqual(viewport.height);
    }
    const overlaps = locationBox!.x < searchBox!.x + searchBox!.width
      && searchBox!.x < locationBox!.x + locationBox!.width
      && locationBox!.y < searchBox!.y + searchBox!.height
      && searchBox!.y < locationBox!.y + locationBox!.height;
    expect(overlaps, `location and search overlap at ${viewport.width}px`).toBe(false);
    if (viewport.width < 760) {
      expect(locationBox!.y + locationBox!.height, `mobile location control stays above search at ${viewport.width}px`).toBeLessThanOrEqual(searchBox!.y);
    } else {
      expect(searchBox!.x + searchBox!.width, "desktop search remains left of location control").toBeLessThanOrEqual(locationBox!.x);
    }
    const dimensions = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
    expect(dimensions.scrollWidth, `horizontal overflow at ${viewport.width}px`).toBeLessThanOrEqual(dimensions.width);
  }

  await expect(legend.locator(".legend-dot")).toHaveCount(4);
});

test("search, filters, fountain details and favorites work on mobile and desktop", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "geolocation", { configurable: true, value: {
      getCurrentPosition: (_success: PositionCallback, error: PositionErrorCallback) => error({ code: 1, message: "denied", PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 }),
      watchPosition: (_success: PositionCallback, error: PositionErrorCallback) => { error({ code: 1, message: "denied", PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 }); return 1; },
      clearWatch: () => undefined,
    } });
  });
  await page.route("https://tile.openstreetmap.org/**", (route) => route.abort());
  await page.goto("/");
  const search = page.getByRole("textbox", { name: "Buscar dirección, parque o fuente" });
  await expect(search).toBeVisible();
  const rows = page.locator(".result-row");
  await expect(rows.first()).toBeVisible();
  const initialCount = await rows.count();

  const filters = page.getByRole("button", { name: /Filtros/ });
  await expect(filters).toHaveAttribute("aria-expanded", "false");
  await filters.click();
  await expect(filters).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("slider", { name: /Distancia máxima/ })).toBeVisible();
  const status = page.getByLabel("Estado disponible");
  await expect(status).toBeVisible();
  await status.selectOption("operativa");
  await status.selectOption("todas");
  await filters.click();

  const firstName = (await rows.first().locator("strong").innerText()).trim();
  await search.fill(firstName);
  await expect(rows.first().locator("strong")).toHaveText(firstName);
  expect(await rows.count()).toBeLessThanOrEqual(initialCount);
  await rows.first().click();
  await expect(page.locator(".detail-content")).toBeVisible();
  await expect(page.getByRole("heading", { name: firstName })).toBeVisible();
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByRole("button", { name: "Guardado" })).toBeVisible();
  await page.getByRole("button", { name: "Volver a resultados" }).click();
  await page.getByRole("button", { name: /Favoritos/ }).click();
  await expect(page.locator(".result-row strong", { hasText: firstName })).toBeVisible();

  for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(viewport);
    const dimensions = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
    expect(dimensions.scrollWidth, `horizontal overflow at ${viewport.width}px`).toBeLessThanOrEqual(dimensions.width);
    await expect(page.getByRole("button", { name: "Localizarme" }).first()).toBeVisible();
    await expect(page.locator(".leaflet-control-zoom")).toBeVisible();
    await expect(page.getByRole("button", { name: /Cercanas/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Favoritos/ })).toBeVisible();
  }
});

test("empty results, geocoding errors and accessible control states are announced", async ({ page }) => {
  await page.route("https://tile.openstreetmap.org/**", (route) => route.abort());
  await page.route("**/api/geocode", (route) => route.fulfill({ status: 502, contentType: "application/json", body: JSON.stringify({ error: "El geocodificador no responde." }) }));
  await page.goto("/");

  await expect(page.getByRole("main")).toBeVisible();
  await expect(page.getByRole("region", { name: "Buscar un lugar" })).toBeVisible();
  const search = page.getByRole("textbox", { name: "Buscar dirección, parque o fuente" });
  await search.fill("Calle Mayor");
  await page.getByRole("button", { name: "Buscar" }).click();
  await expect(page.getByRole("alert")).toHaveText("El geocodificador no responde.");
  await expect(search).toBeVisible();

  await search.fill("lugar sin coincidencias 83920");
  await expect(page.getByText("No hay fuentes con estos filtros")).toBeVisible();
  const clear = page.getByRole("button", { name: "Quitar filtros" });
  await expect(clear).toBeVisible();
  await clear.click();
  await expect(page.locator(".result-row").first()).toBeVisible();

  const filters = page.getByRole("button", { name: /Filtros/ });
  await filters.focus();
  await page.keyboard.press("Enter");
  await expect(filters).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("slider", { name: /Distancia máxima/ })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: /Solo parques y zonas verdes identificados/ })).toBeVisible();
});

test("appearance setting switches theme and persists the choice", async ({ page }) => {
  await page.route("https://tile.openstreetmap.org/**", (route) => route.abort());
  await page.goto("/");

  await page.getByRole("button", { name: "Ajustes" }).click();
  const appearance = page.getByLabel("Apariencia");
  await expect(appearance).toBeVisible();
  await appearance.selectOption("dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator(".bottom-sheet")).toHaveCSS("background-color", "rgb(32, 38, 40)");

  await page.getByRole("button", { name: "Cerrar ajustes" }).click();
  await page.getByRole("button", { name: "Añadir una fuente" }).click();
  const coordinatePicker = page.getByRole("button", { name: "Elegir coordenadas en el mapa" });
  await expect(coordinatePicker).toHaveCSS("background-color", "rgb(41, 50, 53)");
  await expect(coordinatePicker).toHaveCSS("color", "rgb(237, 242, 242)");

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Ajustes" }).click();
  await expect(page.getByLabel("Apariencia")).toHaveValue("dark");
});
