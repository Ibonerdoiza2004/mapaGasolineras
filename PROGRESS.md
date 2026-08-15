# Progreso de desarrollo — Mapa de Gasolineras

Este archivo es el tablero de avance del proyecto. Se actualiza junto con
`USER_STORIES.md`: una tarea solo pasa a completada cuando su implementación y
sus pruebas han terminado correctamente.

## Estado actual

- **Fase activa:** Fase 0 — Base técnica, visual y accesible
- **Historia activa:** US-03 — Diseño adaptable del explorador
- **Siguiente historia:** US-03 — Diseño adaptable del explorador
- **Tarea pendiente:** T-03.4 — Probar las vistas en tamaños móvil, tableta y
  escritorio
- **Última tarea completada:** T-02.4 — Metadatos SEO por página
- **Porcentaje de tareas completadas:** 11 / 150
- **Pruebas automatizadas:** 22 / 114 casos planificados (US-01 y US-02)

## Historias

| ID | Historia | Fase | Estado |
| --- | --- | --- | --- |
| US-01 | Sistema visual y temas | 0 | Completada |
| US-02 | Estructura y navegación | 0 | Completada |
| US-03 | Diseño adaptable del explorador | 0 | En curso |
| US-04 | Accesibilidad transversal | 0 | Pendiente |
| US-05 | Base de calidad frontend y backend | 0 | Pendiente |
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
