# Progreso de desarrollo — Mapa de Gasolineras

Este archivo es el tablero de avance del proyecto. Se actualiza junto con
`USER_STORIES.md`: una tarea solo pasa a completada cuando su implementación y
sus pruebas han terminado correctamente.

## Estado actual

- **Fase activa:** Fase 1 — MVP: descubrir y comparar
- **Historia activa:** US-13 — Elegir combustible
- **Siguiente historia:** US-13 — Elegir combustible
- **Tarea pendiente:** T-13.1 — Selector de combustible con las opciones del MVP
- **Última tarea completada:** TEST-12.3 — Un fallo o límite del geocodificador
  ofrece reintentar sin perder la ubicación anterior
- **Porcentaje de tareas completadas:** 47 / 150
- **Pruebas automatizadas:** 133 / 140 casos planificados (121 unitarias + 12 E2E)

## Historias

| ID | Historia | Fase | Estado |
| --- | --- | --- | --- |
| US-01 | Sistema visual y temas | 0 | Completada |
| US-02 | Estructura y navegación | 0 | Completada |
| US-03 | Diseño adaptable del explorador | 0 | Completada |
| US-04 | Accesibilidad transversal | 0 | Completada |
| US-05 | Base de calidad frontend y backend | 0 | Completada |
| US-06 | Importar estaciones y precios oficiales | 1 | Completada |
| US-07 | Almacenar datos geoespaciales e históricos | 1 | Completada |
| US-08 | Consultar gasolineras cercanas | 1 | Completada |
| US-09 | Consultar el detalle de una estación | 1 | Completada |
| US-10 | Visualizar el mapa interactivo | 1 | Completada |
| US-11 | Obtener ubicación del dispositivo | 1 | Completada |
| US-12 | Buscar una ubicación manualmente | 1 | Completada |
| US-13–US-22 | MVP: descubrir y comparar | 1 | Pendiente |
| US-23–US-30 | Planificador de rutas sin cuenta | 2 | Pendiente |
| US-31–US-35 | Personalización con cuenta | 3 | Pendiente |
| US-36–US-38 | Análisis y administración | 4 | Pendiente |

## Reglas de actualización

- Al empezar una tarea, marcarla como `En curso` aquí y anotar la fecha.
- Al terminarla, marcar la casilla correspondiente en `USER_STORIES.md`,
  actualizar el recuento y dejar el siguiente paso preparado.
- Una historia solo puede marcarse como completada cuando todas sus tareas y
  pruebas pasan.
- Si una prueba falla correctamente porque recibe datos inválidos, debe
  comprobarse también que el caso válido equivalente funciona.

## Registro

| Fecha | Elemento | Cambio | Resultado |
| --- | --- | --- | --- |
| 2026-08-15 | T-01.1 | Tokens visuales base | Completada |
| 2026-08-15 | T-01.2 | Tema claro y oscuro | Completada |
| 2026-08-15 | T-01.3 | Selector y persistencia de tema | Completada |
| 2026-08-15 | T-01.4 | Verificación de contraste WCAG AA | Completada |
| 2026-08-15 | TEST-US-01 | Tests del selector, tokens y contraste | 13/13 pasan |
| 2026-08-15 | TEST-US-02 | Tests de metadatos SEO | 2/2 pasan |
| 2026-08-15 | TEST-US-02 | Tests de navegación y rutas activas | 7/7 pasan |
| 2026-08-15 | T-02.1 | Layout base de Astro | Completada; build validado |
| 2026-08-15 | T-02.2 | Cabecera con marca, navegación y tema | Completada; build validado |
| 2026-08-15 | T-02.3 | Navegación responsive y estado activo | Completada; build validado |
| 2026-08-15 | T-02.4 | Metadatos SEO por página | Completada; tests y build validados |
| 2026-08-15 | T-03.1 | Diseño e integración del panel lateral y mapa de escritorio | Completada; comprobación estática validada |
| 2026-08-15 | T-03.2 | Inicio del panel inferior deslizable para móvil | En curso |
| 2026-08-15 | T-03.2 | Mapa a pantalla completa y panel inferior contraíble | Completada; comprobación estática validada |
| 2026-08-15 | T-03.3 | Puntos de ruptura, áreas táctiles y scroll interno | Completada; comprobación estática validada |
| 2026-08-16 | Mantenimiento — entorno Docker de desarrollo | Completada | Compose con perfiles, imágenes de desarrollo y documentación; configuración e imágenes validadas. |
| 2026-08-16 | Mantenimiento — compatibilidad ARM64 de PostGIS | Completada | Imagen nativa basada en PostgreSQL 15; PostGIS 3.6 y la inicialización se validaron en contenedor. |
| 2026-08-16 | T-05.4 — CI y validación de despliegues | Completada | Flujos de GitHub Actions: tests+build en `dev`, tests+build en PR a `main` y despliegue (Oracle back+bd, Cloudflare Pages front) al hacer push a `main`. |
| 2026-08-16 | T-03.4 | Pruebas responsive de ExplorerWorkspace en escritorio, tableta y móvil | 12/12 tests responsive pasan; tests frontend 39/39 y build Astro validados |
| 2026-08-16 | Validación visual T-03.4 | Capturas y comprobación con Playwright en 320×568, 375×812, 800×1024 y 1440×900 | Sin overflow horizontal; panel móvil abre, cierra y desplaza; controles con altura mínima de 44 px |
| 2026-08-16 | Seguridad — revisión de inyecciones | Auditoría de vectores de inyección (XSS, SQL, comandos, cabeceras) y endurecimiento | Sin vectores de entrada no confiable; cabeceras de seguridad en frontend y API; política documentada en AGENTS.md |
| 2026-08-16 | T-04.1 | Etiquetas, nombres accesibles y foco visible en controles, filtros, paneles y marcadores | 12/12 tests de accesibilidad pasan; axe-core sin violaciones WCAG A/AA en móvil y escritorio |
| 2026-08-16 | T-04.2 | Orden de foco y cierre con teclado del panel inferior | 9/9 tests del panel; Escape cierra y devuelve foco, aria-expanded sincronizado; verificado en navegador real |
| 2026-08-16 | T-04.3 | Precio, ahorro y combustible sin depender solo del color | Etiqueta de combustible con texto + punto decorativo; 5 tests de semántica de color y 6 de contraste no textual (3:1); axe sin violaciones |
| 2026-08-16 | T-04.4 | Pruebas de teclado y lector de pantalla con Playwright | 8/8 tests E2E pasan: orden de foco, activación por teclado y roles/nombres accesibles en móvil y escritorio; integrado en CI |
| 2026-08-16 | T-05.1 | Scripts de lint, pruebas y build (frontend y backend) | ESLint + `astro check` + scripts `lint`/`typecheck`/`check`; `task test` ejecuta backend, unitario y E2E |
| 2026-08-16 | T-05.2 | Vitest y React Testing Library para componentes React | Confirmado: pruebas de componentes que interactúan con la interfaz (`ThemeToggle`, `HelloApi`) |
| 2026-08-16 | T-05.3 | Convenciones de DTO, errores de API y variables de entorno | Documentadas en AGENTS.md |
| 2026-08-16 | TEST-US-05 | Verificación completa de calidad | `npm run check` (typecheck + lint + 71 unitarios + 8 E2E + build) pasa en limpio |
| 2026-08-17 | T-06.1 | Cliente del Geoportal/MITECO | DTOs JSON, cliente REST con MockRestServiceServer, 6/6 tests; API real verificada (JSON, 11k estaciones) |
| 2026-08-17 | T-06.1 | Taskfile: defer + --ansi never + -T | DB se para tras tests; spinner ANSI y TTY corregidos |
| 2026-08-17 | T-06.2 | Normalización de datos del Geoportal | FuelType, NormalizedStation, GeoportalStationNormalizer; 15/15 tests pasan |
| 2026-08-17 | T-06.3 | Importación periódica con registro | FuelStationImportService, FuelStationImportScheduler, SchedulerConfig; 5/5 tests |
| 2026-08-17 | T-06.4 | Manejo de proveedor no disponible | El servicio atrapa FuelStationDataClientException y devuelve fallo sin tocar datos; ya cubierto por tests existentes |
| 2026-08-17 | T-07.1 | Entidades JPA con PostGIS | Station (Point 4326), CurrentPrice, PriceSnapshot + repositorios; 3/3 tests de persistencia pasan |
| 2026-08-17 | T-07.2 | Índices espaciales y de consulta | SpatialIndexInitializer (GIST) + @Index en PriceSnapshot; se eliminó schema.sql por conflicto en tests |
| 2026-08-17 | T-07.3 | Reglas de actualización e idempotencia | FuelStationPersistenceService con upsert (station, current_price) y snapshots idempotentes por fecha; 5/5 tests |
| 2026-08-17 | Mantenimiento | Scheduler disparaba la importación en tests | Añadido initialDelayString a @Scheduled; daemon threads en TaskScheduler |
| 2026-08-17 | T-07.4 | Pruebas de repositorio y validación | @PrePersist/@PreUpdate valida coordenadas; tests de rechazo de geometría fuera de rango y combustible nulo; 45/45 tests |
| 2026-08-17 | T-08.1 | Endpoint GET /api/stations/nearby | StationController + StationService + consulta espacial ST_DWithin; proyección NearbyStationProjection |
| 2026-08-17 | T-08.2 | Distancia, precio, ahorro y fecha | StationService calcula distancia km, mejor precio y ahorro; orden por precio/distancia/ahorro |
| 2026-08-17 | T-08.3 | Validación de parámetros y errores | InvalidParameterException + ApiError + GlobalExceptionHandler; lat/lon/radio/combustible/orden validados con 400 |
| 2026-08-17 | T-08.4 | Pruebas de servicio, controlador y espaciales | StationServiceTest 5, StationControllerTest 7, NearbyStationQueryTest 3; 60/60 tests |
| 2026-08-17 | T-09.1 | Endpoint GET /api/stations/{id} | StationDetailDto + StationService.getStationDetail + ResourceNotFoundException |
| 2026-08-17 | T-09.2 | Ficha completa con precios | Dirección, marca, horario, tipoVenta, margen y precios por combustible |
| 2026-08-17 | T-09.3 | Error 404 comprensible | ResourceNotFoundException → ApiError NOT_FOUND |
| 2026-08-17 | T-09.4 | Pruebas de contrato | StationServiceTest 8, StationControllerTest 9; 65/65 tests |
| 2026-08-17 | T-10.1 | Isla React Leaflet | LeafletMap.tsx con import dinámico (`await import('leaflet')`), tipo `client:load` |
| 2026-08-17 | T-10.2 | Proveedor de teselas configurable | `PUBLIC_MAP_TILE_URL` con OpenStreetMap por defecto; 7/7 tests de LeafletMap |
| 2026-08-17 | T-10.3 | Vista, zoom y atribución | zoomControl:false + `L.control.zoom` con títulos en español; zoom 3–19; marcadores con `keyboard:true` |
| 2026-08-17 | T-10.4 | Fallback de mapa | Alternativa de listado si el mapa no carga; E2E y unitarios cubren el fallo de teselas |
| 2026-08-17 | TEST-US-10 | Verificación completa de US-10 | Unitarios 78/78, typecheck/lint/build limpios, E2E 8/8 (orden de foco adaptado a Leaflet) |
| 2026-08-17 | Mantenimiento — aislamiento de tests | `test:backend` usa `docker-compose.test.yml` con `db-test` + `backend-test` y volumen propio `postgres-test-data` | Los tests ya no apagan la BD de desarrollo ni comparten sus datos; verificado con la BD de dev levantada (sigue healthy tras `task test`) |
| 2026-08-17 | Mantenimiento — parpadeo del selector de tema | Script inline al final del body parchea el botón antes de pintar; `useState` con inicializador perezoso lee `window.__gasolinerasTheme` | Sin parpadeo de "Oscuro" al cargar/volver a la pestaña; sin mismatch de hidratación; 78/78 unitarios y 8/8 E2E pasan |
| 2026-08-17 | T-11.1 | Geolocalización solo con acción explícita | LocationButton: `getCurrentPosition` solo al pulsar "Usar mi ubicación"; test de no llamada en montaje |
| 2026-08-17 | T-11.2 | Centrar mapa y consulta de cercanía | Evento `gasolineras:location` → LeafletMap `setView` (zoom 15) y marcadores reordenados por distancia (haversine); coordenadas fuera de rango se ignoran |
| 2026-08-17 | T-11.3 | Explicación y alternativa manual | Mensajes por estado (denegado/timeout/no disponible/no soportado/inválido) con `role="alert"` y botón que enfoca `#explorer-search` |
| 2026-08-17 | T-11.4 | Pruebas de estados de geolocalización | 12 tests de LocationButton (concedido, denegado, timeout, no disponible, no soportado, inválido, reintento) + 11 de lib/geolocation + 2 de LeafletMap; 103/103 unitarios |
| 2026-08-17 | TEST-US-11 | Verificación E2E de geolocalización | E2E 12/12 (concedido y denegado en escritorio y móvil); typecheck/lint/build limpios |
| 2026-08-17 | Mantenimiento — banner de estado del backend | `z-index: 1100` (por encima de los paneles de Leaflet, que llegan a 1000) y reintento automático cada 5 s en HelloApi | El banner ya no queda oculto tras las teselas del mapa ni muestra "No se pudo conectar" para siempre si el backend aún no estaba listo; 104/104 unitarios y 12/12 E2E |
| 2026-08-17 | Mantenimiento — cleanup de RTL y flakiness E2E | `afterEach(cleanup)` en setup.ts (con `globals:false` el auto-cleanup no se registra) y espera de hidratación (botón "Acercar mapa") antes de pulsar "Usar mi ubicación" | El DOM ya no se acumula entre tests; el click ya no se pierde si la isla no estaba hidratada (fallaba 1/10); 8/8 repeticiones de geolocalización verdes |
| 2026-08-17 | Mantenimiento — vista inicial de España completa | `SPAIN_BOUNDS` (península, Baleares y Canarias) en `lib/spainBounds.ts` y prop `bounds` en LeafletMap que usa `fitBounds` al iniciar | El mapa muestra España entera al abrir la web (El Hierro, estaca de Bares, Baleares y Canarias verificados con tests); 108/108 unitarios y 12/12 E2E |
| 2026-08-17 | Mantenimiento — zoom máximo sobre el territorio | `SPAIN_BOUNDS` ajustado a los extremos reales (El Hierro 27,63/‑18,16; Estaca de Bares/Cabo Favaritx 43,8/4,33) y padding de `fitBounds` reducido de 24 a 8 px | `fitBounds` aplica el máximo zoom que encaja todo el territorio sin huecos fuera de los extremos (tests de límites); 109/109 unitarios y 12/12 E2E |
| 2026-08-17 | Mantenimiento — encuadre centrado, margen de 14 px bajo Canarias y zoom fluido | `SPAIN_BOUNDS` simétrico respecto al centro de la península (≈39,9ºN, 3,1ºO) extendido justo hasta El Hierro; cuando la altura limita el encuadre, el mapa se centra en `PENINSULA_CENTER` y el zoom se calcula para dejar el borde inferior del encuadre a exactamente 18 px del borde inferior (el zoom resultante no cae en la rejilla de `zoomSnap`, que se desactiva solo durante esa vista inicial); la rueda nativa de Leaflet (acumulaba el delta del navegador y redondeaba hacia arriba a la rejilla, con saltos grandes) se sustituye por un manejador propio con pasos fijos de 0.25 iguales a los botones + y -, acumulando el delta en píxeles enteros para que cada "notch" o gesto de trackpad cuente un paso; el manejador usa `setZoomAround(punto del ratón, …)` con animación: `animate: false` hacía parpadear la pantalla (las teselas viejas desaparecían al instante mientras cargaban las nuevas) y `zoomIn`/`zoomOut` centraban en el mapa; la animación mantiene las teselas escaladas hasta el final, y como Leaflet ignora los zooms que llegan durante una animación en curso, cada paso finaliza primero la animación anterior con `_onZoomTransitionEnd` (el patrón del manejador nativo, que usa `map._stop()`) para que la rueda rápida no pierda pasos; el primer intento usaba `map.zoomBy`, que no existe en Leaflet (los tests unitarios no lo detectaron por el mock; lo cazó una sonda E2E en navegador real); `zoomSnap` y `zoomDelta` a 0.25 | La península queda centrada exactamente y el margen bajo Canarias es de 18 px exactos en escritorio (zoom 4.830 con el viewport de escritorio); solo queda fuera el borde artificial norte del rectángulo (lat >52º, territorio no español); la rueda hace zoom en pasos uniformes de 0.25 centrados en el puntero, animados sin parpadeo y contando cada toque aunque se gire rápido (verificado con E2E real: tres toques seguidos suben de tesela z5 a z6 y dos bajan); en ventanas estrechas el encuadre sigue centrado; 115/115 unitarios, 13/13 E2E, lint y typecheck limpios |
| 2026-08-17 | Mantenimiento — el mapa llena todo el alto de la ventana | `.explorer` medía `height: calc(100vh - 5.25rem)` pero la cabecera real ocupa 4.75rem (76 px), dejando una franja de 8 px de fondo de página bajo el mapa; se sustituye por flex: `.app-shell` flex column con `height: 100dvh` (con `min-height` el shell crecía con el contenido y el mapa acababa midiendo 974 px), `main` con `flex: 1` y `min-height: 0`, y `.explorer` con `flex: 1` y fila de grid `minmax(0, 1fr)` para que el panel lateral siga desplazándose internamente; en móvil se elimina la altura fija del media query | El mapa llega exactamente hasta el borde inferior del viewport (verificado con E2E que compara el borde del `.leaflet-map__container` con `innerHeight`); el zoom inicial de escritorio pasa a 4.849 (644 px de mapa) manteniendo el margen de 18 px bajo Canarias; 116/116 unitarios, 14/14 E2E (4 skipped), lint y typecheck limpios |
| 2026-08-17 | T-12.1 | Campo de búsqueda con sugerencias y debounce | SearchBox (combobox ARIA con listbox, teclado ArrowUp/Down/Enter/Escape, blur diferido, `SEARCH_DEBOUNCE_MS` 350, mínimo 3 caracteres) integrado en ExplorerWorkspace; 11 tests unitarios |
| 2026-08-17 | T-12.2 | Geocodificador vía backend con caché y límites | GET /api/geocode/search con proveedor Nominatim (User-Agent, jsonv2, 8 resultados), caché Caffeine (2000, 24 h) y límite de 30 peticiones/min (ventana deslizante); 400/429/503 con ApiError; 18/18 tests backend |
| 2026-08-17 | T-12.3 | Centrar el mapa al elegir una sugerencia | Selección despacha `gasolineras:location` (misma ruta que geolocalización) y confirma con `role="status"` "Gasolineras actualizadas a …"; E2E verifica teselas de zoom 15 |
| 2026-08-17 | T-12.4 | Mensajes de consultas ambiguas o sin coincidencias | Estados sin resultados, fallo con reintento y pista de longitud mínima, todos con anuncio accesible |
| 2026-08-17 | TEST-US-12 | Verificación completa de US-12 | 128/128 unitarios, 20/20 E2E (8 skipped), lint y typecheck limpios; el test unitario de reintento cazó un bug real (el botón Reintentar no volvía a consultar porque la última consulta solo se guardaba en éxito) |
| 2026-08-17 | Seguridad — forja de logs en geocodificación | El log de GeocodeService registraba la consulta cruda (un `\n` en `q` podía forjar líneas de log); ahora se registra la consulta normalizada (colapsa `\s+`, incluidos saltos de línea) | Nuevo test verifica que los saltos de línea no llegan al proveedor ni al log; 91/91 tests backend, BUILD SUCCESS |
| 2026-08-17 | Mantenimiento — anillo de foco del buscador | El `:focus-visible` genérico dibujaba un cuadrado azul alrededor del input interior (bordes rectos, desalineado de la caja redondeada); el anillo pasa a la caja completa con `:focus-within` (borde azul petróleo + `--focus-ring`), y el input interior queda fuera del selector genérico; icono y placeholder en color atenuado | El anillo rodea toda la caja redondeada del campo al hacer clic o con teclado; 128/128 unitarios, 20/20 E2E, lint y typecheck limpios |
| 2026-08-17 | Mantenimiento — pasos de zoom de 0.5 | `ZOOM_STEP` pasa de 0.25 a 0.5: los botones +/− y la rueda avanzan el doble de rápido; `zoomSnap`/`zoomDelta` y la rejilla de la vista inicial se actualizan; tests unitarios y E2E ajustados | Rueda y botones con pasos de 0.5; 128/128 unitarios, 20/20 E2E (8 skipped), lint y typecheck limpios |
| 2026-08-17 | Mejora — autocompletado inteligente del buscador | Catálogo local de 8.132 municipios INE (catálogo 2026: nombre, provincia, población y centroide) con códigos postales (13.987, callejero del censo electoral); importación al arranque idempotente (CSV RFC-4180 con parser estricto propio) e índice GIN pg_trgm creado en `MunicipalityIndexInitializer`; `findSimilar` con tolerancia a erratas (umbral 0.25) ordenado por población; en Nominatim se acota a España (`countrycodes=es` + `viewbox` + `bounded=1`) y se añade `searchByPostalCode`; `GeocodeService` resuelve CP de 5 dígitos con el índice local (varios municipios ordenados por población), completa nombres con el índice local + proveedor deduplicando por coordenadas (tope 8) y el límite de 30/min solo se consume cuando se llama al proveedor | El buscador prioriza resultados españoles y populares, tolera erratas y resuelve códigos postales sin gastar la cuota del proveedor; 115/115 tests backend, BUILD SUCCESS; frontend sin cambios (contrato de la API idéntico) |
| 2026-08-18 | Mantenimiento — catálogo de municipios actualizado y saneado | `municipios.csv` regenerado desde el catálogo INE 2026 (8.132 municipios) y la población DPOP 2025 (la antigua instantánea era de 2014 y omitía 14 municipios creados después). Se corrigieron 608 centroides corruptos heredados del CSV antiguo (población duplicada en la columna de latitud en nombres con artículo: «El/La/Los…») rellenándolos desde Wikidata (P772) y Nominatim para los 14 nuevos. `MunicipalityImportService.importPostalCodes` ahora salta la cabecera de `codigos-postales.csv` (antes la contaba como CP «omitido») | 8.132 municipios y 13.987 códigos postales importados sin omisiones; 115/115 tests backend, BUILD SUCCESS |
| 2026-08-18 | Mejora — degradación elegante del buscador | Si el proveedor de geocodificación falla (503, timeout) o se supera el límite (429) pero hay coincidencias locales, `GeocodeService` devuelve estas en vez de propagar el error; solo propaga cuando no hay resultados locales que ofrecer. La caché pasa de `@Cacheable` a gestión manual con `CacheManager` (misma caché Caffeine "geocode"): solo se cachean los resultados completos, nunca los degradados, para que al recuperarse el proveedor la siguiente consulta vuelva a pedir resultados completos | Con resultados locales, el usuario ve sugerencias locales en vez del error «No se pudo buscar ahora»; sin ellos, se mantiene el 429/503 con ApiError; 120/120 tests backend, BUILD SUCCESS |
