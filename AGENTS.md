# Guía de producto y diseño — Mapa de Gasolineras

Este documento es la referencia de producto durante el desarrollo. Antes de
implementar una funcionalidad de interfaz, API o datos, comprueba que respeta
las decisiones y el orden de fases descritos aquí.

El desglose ejecutable del trabajo está en [USER_STORIES.md](USER_STORIES.md):
consulta su historia, tareas y fase antes de empezar una implementación.

El avance del trabajo se registra en [PROGRESS.md](PROGRESS.md). Actualízalo al
comenzar y terminar cada tarea; no marques una historia como completada si
queda una tarea o una prueba pendiente.

Cada user story debe incluir pruebas para casos válidos, entradas inválidas,
límites, estados vacíos y fallos de dependencias cuando sean aplicables. Las
pruebas negativas deben verificar que el sistema rechaza o comunica el error
correctamente, y las pruebas positivas deben verificar el resultado esperado.
No basta con comprobar que el código no lanza excepciones.

Cada tarea (no solo cada user story) debe acompañarse de pruebas que cubran
todas las posibilidades de fallo relevantes: casos que deben fallar y fallan, y
casos que deben funcionar y funcionan. Antes de marcar una tarea como
completada, comprueba que existen tanto pruebas positivas (que verifican el
resultado esperado) como negativas (que el sistema rechaza, comunica o maneja
correctamente el error), incluyendo límites, estados vacíos y fallos de
dependencias. Una prueba que simplemente espera que "no se lance una excepción"
no es suficiente.

Convención de tests frontend:

- Los tests unitarios y de componentes se colocan junto al código probado con
  el sufijo `.test.ts` o `.test.tsx` (por ejemplo, `ThemeToggle.test.tsx`).
- `frontend/src/test/setup.ts` se reserva para configuración global de Vitest,
  matchers y mocks compartidos; no se deben colocar allí tests de funcionalidad.
- Los tests E2E de Playwright viven en `frontend/e2e/` y se ejecutan con
  `npm run test:e2e`; cubren los flujos completos en navegador real (móvil y
  escritorio).

Tipos de prueba que acompañan a cada cambio:

- Unitarias (Vitest) para lógica pura y componentes.
- De interfaz: cada funcionalidad nueva de frontend debe incluir pruebas que
  interactúen con la interfaz real del usuario, no solo comprobaciones de
  salida. Para componentes React se usa React Testing Library simulando acciones
  (clics, teclado, cambios de estado) y verificando el resultado en el DOM y en
  el árbol de accesibilidad; para flujos completos se usa Playwright.
- E2E (Playwright) que recorren el flujo en navegador real, incluyendo
  navegación por teclado y orden de foco.
- Positivas (lo que debe funcionar funciona) y negativas (lo que debe fallar
  falla), con límites, estados vacíos y fallos de dependencias.

`task test` debe ejecutar todos los tipos de prueba (backend, frontend unitario
y E2E). No se da por terminada una tarea si alguna de estas suites no pasa.

La arquitectura frontend es Astro con componentes React (React islands). Las
rutas y el HTML pertenecen a Astro; React se usa para las partes interactivas
como mapa, filtros, listas y formularios. No crear una aplicación Vite
independiente ni sustituir Astro por Vite. Las variables que deban llegar al
navegador usan el prefijo `PUBLIC_` de Astro.

## Seguridad

La seguridad es un requisito transversal y prioritario: ninguna tarea puede
darse por completada si introduce o deja una vulnerabilidad. Antes de terminar
una funcionalidad, revisa el código con mentalidad de atacante y asegúrate de
que ningún dato no confiable puede convertirse en una inyección.

- Validar y acotar toda entrada (parámetros, cabeceras, cuerpos y archivos):
  rechazar lo inválido con errores claros y nunca confiar en el cliente.
- Neutralizar inyecciones:
  - SQL: usar siempre consultas parametrizadas, JPQL/Hibernate o Spring Data;
    nunca concatenar cadenas SQL ni construir consultas con datos externos.
  - XSS: escapar todo dato de origen externo antes de renderizarlo. Astro y
    React escapan por defecto; no usar `set:html`, `dangerouslySetInnerHTML`,
    `innerHTML`, `document.write` ni `eval` con contenido no confiable, y validar
    con listas permitidas los valores que se escriban en el DOM (por ejemplo,
    el tema).
  - Inyección de comandos: no ejecutar procesos del sistema con datos externos;
    evitar `Runtime.exec`, `ProcessBuilder` y shells.
  - Inyección de cabeceras, URL o redirecciones: validar protocolos (solo
    `https`), orígenes y codificar valores antes de construir cabeceras o enlaces.
- Aplicar mínimo privilegio: servicios sin usuario root, permisos mínimos,
  secretos fuera del código y del repositorio, y solo los endpoints necesarios
  expuestos (por ejemplo, el actuador limitado a `health`).
- Mantener CORS con orígenes explícitos y no revelar detalles internos ni stack
  traces en las respuestas de error.
- Mantener cabeceras de seguridad: `X-Content-Type-Options`, `X-Frame-Options`,
  `Referrer-Policy`, `Permissions-Policy` y HSTS. La política CSP (Content
  Security Policy) debe añadirse y verificarse contra el build real de Astro,
  teniendo en cuenta sus scripts inline; no desplegarla sin probar que no rompe
  la hidratación de las islas.
- Revisar dependencias y añadir pruebas de seguridad negativas como parte de la
  aceptación de cada historia.

## Convenciones de backend y API

- DTOs: exponer siempre DTOs en la capa HTTP; nunca devolver entidades de
  dominio ni filtrar datos sensibles de forma parcial.
- Errores de API: usar un formato de error consistente (código, mensaje legible
  y, opcionalmente, detalle de campos) con el código HTTP adecuado (`400` para
  entrada inválida, `404` para no encontrado, `503` para fallos de dependencias);
  no revelar stack traces ni detalles internos al cliente.
- Variables de entorno: las variables de despliegue que llegan al navegador usan
  el prefijo `PUBLIC_` de Astro; el backend usa variables con valor por defecto
  (`${VAR:default}`) o las declara obligatorias en el despliegue. Los secretos
  viven fuera del repositorio y del código.
- Lint y tipado: `npm run lint` (ESLint), `npm run typecheck` (`astro check`) y
  `npm run build` deben pasar antes de dar por terminado un cambio de frontend;
  en el backend, `./mvnw verify` compila y ejecuta las pruebas.

## Objetivo

Crear una web en español, responsive y mobile-first para conductores diarios
en España. El MVP permite encontrar, comparar y elegir gasolineras cercanas
con datos oficiales. Las rutas optimizadas se incorporan en la segunda fase.

## Dirección de diseño

- Estilo clásico y funcional: el modo claro es el predeterminado, con fondo
  blanco, superficies blancas y grises sutiles; azul petróleo como color de
  acción y verde para ahorro.
- Incluir modo oscuro nativo desde el MVP: fondos gris carbón, superficies
  elevadas ligeramente más claras y los mismos colores semánticos adaptados a
  contraste alto. Un control visible en la cabecera permite alternarlo, se
  respeta inicialmente la preferencia del sistema y la elección del usuario se
  conserva en el dispositivo.
- Garantizar contraste WCAG AA y no transmitir información únicamente mediante
  el color.
- En escritorio: cabecera compacta, panel lateral con buscador, filtros y
  listado; mapa interactivo ocupando el resto de la pantalla.
- En móvil: buscador superior, filtros como chips horizontales, mapa a pantalla
  completa y panel inferior deslizable para resultados y detalle.
- No usar imágenes decorativas si no aportan información al flujo.

## MVP: descubrir y comparar

El flujo principal es: pedir ubicación al abrir la web, ofrecer búsqueda por
ciudad, dirección o código postal si no se concede el permiso, seleccionar
combustible y radio, y comparar los resultados por precio, distancia o ahorro.

Cada ficha de estación debe mostrar marca, dirección, horario, servicios,
distancia, precios y fecha de actualización. La mejor alternativa debe llevar
una etiqueta de "mejor opción" con el ahorro estimado.

La cobertura inicial son estaciones públicas de España y los combustibles
diésel, gasolina 95 y gasolina 98. El MVP no incluye cuentas, favoritos ni
gráficos históricos.

### Mapa y datos

- Usar Leaflet con OpenStreetMap como solución base gratuita: zoom fluido,
  desplazamiento, marcadores agrupados y trazado claro.
- Mantener el proveedor de teselas configurable por entorno para poder cambiar
  de proveedor sin rediseñar la interfaz.
- Integrar en el backend los datos oficiales del Geoportal/MITECO, normalizarlos
  en PostGIS y actualizarlos con una tarea programada.
- No consultar el proveedor de precios directamente desde el navegador.
- Conservar y mostrar la fecha de actualización de los datos.
- Fuente de referencia: https://datos.gob.es/es/catalogo/e05068001-instalaciones-de-suministro-de-combustibles-a-vehiculos-con-venta-publica

### Interfaces previstas

- `GET /api/stations/nearby`: coordenadas, radio, combustible y criterio de
  orden; responde con estación, precios aplicables, distancia, ahorro y fecha
  de datos.
- `GET /api/stations/{id}`: ficha completa, servicios, horario y precios o
  historial disponibles.
- Modelar por separado estación, precio actual y snapshot histórico para
  conservar trazabilidad al importar nuevas tarifas.

## Segunda fase: rutas

El planificador funciona sin cuenta. Debe solicitar origen, destino,
combustible, consumo, autonomía disponible y capacidad de depósito. Propone
paradas equilibrando ahorro, consumo y desvío; muestra coste estimado,
distancia, duración y alternativas.

- Usar un proveedor gratuito de rutas a través de un adaptador de backend para
  poder sustituirlo si cambian sus cuotas o condiciones.
- Exportar el resultado a Google Maps para la navegación final.
- Guardar temporalmente la última planificación en el dispositivo. Las cuentas
  solo serán necesarias más adelante para persistir rutas entre dispositivos.
- `POST /api/routes/quote`: origen, destino y perfil de vehículo; devuelve la
  geometría, el coste estimado y las paradas recomendadas.

## Fases posteriores

1. Registro, inicio de sesión, favoritos, rutas guardadas y alertas de bajadas
   de precio.
2. Historial por estación y gráficos de evolución; después comparativas por
   zona y panel administrativo.

## Criterios de calidad

- Probar radio geográfico, filtros, orden por precio, distancia y ahorro, e
  importación y actualización de datos.
- Cubrir permiso de geolocalización aceptado o denegado, búsqueda manual, sin
  resultados, precio no disponible y fallo temporal de proveedores.
- Verificar navegación por teclado, lector de pantalla y contraste.
- Añadir pruebas E2E del flujo "buscar → comparar → ver detalle".
- Para rutas, validar perfil del vehículo, paradas dentro del corredor,
  degradación ante fallo del proveedor y enlace correcto a Google Maps.
