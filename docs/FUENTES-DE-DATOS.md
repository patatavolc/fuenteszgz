# Fuentes, licencias y límites del inventario

Consulta realizada el **16 de octubre de 2026**.

## Ayuntamiento de Zaragoza (fuente principal)

- Catálogo: [Fuentes de agua para beber, conjunto 2860](https://www.zaragoza.es/web/espacio-de-datos/servicio/catalogo/2860).
- Servicio cartográfico: [WFS municipal](https://idezar-sig.zaragoza.es/servicios/geoserver/medioambiente/wfs?SERVICE=WFS&REQUEST=GetCapabilities). La capa `medioambiente:fuente_agua_potable` permite GeoJSON y reproyección EPSG:4326.
- El catálogo describe **697 elementos**, cobertura Zaragoza, ubicación y campos `codigo`, `ubicacion`, `vial`, coordenadas, color, superficie y `en_servicio`. Indica creación 11/07/2023, última actualización del conjunto 13/07/2023 y estado “Finalizado”; la ficha de catálogo se modificó el 21/04/2026. No se publica fecha individual de observación ni evidencia sanitaria por fuente.
- En la consulta de 16/10/2026, el WFS anunció 653 elementos. Tres posiciones de paginación produjeron error 400 al reproyectar; se guardaron **650 geometrías recuperables**, sin inventar las tres ausentes. La ficha del catálogo y la capa viva no coinciden en el total, así que este snapshot no se anuncia como inventario completo.
- El campo municipal `en_servicio` es información de la capa y se presenta como estado **según el Ayuntamiento**, no como confirmación en tiempo real. Una fecha de actualización de catálogo no equivale a fecha de inspección de una fuente.
- Licencia: condiciones generales municipales de reutilización; autorizan usos comerciales y no comerciales y la modificación/adaptación. Exigen atribuir el Ayuntamiento, indicar la fecha de actualización cuando el documento original la incluya, conservar metadatos aplicables y no insinuar patrocinio municipal. El aviso también excluye garantías de continuidad y de ausencia de errores. La app enlaza a la fuente, muestra julio de 2023 como última actualización indicada y aclara que es un proyecto independiente.

## OpenStreetMap (fuente comunitaria complementaria)

OpenStreetMap puede aportar candidatos con `amenity=drinking_water`, `amenity=fountain` combinado con `drinking_water=yes`, `fountain=drinking` y, como indicio a revisar, `drinking_water=yes`. No se considera potable por la mera presencia de un objeto: se requiere una etiqueta explícita compatible y la procedencia se mantiene como comunitaria. Los datos OSM se publican bajo ODbL y requieren atribución a los colaboradores; derivados de bases de datos pueden tener obligaciones share-alike.

La consulta puntual de Overpass del 16/10/2026 devolvió 526 elementos `amenity=drinking_water` en el área de consulta; tres con acceso `private`/`no` se excluyeron. El snapshot local contiene 523 candidatos, con timestamp de base OSM `2026-10-16T10:41:20Z`. Se conservan separados y con icono morado, confianza media, URL de objeto y etiqueta comunitaria. Una etiqueta `disused:*`/`abandoned` se muestra como estado comunitario, nunca como municipal. No se deduplican automáticamente contra puntos municipales porque proximidad no demuestra identidad.

## Estrategia de normalización y deduplicación

El WFS municipal se descarga en EPSG:4326 a un snapshot versionado. `codigo`/ID de entidad se preservan como identificador y nunca se deduplican entre sí si solo están próximas (el conjunto tiene fuentes contiguas que pueden estar a pocos metros). El importador OSM conserva ID, geometría, etiquetas, licencia y timestamp; excluye candidatos sin etiquetas explícitas de agua potable y acceso `private`/`no`. Los puntos OSM no se fusionan espacialmente con los municipales. Ambos identificadores y la procedencia quedan visibles para que futuras conciliaciones sean revisables. Las fuentes municipales tienen confianza alta en su procedencia; OSM tiene confianza media en la procedencia comunitaria, no en su estado actual.

## Actualización

Ejecute `npm run data:update` con conectividad al WFS. El script pagina el servicio, valida que la respuesta esté suficientemente completa y no sustituye el snapshot ante un fallo. Revise el número de elementos y `git diff` antes de confirmar cambios. Para reconstruir totalmente una descarga si reaparece el error de reproyección, solicite páginas más pequeñas y registre los índices fallidos; nunca rellene posiciones con coordenadas inventadas.

Para actualizar los candidatos OSM, ejecute `npm run osm:update`. Realiza una consulta Overpass delimitada al área de Zaragoza y respeta una sola consulta de extracción manual; no se llama por marcador ni por usuario. Los servidores públicos tienen recursos compartidos y aplican carga/limitación, así que ante un fallo conserva el snapshot local y vuelve a intentarlo más tarde. Atribución OSM: © OpenStreetMap contributors, ODbL.

## Cartografía y otros servicios

- Teselas: `tile.openstreetmap.org`, © OpenStreetMap contributors, ODbL. Servicio comunitario de mejor esfuerzo, sin SLA. El cliente carga únicamente las teselas visibles, respeta la caché del navegador y muestra atribución. Se sigue la [política de teselas](https://operations.osmfoundation.org/policies/tiles/); para alto tráfico, configure un proveedor compatible o publique su propio servicio.
- Geocodificación: búsqueda puntual en Nominatim (máximo 1 consulta por segundo, sin autocompletado), con atribución OSM y [política de uso](https://operations.osmfoundation.org/policies/nominatim/). La consulta ocurre solo al enviar la búsqueda y no se transmite la ubicación del usuario como dirección. El cliente aplica un intervalo mínimo y la API limita consultas por instancia.
- Rutas: openrouteservice con perfil explícito `foot-walking`; requiere clave y sujeto a límites vigentes del plan. La clave solo se configura en el servidor. La página de planes consultada lista el Standard a 0 € con 2.000 rutas/día y 40/minuto; el dashboard de la cuenta prevalece y límites/precios pueden cambiar. Sin clave, no se calcula ruta y se conserva la distancia en línea recta claramente etiquetada.
- No se encontró en el catálogo consultado un conjunto del Gobierno de Aragón que sustituya el inventario municipal de fuentes. La calidad del agua municipal trata muestreos/redes de consumo, no ubicación/estado de fuentes individuales.
