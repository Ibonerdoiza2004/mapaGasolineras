# Progreso de desarrollo — Mapa de Gasolineras

Este archivo es el tablero de avance del proyecto. Se actualiza junto con
`USER_STORIES.md`: una tarea solo pasa a completada cuando su implementación y
sus pruebas han terminado correctamente.

## Estado actual

- **Fase activa:** Fase 1 — MVP: descubrir y comparar
- **Historia activa:** US-11 — Obtener ubicación del dispositivo
- **Siguiente historia:** US-11 — Obtener ubicación del dispositivo
- **Tarea pendiente:** T-11.1 — Solicitar geolocalización solo tras una acción
  clara del usuario
- **Última tarea completada:** TEST-10.3 — Un fallo de teselas muestra
  alternativa o mensaje sin romper la lista de estaciones
- **Porcentaje de tareas completadas:** 39 / 150
- **Pruebas automatizadas:** 120 / 122 casos planificados (112 unitarias + 8 E2E)

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
| US-11–US-22 | MVP: descubrir y comparar | 1 | Pendiente |
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
