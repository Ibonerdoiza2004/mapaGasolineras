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

Convención de tests frontend:

- Los tests unitarios y de componentes se colocan junto al código probado con
  el sufijo `.test.ts` o `.test.tsx` (por ejemplo, `ThemeToggle.test.tsx`).
- `frontend/src/test/setup.ts` se reserva para configuración global de Vitest,
  matchers y mocks compartidos; no se deben colocar allí tests de funcionalidad.
- Los tests de integración o E2E que cubran varios módulos podrán organizarse
  en una carpeta propia cuando aparezcan esas necesidades.

La arquitectura frontend es Astro con componentes React (React islands). Las
rutas y el HTML pertenecen a Astro; React se usa para las partes interactivas
como mapa, filtros, listas y formularios. No crear una aplicación Vite
independiente ni sustituir Astro por Vite. Las variables que deban llegar al
navegador usan el prefijo `PUBLIC_` de Astro.

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
