# Fuentes Zaragoza

Aplicación web personal mobile-first para localizar fuentes públicas para beber en Zaragoza. Usa Next.js App Router, TypeScript, Tailwind CSS, Leaflet y react-leaflet. El mapa y las funciones principales trabajan con el snapshot municipal incluido; la geolocalización y la geocodificación son optativas.

## Requisitos y desarrollo

- Node.js 22 o superior y npm. El cliente oficial de Supabase utilizado para propuestas comunitarias requiere Node.js 22+.
- Clona el repositorio existente y ejecuta:

```sh
npm install
cp .env.example .env.local
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000). Para producción y verificación:

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm start
```

Pruebas de navegador para tamaños móviles y escritorio (tras compilar):

```sh
npx playwright install chromium
npm run test:e2e
```

En la revisión del proyecto, `npm audit --omit=dev` no reportó vulnerabilidades de producción. El audit completo sí señala 5 avisos altos en la cadena de herramientas de ESLint (`braces`/`micromatch` bajo `eslint-config-next`), instalada solo para desarrollo y lint; se deben reevaluar al actualizarla.

No se necesita cuenta, base de datos ni clave para explorar los inventarios locales. El envío compartido de propuestas requiere Supabase; las incidencias y favoritos siguen siendo locales al navegador. Al entrar se solicita permiso para usar la ubicación; si se deniega, se puede elegir el origen en el mapa. En producción requiere HTTPS. El catálogo municipal autoriza la reutilización comercial y no comercial bajo condiciones de atribución, fecha y no respaldo institucional; véase el aviso municipal en la documentación.

## Funciones

- Mapa Leaflet con agrupación progresiva de marcadores, controles de zoom táctiles, atribución OSM y selección de fuente. Las coincidencias fiables aparecen con pin municipal y la referencia comunitaria queda enlazada en la ficha.
- Resultados cercanos ordenados por distancia en línea recta; distancia siempre identificada como tal.
- Búsqueda local en nombres/ubicaciones y búsqueda puntual de direcciones con Nominatim al enviar el formulario (sin autocompletado).
- Solicitud de geolocalización al entrar, localización puntual y seguimiento explícito con botón para detenerlo. También se puede elegir origen tocando el mapa.
- Filtros combinables de distancia, zonas verdes identificadas, estado y exclusión estacional cuando OSM aporta esa etiqueta. La ficha muestra accesibilidad solo cuando el dato existe.
- Ficha con procedencia, estado disponible, favoritos locales, incidencias locales y enlaces a Google/Apple Maps.
- Propuestas de fuentes con revisión manual y publicación comunitaria tras aprobación; requiere Supabase configurado.

## Datos, licencias y limitaciones

El inventario procede del [catálogo municipal de Fuentes de agua para beber](https://www.zaragoza.es/web/espacio-de-datos/servicio/catalogo/2860), con capa WFS IDEZar `medioambiente:fuente_agua_potable`. La ficha describe 697 elementos y última actualización 13/07/2023. En la consulta del 16/10/2026 el WFS anunció 653; se pudieron recuperar 650 geometrías en EPSG:4326 tras errores de reproyección en tres índices. No se afirma que la cobertura sea completa. `en_servicio` se presenta como dato del Ayuntamiento, no como garantía de que la fuente funcione hoy. No hay fecha de inspección individual.

OpenStreetMap aporta también 523 candidatos comunitarios consultados el 16/10/2026 mediante Overpass. Los candidatos sin coincidencia fiable se muestran diferenciados de las fuentes municipales y como no confirmados oficialmente; las coincidencias fiables se agrupan bajo el registro municipal y conservan un enlace al dato OSM en la ficha. La consulta selecciona `amenity=drinking_water` y otras etiquetas explícitas de agua potable; excluye elementos etiquetados con acceso privado/no. Sus teselas y datos requieren atribución OSM y están bajo sus condiciones (ODbL para la base de datos). Las teselas estándar son de mejor esfuerzo y no ofrecen capacidad ilimitada; el mapa solo pide teselas visibles, sin descarga offline ni precarga. Para cargas elevadas debe configurarse un proveedor compatible.

Consulta [Fuentes, licencias y límites](docs/FUENTES-DE-DATOS.md) y la página `/fuentes` en la aplicación. Este producto no es información de emergencia; comprueba la fuente en el lugar.

## Actualizar el inventario

`npm run data:update` pagina el WFS municipal, reproyecta a EPSG:4326 y guarda el snapshot en `data/municipal-snapshot.geojson`. Si algunas geometrías fallan, se recuperan las páginas en bloques menores y se omiten únicamente las que el servidor no puede transformar. El script no reemplaza los datos ante una respuesta sustancialmente incompleta. `npm run osm:update` actualiza los candidatos OSM mediante una consulta acotada de Overpass (no es una llamada por visitante). Revisa los conteos y el diff, actualiza `docs/FUENTES-DE-DATOS.md` y registra el cambio en `CHANGELOG.md`.

## Geocodificación

La búsqueda se hace explícitamente mediante `/api/geocode` y Nominatim. No se envía la ubicación del navegador al geocodificador. La instancia pública de Nominatim tiene capacidad limitada (máximo publicado de una consulta por segundo) y prohíbe autocompletado. Para uso intensivo, contrata un proveedor o aloja una instancia propia.

## Incidencias y privacidad

Las incidencias se validan y guardan en localStorage. No se envían al Ayuntamiento, no son compartidas, no modifican el estado oficial y pueden borrarse al limpiar los datos del navegador. La ubicación no se guarda ni se envía a Fuentes Zaragoza. Véase `/privacidad`.

## Despliegue en Vercel

1. Importa el repositorio existente en Vercel y deja Framework Preset en Next.js.
2. Usa Node.js 22.x o superior; el comando de build es `npm run build`.
3. Despliega. La geolocalización funcionará bajo HTTPS.

Para habilitar propuestas, aplica la migración Supabase descrita en [Fuentes, licencias y límites](docs/FUENTES-DE-DATOS.md) y configura las variables de entorno de `.env.example` en Vercel. El snapshot municipal y OSM sigue empaquetado con la app. Verifica que el proveedor cartográfico y sus licencias aceptan tu volumen previsto; OSM estándar es para uso moderado y sin SLA.

## Arquitectura

- `app/`: rutas App Router, páginas de transparencia y endpoint de geocodificación.
- `components/map-view.tsx`: mapa Leaflet cargado dinámicamente solo en cliente y marcadores agrupados.
- `lib/data.ts`: validación, normalización, deduplicación, distancias y filtros.
- `lib/geolocation.ts`, `lib/local-storage.ts`, `lib/validation.ts`: geolocalización, favoritos/incidencias y esquemas.
- `data/`: snapshots municipal y OSM GeoJSON.
- `scripts/update-data.ts`, `scripts/update-osm.ts`: actualizaciones reproducibles.
- `tests/`: pruebas de datos, filtros, almacenamiento y permisos.
- `e2e/`: comprobación de viewport móvil/escritorio, permiso explícito de geolocalización y controles del mapa.

## Mejoras futuras

- Conciliar una importación puntual de etiquetas OSM con identificadores de origen y revisión manual de duplicados.
- Añadir un endpoint de reporte compartido con moderación, rate limiting distribuido y almacenamiento protegido.
- Mostrar límites municipales de parques para clasificar zonas verdes con geometría, en vez de inferirlos desde la ubicación textual.
- Añadir alertas por antigüedad y una comprobación periódica de cambios en el WFS.
- Evaluar un proveedor de teselas y geocodificación contratado si el uso supera el servicio público comunitario.
