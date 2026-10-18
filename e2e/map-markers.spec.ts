import { expect, test } from "@playwright/test";

test("filter changes reuse the Leaflet cluster group and retained marker instances", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("https://tile.openstreetmap.org/**", (route) => route.abort());

  await page.addInitScript(() => {
    type LeafletApi = {
      marker: (...args: unknown[]) => unknown;
      markerClusterGroup?: (...args: unknown[]) => unknown;
      __markerPerformanceInstrumented?: boolean;
    };
    type InstrumentedWindow = Window & {
      L?: LeafletApi;
      __createdMarkers: number;
      __createdGroups: number;
      __initialMarkersReady: boolean;
    };
    const browserWindow = window as InstrumentedWindow;
    browserWindow.__createdMarkers = 0;
    browserWindow.__createdGroups = 0;
    browserWindow.__initialMarkersReady = false;

    const instrumentLeaflet = (leaflet: LeafletApi) => {
      if (leaflet.__markerPerformanceInstrumented) return;
      leaflet.__markerPerformanceInstrumented = true;

      const markerFactory = leaflet.marker;
      leaflet.marker = (...args) => {
        browserWindow.__createdMarkers += 1;
        return markerFactory(...args);
      };

      let clusterFactory: LeafletApi["markerClusterGroup"];
      Object.defineProperty(leaflet, "markerClusterGroup", {
        configurable: true,
        get: () => clusterFactory,
        set: (factory: NonNullable<LeafletApi["markerClusterGroup"]>) => {
          clusterFactory = (...args) => {
            browserWindow.__createdGroups += 1;
            const options = args[0] as { chunkProgress?: (processed: number, total: number, elapsed: number) => void } | undefined;
            const onChunkProgress = options?.chunkProgress;
            if (options) {
              options.chunkProgress = (processed, total, elapsed) => {
                onChunkProgress?.(processed, total, elapsed);
                if (processed >= total) browserWindow.__initialMarkersReady = true;
              };
            }
            return factory(...args);
          };
        },
      });
    };

    Object.defineProperty(window, "L", {
      configurable: true,
      set: (leaflet: LeafletApi) => {
        Object.defineProperty(window, "L", { configurable: true, enumerable: true, value: leaflet, writable: true });
        instrumentLeaflet(leaflet);
      },
    });
  });

  await page.goto("/");
  await expect(page.locator(".leaflet-container")).toBeVisible();
  await page.waitForFunction(() => (window as Window & { __initialMarkersReady?: boolean }).__initialMarkersReady === true);

  const initialCreations = await page.evaluate(() => {
    const browserWindow = window as Window & { __createdMarkers: number; __createdGroups: number };
    return { markers: browserWindow.__createdMarkers, groups: browserWindow.__createdGroups };
  });
  expect(initialCreations.markers).toBeGreaterThan(0);
  expect(initialCreations.groups).toBe(1);

  const heading = page.locator(".bottom-sheet h1");
  const initialCount = Number((await heading.innerText()).match(/\d+/)?.[0]);
  const filters = page.getByRole("button", { name: /Filtros/ });
  await filters.click();
  const status = page.getByLabel("Estado disponible");
  await status.selectOption("operativa");
  await expect.poll(async () => Number((await heading.innerText()).match(/\d+/)?.[0])).toBeLessThan(initialCount);
  const narrowedCreations = await page.evaluate(() => {
    const browserWindow = window as Window & { __createdMarkers: number; __createdGroups: number };
    return { markers: browserWindow.__createdMarkers, groups: browserWindow.__createdGroups };
  });
  expect(narrowedCreations.markers - initialCreations.markers).toBe(0);
  expect(narrowedCreations.groups - initialCreations.groups).toBe(0);

  await status.selectOption("todas");
  await expect(heading).toHaveText(`${initialCount} fuentes`);
  const creations = await page.evaluate(() => {
    const browserWindow = window as unknown as { __createdMarkers: number; __createdGroups: number };
    return { markers: browserWindow.__createdMarkers, groups: browserWindow.__createdGroups };
  });
  expect(creations.markers - narrowedCreations.markers).toBeGreaterThan(0);
  expect(creations.groups - narrowedCreations.groups).toBe(0);
});
