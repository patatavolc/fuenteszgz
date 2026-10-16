import { expect, test } from "@playwright/test";

test("mobile layout fits the viewport and geolocation is only requested after a tap", async ({ page }) => {
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
  requests = await page.evaluate(() => (window as Window & { __geoRequests?: number }).__geoRequests ?? 0);
  expect(requests).toBe(0);
  await page.getByRole("button", { name: "Localizarme" }).first().click();
  await expect(page.locator(".location-status")).toContainText("Ubicación denegada");
  requests = await page.evaluate(() => (window as Window & { __geoRequests?: number }).__geoRequests ?? 0);
  expect(requests).toBe(1);
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
