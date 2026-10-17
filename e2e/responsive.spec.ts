import { expect, test } from "@playwright/test";

test("mobile layout fits the viewport and requests geolocation on entry", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  let requests = 0;
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "geolocation", { configurable: true, value: {
      getCurrentPosition: (success: PositionCallback, error: PositionErrorCallback) => { (window as Window & { __geoRequests?: number }).__geoRequests = ((window as Window & { __geoRequests?: number }).__geoRequests ?? 0) + 1; error({ code: 1, message: "denied", PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 }); },
      watchPosition: (_success: PositionCallback, error: PositionErrorCallback) => { error({ code: 1, message: "denied", PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 }); return 1; },
      clearWatch: () => undefined,
    } });
  });
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.route("https://tile.openstreetmap.org/**", (route) => route.abort());
  await page.goto("/");
  await expect(page.locator(".leaflet-container")).toBeVisible();
  await expect(page.locator(".location-status")).toContainText("Ubicación denegada");
  requests = await page.evaluate(() => (window as Window & { __geoRequests?: number }).__geoRequests ?? 0);
  expect(requests).toBe(1);
  await page.getByRole("button", { name: "Localizarme" }).first().click();
  await expect(page.locator(".location-status")).toContainText("Ubicación denegada");
  requests = await page.evaluate(() => (window as Window & { __geoRequests?: number }).__geoRequests ?? 0);
  expect(requests).toBe(2);
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
  await expect(page.getByRole("button", { name: "Localizarme" }).first()).toBeVisible();
  await expect(page.locator(".leaflet-control-zoom")).toBeVisible();
  expect(pageErrors).toEqual([]);
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
