# Cambios

## Sin publicar

- Los registros municipales prevalecen sobre candidatos OSM que coinciden con evidencia de calle/ubicación y proximidad única; la ficha conserva la referencia comunitaria.
- Ajustes de accesibilidad y diseño responsivo, con cobertura de navegador para filtros, búsqueda, detalles, favoritos y tamaños móvil/escritorio.
- Propuestas comunitarias de fuentes con coordenadas precisas, cola de moderación privada en Supabase y publicación solo tras aprobación.
- Requisito de ejecución actualizado a Node.js 22+ por el SDK de Supabase; actualiza la versión configurada en Vercel antes del despliegue.

## 0.1.0 — 2026-10-16

- Inicio del proyecto personal Fuentes Zaragoza.
- Investigación del catálogo y servicios cartográficos municipales; snapshots recuperados: 650 registros municipales y 523 candidatos OSM (no se afirma cobertura completa).
- Mapa Leaflet mobile-first con clústeres, ubicación explícita, filtros, proximidad, favoritos e incidencias locales.
- Geocodificación Nominatim detrás de endpoint de servidor; enlaces externos a Google Maps y Apple Maps.
- Documentación de fuentes, licencias, privacidad, limitaciones, actualización de datos y despliegue Vercel.
- Pruebas unitarias y pruebas de navegador Playwright para móvil/escritorio.
