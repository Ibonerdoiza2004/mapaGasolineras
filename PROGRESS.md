# Progreso de desarrollo — Mapa de Gasolineras

Este archivo es el tablero de avance del proyecto. Se actualiza junto con
`USER_STORIES.md`: una tarea solo pasa a completada cuando su implementación y
sus pruebas han terminado correctamente.

## Estado actual

- **Fase activa:** Fase 1 — MVP: descubrir y comparar
- **Historia activa:** US-06 — Importar estaciones y precios oficiales
- **Siguiente historia:** US-06 — Importar estaciones y precios oficiales
- **Tarea pendiente:** T-06.1 — Implementar un cliente del conjunto oficial del
  Geoportal/MITECO
- **Última tarea completada:** US-05 — Base de calidad frontend y backend
- **Porcentaje de tareas completadas:** 19 / 150
- **Pruebas automatizadas:** 79 / 114 casos planificados (71 unitarias + 8 E2E)

## Historias

| ID | Historia | Fase | Estado |
| --- | --- | --- | --- |
| US-01 | Sistema visual y temas | 0 | Completada |
| US-02 | Estructura y navegación | 0 | Completada |
| US-03 | Diseño adaptable del explorador | 0 | Completada |
| US-04 | Accesibilidad transversal | 0 | Completada |
| US-05 | Base de calidad frontend y backend | 0 | Completada |
| US-06–US-22 | MVP: descubrir y comparar | 1 | Pendiente |
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
