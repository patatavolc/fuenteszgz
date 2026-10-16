# Fuentes, licencias y límites del inventario

Consulta realizada el **16 de octubre de 2026**.

## Ayuntamiento de Zaragoza (fuente principal)

- Catálogo: [Fuentes de agua para beber, conjunto 2860](https://www.zaragoza.es/web/espacio-de-datos/servicio/catalogo/2860).
- Servicio cartográfico: [WFS municipal](https://idezar-sig.zaragoza.es/servicios/geoserver/medioambiente/wfs?SERVICE=WFS&REQUEST=GetCapabilities). La capa `medioambiente:fuente_agua_potable` permite GeoJSON y reproyección EPSG:4326.
- El catálogo describe **697 elementos**, cobertura Zaragoza, ubicación y campos `codigo`, `ubicacion`, `vial`, coordenadas, color, superficie y `en_servicio`. Indica creación 11/07/2023, última actualización del conjunto 13/07/2023 y estado “Finalizado”; la ficha de catálogo se modificó el 21/04/2026. No se publica fecha individual de observación ni evidencia sanitaria por fuente.
- En la consulta de 16/10/2026, el WFS anunció 653 elementos. Tres posiciones de paginación produjeron error 400 al reproyectar; se guardaron **650 geometrías recuperables**, sin inventar las tres ausentes. La ficha del catálogo y la capa viva no coinciden en el total, así que este snapshot no se anuncia como inventario completo.
- El campo municipal `en_servicio` es información de la capa y se presenta como estado **según el Ayuntamiento**, no como confirmación en tiempo real. Una fecha de actualización de catálogo no equivale a fecha de inspección de una fuente.
- Licencia: las condiciones de reutilización enlazadas desde la ficha municipal (avisos legales del Ayuntamiento). Se conserva atribución y vínculo a la fuente. Revise las condiciones municipales antes de redistribuir derivados fuera de esta aplicación.

## OpenStreetMap (fuente comunitaria complementaria)

OpenStreetMap puede aportar candidatos con `amenity=drinking_water`, `amenity=fountain` combinado con `drinking_water=yes`, `fountain=drinking` y, como indicio a revisar, `drinking_water=yes`. No se considera potable por la mera presencia de un objeto: se requiere una etiqueta explícita compatible y la procedencia se mantiene como comunitaria. Los datos OSM se publican bajo ODbL y requieren atribución a los colaboradores; derivados de bases de datos pueden tener obligaciones share-alike.

La aplicación base no combina silenciosamente candidatos comunitarios con el inventario municipal. Esto evita convertir una cobertura OSM irregular o etiquetas ambiguas en confirmación oficial. Se puede añadir una importación OSM auditada después de revisar etiquetas y duplicados contra el conjunto oficial. El mapa base sí usa OSM y su atribución visible.

## Estrategia de normalización y deduplicación

El WFS municipal se descarga en EPSG:4326 a un snapshot versionado. `codigo`/ID de entidad se preservan como identificador y nunca se deduplican entre sí si solo están próximas (el conjunto tiene fuentes contiguas que pueden estar a pocos metros). Si se importa OSM, se guardará el ID OSM y la etiqueta de potabilidad originales; se compararán puntos a 15 m y nombre/ubicación. La coincidencia será una sugerencia de conciliación, no una prueba de identidad: se conservarán ambos identificadores y la procedencia. Las fuentes municipales tienen confianza alta en su procedencia y precisión del punto publicado; los datos comunitarios tendrán confianza media y la etiqueta exacta se mostrará.

## Actualización

Ejecute `npm run data:update` con conectividad al WFS. El script pagina el servicio, valida que la respuesta esté suficientemente completa y no sustituye el snapshot ante un fallo. Revise el número de elementos y `git diff` antes de confirmar cambios. Para reconstruir totalmente una descarga si reaparece el error de reproyección, solicite páginas más pequeñas y registre los índices fallidos; nunca rellene posiciones con coordenadas inventadas.

## Cartografía y otros servicios

- Teselas: `tile.openstreetmap.org`, © OpenStreetMap contributors, ODbL. Servicio comunitario de mejor esfuerzo, sin SLA. El cliente carga únicamente las teselas visibles, respeta la caché del navegador y muestra atribución. Para alto tráfico, configure un proveedor de teselas compatible o publique su propio servicio.
- Geocodificación: búsqueda puntual en Nominatim (máximo 1 consulta por segundo, sin autocompletado), con atribución OSM. La consulta ocurre solo al enviar la búsqueda y no se transmite la ubicación del usuario como dirección.
- Rutas: openrouteservice con perfil explícito `foot-walking`; requiere clave y sujeto a límites vigentes del plan. La clave solo se configura en el servidor. Sin clave, no se calcula ruta y se conserva la distancia en línea recta claramente etiquetada.
- No se encontró en el catálogo consultado un conjunto del Gobierno de Aragón que sustituya el inventario municipal de fuentes. La calidad del agua municipal trata muestreos/redes de consumo, no ubicación/estado de fuentes individuales.
