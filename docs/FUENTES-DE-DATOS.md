# Fuentes, licencias y límites del inventario

## Propuestas comunitarias

El formulario de propuesta requiere configuración opcional de Supabase. Sin ella no se guardan propuestas y la interfaz lo indica claramente. La migración `supabase/migrations/20261018000000_fountain_proposals.sql` crea una tabla con inserción anónima restringida a estado `pending`, sin lectura, edición ni borrado públicos. La revisión se realiza manualmente desde Supabase. Las propuestas, incluso las aprobadas, no se incorporan automáticamente al inventario ni al mapa; deben verificarse y añadirse explícitamente al snapshot mantenido en el repositorio.

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

La consulta puntual de Overpass del 16/10/2026 devolvió 526 elementos `amenity=drinking_water` en el área de consulta; tres con acceso `private`/`no` se excluyeron. El snapshot local contiene 523 candidatos, con timestamp de base OSM `2026-10-16T10:41:20Z`. Los puntos sin coincidencia fiable se muestran con icono morado, confianza media, URL de objeto y etiqueta comunitaria. Una etiqueta `disused:*`/`abandoned` se muestra como estado comunitario, nunca como municipal. Las coincidencias se agrupan bajo el punto municipal solo si están a 15 m o menos, tienen evidencia coincidente de calle o ubicación y forman una pareja única; la ficha municipal conserva un enlace al registro comunitario. La proximidad sola no demuestra identidad y los casos ambiguos permanecen visibles.

## Estrategia de normalización y deduplicación

El WFS municipal se descarga en EPSG:4326 a un snapshot versionado. `codigo`/ID de entidad se preservan como identificador y nunca se deduplican entre sí si solo están próximas (el conjunto tiene fuentes contiguas que pueden estar a pocos metros). El importador OSM conserva ID, geometría, etiquetas, licencia y timestamp; excluye candidatos sin etiquetas explícitas de agua potable y acceso `private`/`no`. La conciliación municipal-OSM requiere distancia máxima de 15 m, evidencia normalizada coincidente y relación única más cercana en ambas direcciones; los casos ambiguos se mantienen separados. Ambos identificadores y procedencias quedan enlazados para que la conciliación sea revisable. Las fuentes municipales tienen confianza alta en su procedencia; OSM tiene confianza media en la procedencia comunitaria, no en su estado actual.

## Actualización

Ejecute `npm run data:update` con conectividad al WFS. El script pagina el servicio, valida que la respuesta esté suficientemente completa y no sustituye el snapshot ante un fallo. Revise el número de elementos y `git diff` antes de confirmar cambios. Para reconstruir totalmente una descarga si reaparece el error de reproyección, solicite páginas más pequeñas y registre los índices fallidos; nunca rellene posiciones con coordenadas inventadas.

Para actualizar los candidatos OSM, ejecute `npm run osm:update`. Realiza una consulta Overpass delimitada al área de Zaragoza y respeta una sola consulta de extracción manual; no se llama por marcador ni por usuario. Los servidores públicos tienen recursos compartidos y aplican carga/limitación, así que ante un fallo conserva el snapshot local y vuelve a intentarlo más tarde. Atribución OSM: © OpenStreetMap contributors, ODbL.

## Cartografía y otros servicios

- Teselas: `tile.openstreetmap.org`, © OpenStreetMap contributors, ODbL. Servicio comunitario de mejor esfuerzo, sin SLA. El cliente carga únicamente las teselas visibles, respeta la caché del navegador y muestra atribución. Se sigue la [política de teselas](https://operations.osmfoundation.org/policies/tiles/); para alto tráfico, configure un proveedor compatible o publique su propio servicio.
- Geocodificación: búsqueda puntual en Nominatim (máximo 1 consulta por segundo, sin autocompletado), con atribución OSM y [política de uso](https://operations.osmfoundation.org/policies/nominatim/). La consulta ocurre solo al enviar la búsqueda y no se transmite la ubicación del usuario como dirección. El cliente aplica un intervalo mínimo y la API limita consultas por instancia.
- Navegación: cada ficha ofrece enlaces a Google Maps y Apple Maps. La distancia calculada en Fuentes Zaragoza es en línea recta, no una ruta a pie.
- No se encontró en el catálogo consultado un conjunto del Gobierno de Aragón que sustituya el inventario municipal de fuentes. La calidad del agua municipal trata muestreos/redes de consumo, no ubicación/estado de fuentes individuales.

## Propuestas comunitarias

La página `/proponer` permite enviar una fuente que no aparece en las capas municipal ni OSM. La coordenada exacta es obligatoria; nombre, referencia de ubicación y descripción son opcionales. Se informa al usuario de que las coordenadas se harán públicas si la propuesta se aprueba. No se solicita correo ni otros datos personales. Las propuestas quedan en estado `pending` y no se sirven en el mapa; solo las filas `approved` se publican con procedencia propia «Fuente propuesta (comunidad)». No se altera el inventario municipal ni la procedencia OSM.

La revisión está en `/moderacion`. Inicie sesión con Supabase Auth; la API vuelve a validar cada token y su correo debe figurar en `MODERATOR_EMAILS`. La lista se configura solo en el servidor. Las transiciones aceptadas por la API son de pendiente a aprobada o rechazada. Una coincidencia a menos de 100 m genera un aviso a quien propone, pero no descarta el envío automáticamente.

Para habilitar esta función, cree un proyecto Supabase, ejecute `supabase/migrations/202610170001_community_sources.sql` y copie `.env.example` a `.env.local`. Configure `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` y `MODERATOR_EMAILS` (correos separados por coma). El rol de servicio es secreto: no lo prefije con `NEXT_PUBLIC_`, no lo suba al repositorio ni lo incluya en capturas o registros. Invite las cuentas de moderación desde Supabase Auth y active contraseña u otro proveedor permitido en su proyecto. Sin configuración, las páginas informan que la función no está disponible y las API responden 503.

La tabla tiene RLS habilitado; el acceso público solo puede leer filas aprobadas. Los envíos y cambios de estado pasan por endpoints de servidor con validación; los cambios requieren token válido y correo autorizado. La limitación de cinco propuestas por hora es por dirección de red y en memoria del proceso, por lo que no es global ni persistente entre instancias.
