# Backlog de user stories — Mapa de Gasolineras

Este backlog desarrolla las decisiones de [AGENTS.md](AGENTS.md). Cada historia
es implementable de forma independiente una vez resueltas sus dependencias y
contiene las tareas mínimas que deben completarse antes de marcarla como hecha.

## Orden de entrega

| Fase | Objetivo | Historias |
| --- | --- | --- |
| 0 | Base técnica, visual y accesible | US-01 a US-05 |
| 1 — MVP | Encontrar y comparar gasolineras | US-06 a US-22 |
| 2 | Planificar rutas sin cuenta | US-23 a US-30 |
| 3 | Personalización con cuenta | US-31 a US-35 |
| 4 | Análisis y administración | US-36 a US-38 |

---

## Fase 0 — Base técnica, visual y accesible

### US-01 — Sistema visual y temas

**Como** visitante, **quiero** una interfaz clásica y legible en modo claro u
oscuro **para** consultar precios cómodamente en cualquier entorno.

**Tareas**

- [x] T-01.1 Definir tokens CSS para color, tipografía, espaciado, borde,
  elevación y estados semánticos.
- [x] T-01.2 Implementar tema claro blanco como predeterminado y tema oscuro
  de alto contraste.
- [x] T-01.3 Crear el selector de tema, detectar `prefers-color-scheme` y
  persistir la elección en el dispositivo.
- [x] T-01.4 Verificar contraste WCAG AA de ambos temas.

### US-02 — Estructura y navegación de la aplicación

**Como** visitante, **quiero** una estructura consistente de cabecera y páginas
**para** moverme con claridad por la aplicación.

**Tareas**

- [x] T-02.1 Crear el layout base de Astro con metadatos, idioma español y
  contenedor principal.
- [x] T-02.2 Implementar cabecera con marca, acceso a explorar, rutas y
  selector de tema.
- [x] T-02.3 Añadir navegación responsive y estado activo de la sección actual.
- [x] T-02.4 Definir títulos y descripciones por página para SEO básico.

### US-03 — Diseño adaptable del explorador

**Como** conductor, **quiero** usar el explorador tanto en móvil como en
escritorio **para** encontrar gasolineras desde cualquier dispositivo.

**Tareas**

- [x] T-03.1 Diseñar el patrón de panel lateral y mapa para pantallas de
  escritorio.
- [x] T-03.2 Implementar mapa a pantalla completa y panel inferior deslizable
  para móvil.
- [x] T-03.3 Definir puntos de ruptura, áreas táctiles y comportamiento de
  scroll sin ocultar controles importantes.
- [x] T-03.4 Probar las vistas en tamaños móvil, tableta y escritorio.

### US-04 — Accesibilidad transversal

**Como** persona que usa teclado o lector de pantalla, **quiero** operar la
web sin barreras **para** acceder a la misma información y acciones.

**Tareas**

- [x] T-04.1 Añadir etiquetas, nombres accesibles y foco visible a controles,
  filtros, paneles y marcadores alternativos.
- [x] T-04.2 Implementar orden de foco y cierre correcto de diálogos y paneles.
- [x] T-04.3 Asegurar que precio, ahorro y tipo de combustible no dependan solo
  del color.
- [x] T-04.4 Ejecutar pruebas de teclado y lector de pantalla en el flujo MVP.

### US-05 — Base de calidad frontend y backend

**Como** equipo de desarrollo, **quiero** una base de tipado y pruebas
automatizadas **para** introducir funcionalidades sin regresiones.

**Tareas**

- [x] T-05.1 Configurar scripts de lint, pruebas y build para frontend y
  backend.
- [x] T-05.2 Añadir Vitest y React Testing Library para componentes React.
- [x] T-05.3 Establecer convenciones para DTO, errores de API y variables de
  entorno.
- [x] T-05.4 Configurar una comprobación de build y tests en integración
  continua.

---

## Fase 1 — MVP: descubrir y comparar

### US-06 — Importar estaciones y precios oficiales

**Como** conductor, **quiero** consultar estaciones y precios oficiales
actualizados **para** tomar decisiones fiables.

**Tareas**

- [x] T-06.1 Implementar un cliente del conjunto oficial del Geoportal/MITECO.
- [x] T-06.2 Normalizar nombres de combustibles, precios, coordenadas, horarios
  y servicios recibidos.
- [x] T-06.3 Programar una importación periódica con registro de resultado y
  fecha de origen.
- [x] T-06.4 Manejar proveedor no disponible sin borrar los últimos datos
  válidos.

### US-07 — Almacenar datos geoespaciales e históricos

**Como** sistema, **quiero** conservar estaciones y snapshots de precio
geolocalizados **para** responder búsquedas rápidas y preservar trazabilidad.

**Tareas**

- [x] T-07.1 Crear entidades y migraciones para estación, precio actual y
  snapshot histórico en PostgreSQL/PostGIS.
- [x] T-07.2 Añadir índices espaciales y de consulta por combustible y fecha.
- [x] T-07.3 Definir reglas de actualización e idempotencia de la importación.
- [x] T-07.4 Cubrir la persistencia con pruebas de repositorio.

### US-08 — Consultar gasolineras cercanas

**Como** conductor, **quiero** recibir estaciones dentro de un radio **para**
comparar opciones relevantes a mi ubicación.

**Tareas**

- [x] T-08.1 Implementar `GET /api/stations/nearby` con latitud, longitud,
  radio, combustible y ordenación.
- [x] T-08.2 Calcular y devolver distancia, precio aplicable, ahorro y fecha de
  actualización.
- [x] T-08.3 Validar límites de radio y parámetros incorrectos con errores
  consistentes.
- [x] T-08.4 Añadir pruebas de servicio y controlador para consultas espaciales.

### US-09 — Consultar el detalle de una estación

**Como** conductor, **quiero** abrir la información completa de una estación
**para** decidir si me conviene ir a ella.

**Tareas**

- [x] T-09.1 Implementar `GET /api/stations/{id}` y su DTO de detalle.
- [x] T-09.2 Incluir dirección, marca, horario, servicios, combustibles y
  precios disponibles.
- [x] T-09.3 Devolver un error 404 comprensible cuando la estación no exista.
- [x] T-09.4 Añadir pruebas de contrato de la respuesta.

### US-10 — Visualizar el mapa interactivo

**Como** conductor, **quiero** explorar un mapa con zoom y desplazamiento
fluido **para** entender dónde están las gasolineras.

**Tareas**

- [x] T-10.1 Integrar Leaflet en un componente React aislado de la página Astro.
- [x] T-10.2 Configurar proveedor de teselas mediante variable de entorno y
  establecer OpenStreetMap como valor base.
- [x] T-10.3 Ajustar vista, zoom mínimo/máximo y atribución obligatoria del mapa.
- [x] T-10.4 Renderizar un estado alternativo de listado cuando el mapa no pueda
  cargarse.

### US-11 — Obtener ubicación del dispositivo

**Como** conductor, **quiero** compartir mi ubicación con permiso explícito
**para** ver las gasolineras más cercanas sin escribir una dirección.

**Tareas**

- [x] T-11.1 Solicitar geolocalización solo tras una acción clara del usuario.
- [x] T-11.2 Centrar mapa y consulta de cercanía al aceptar el permiso.
- [x] T-11.3 Mostrar una explicación y alternativa manual si se deniega o falla.
- [x] T-11.4 Probar los estados aceptado, denegado, no soportado y timeout.

### US-12 — Buscar una ubicación manualmente

**Como** conductor sin geolocalización, **quiero** buscar ciudad, dirección o
código postal **para** consultar otra zona.

**Tareas**

- [x] T-12.1 Crear el campo de búsqueda con sugerencias y control de debounce.
- [x] T-12.2 Integrar un proveedor de geocodificación a través del backend con
  caché y límites de uso.
- [x] T-12.3 Centrar el mapa y actualizar resultados al elegir una sugerencia.
- [x] T-12.4 Mostrar mensajes claros para consultas ambiguas o sin coincidencias.

### US-13 — Elegir combustible

**Como** conductor, **quiero** filtrar por diésel, gasolina 95 o gasolina 98
**para** comparar únicamente el combustible de mi vehículo.

**Tareas**

- [ ] T-13.1 Crear filtros accesibles de selección de combustible.
- [ ] T-13.2 Sincronizar el filtro con la consulta de estaciones y la URL.
- [ ] T-13.3 Ocultar o marcar claramente precios no disponibles.
- [ ] T-13.4 Añadir pruebas de filtrado y restauración de estado desde URL.

### US-14 — Ajustar radio de búsqueda

**Como** conductor, **quiero** configurar el radio de búsqueda **para** limitar
los resultados a una distancia razonable.

**Tareas**

- [ ] T-14.1 Añadir control de radio con valores predefinidos y entrada validada.
- [ ] T-14.2 Dibujar el área de búsqueda en el mapa cuando sea útil.
- [ ] T-14.3 Volver a consultar y comunicar el número de resultados al cambiarlo.
- [ ] T-14.4 Evitar consultas excesivas mediante debounce y cancelación.

### US-15 — Ver marcadores y agrupaciones

**Como** conductor, **quiero** ver marcadores agrupados al alejar el mapa
**para** explorar muchas estaciones sin saturar la pantalla.

**Tareas**

- [ ] T-15.1 Diseñar iconos de marcador legibles en ambos temas.
- [ ] T-15.2 Implementar agrupación y expansión de marcadores por nivel de zoom.
- [ ] T-15.3 Resaltar en el mapa la estación seleccionada desde el listado.
- [ ] T-15.4 Mantener sincronizados límites visibles y resultados solicitados.

### US-16 — Consultar una lista de resultados

**Como** conductor, **quiero** una lista escaneable de estaciones cercanas
**para** comparar sin depender exclusivamente del mapa.

**Tareas**

- [ ] T-16.1 Crear tarjeta de estación con precio, distancia, ahorro y marca.
- [ ] T-16.2 Mostrar skeleton de carga y paginación o carga progresiva.
- [ ] T-16.3 Sincronizar selección de tarjeta con marcador y panel de detalle.
- [ ] T-16.4 Garantizar lectura correcta con teclado y lector de pantalla.

### US-17 — Ordenar y recomendar resultados

**Como** conductor, **quiero** ordenar por precio, distancia o ahorro y ver una
recomendación transparente **para** decidir con rapidez.

**Tareas**

- [ ] T-17.1 Definir el cálculo de ahorro frente al precio de referencia de los
  resultados actuales.
- [ ] T-17.2 Implementar ordenación estable en backend y selector en frontend.
- [ ] T-17.3 Etiquetar la mejor opción explicando el criterio usado.
- [ ] T-17.4 Evitar recomendar estaciones con precio caducado o no disponible.

### US-18 — Abrir la ficha detallada

**Como** conductor, **quiero** abrir una ficha de estación sin perder el
contexto del mapa **para** revisar la información antes de desplazarme.

**Tareas**

- [ ] T-18.1 Implementar panel lateral en escritorio y bottom sheet en móvil.
- [ ] T-18.2 Mostrar precios, horario, servicios, dirección y fecha de datos.
- [ ] T-18.3 Añadir acciones para cerrar, volver a la lista y obtener indicaciones.
- [ ] T-18.4 Manejar carga y error del detalle de forma independiente.

### US-19 — Informar de la frescura de los datos

**Como** conductor, **quiero** saber cuándo se actualizaron los precios **para**
interpretar correctamente la comparación.

**Tareas**

- [ ] T-19.1 Exponer fecha de origen e importación en las respuestas de API.
- [ ] T-19.2 Mostrar la fecha de actualización en lista y ficha con formato local.
- [ ] T-19.3 Marcar los datos antiguos con un aviso no intrusivo.
- [ ] T-19.4 Probar los umbrales de frescura y zona horaria.

### US-20 — Gestionar estados vacíos y errores

**Como** conductor, **quiero** recibir orientación si no hay resultados o un
servicio falla **para** poder continuar la búsqueda.

**Tareas**

- [ ] T-20.1 Diseñar estados para radio sin estaciones, combustible ausente y
  ubicación no válida.
- [ ] T-20.2 Ofrecer acciones de recuperación: ampliar radio, cambiar filtro o
  buscar manualmente.
- [ ] T-20.3 Implementar aviso de datos en caché ante caída del proveedor.
- [ ] T-20.4 Añadir pruebas de componentes para todos los estados.

### US-21 — Abrir indicaciones hacia una estación

**Como** conductor, **quiero** abrir una estación seleccionada en mi aplicación
de navegación **para** llegar a ella sin copiar la dirección.

**Tareas**

- [ ] T-21.1 Crear enlace de indicaciones a Google Maps a partir de coordenadas.
- [ ] T-21.2 Diferenciar comportamiento de navegador móvil y escritorio.
- [ ] T-21.3 Validar la codificación de URL y los casos sin coordenadas.

### US-22 — Validar el flujo MVP completo

**Como** responsable del producto, **quiero** comprobar el flujo completo antes
de publicarlo **para** asegurar una experiencia fiable.

**Tareas**

- [ ] T-22.1 Crear prueba E2E: ubicación o búsqueda manual, filtro, ordenación
  y apertura de ficha.
- [ ] T-22.2 Ejecutar pruebas visuales responsive en temas claro y oscuro.
- [ ] T-22.3 Documentar variables de entorno y proceso de desarrollo local.
- [ ] T-22.4 Verificar rendimiento con un conjunto amplio de estaciones.

---

## Fase 2 — Planificador de rutas sin cuenta

### US-23 — Introducir los datos de un viaje

**Como** conductor, **quiero** indicar origen, destino y mi vehículo **para**
obtener una propuesta de repostaje útil.

**Tareas**

- [ ] T-23.1 Crear página y formulario de planificación de ruta.
- [ ] T-23.2 Solicitar origen, destino, combustible, consumo, autonomía actual
  y capacidad de depósito.
- [ ] T-23.3 Validar unidades, rangos y coherencia del perfil introducido.
- [ ] T-23.4 Ofrecer ubicación actual como origen opcional.

### US-24 — Calcular una ruta de conducción

**Como** conductor, **quiero** obtener geometría, distancia y duración de mi
viaje **para** planificar sobre una ruta real.

**Tareas**

- [ ] T-24.1 Definir una interfaz de proveedor de rutas en el backend.
- [ ] T-24.2 Implementar un proveedor gratuito inicial con configuración por
entorno y límites controlados.
- [ ] T-24.3 Crear `POST /api/routes/quote` con validación y errores normalizados.
- [ ] T-24.4 Añadir dobles de prueba para no depender del proveedor externo.

### US-25 — Encontrar estaciones dentro del corredor

**Como** conductor, **quiero** que se consideren estaciones cercanas al camino
**para** no recibir recomendaciones que impliquen grandes desvíos.

**Tareas**

- [ ] T-25.1 Convertir la geometría de ruta en un corredor configurable.
- [ ] T-25.2 Consultar PostGIS para localizar estaciones dentro del corredor.
- [ ] T-25.3 Calcular distancia y desvío aproximado por estación candidata.
- [ ] T-25.4 Excluir estaciones sin combustible compatible o datos válidos.

### US-26 — Optimizar paradas de repostaje

**Como** conductor, **quiero** paradas que equilibren ahorro, consumo y desvío
**para** reducir el coste total sin complicar el viaje.

**Tareas**

- [ ] T-26.1 Definir la función de coste y restricciones de autonomía.
- [ ] T-26.2 Implementar selección de una o más paradas según el perfil.
- [ ] T-26.3 Exponer alternativas cuando sus ventajas sean relevantes.
- [ ] T-26.4 Probar rutas cortas, largas, sin estación alcanzable y con precios
  incompletos.

### US-27 — Ver la ruta y paradas en el mapa

**Como** conductor, **quiero** visualizar ruta y paradas recomendadas **para**
entender el plan antes de iniciarlo.

**Tareas**

- [ ] T-27.1 Dibujar geometría de ruta, origen, destino y paradas en Leaflet.
- [ ] T-27.2 Distinguir visualmente paradas recomendadas y alternativas.
- [ ] T-27.3 Conectar la selección de una parada con su ficha resumida.
- [ ] T-27.4 Ajustar automáticamente el encuadre sin impedir la exploración.

### US-28 — Consultar el resumen económico del viaje

**Como** conductor, **quiero** conocer coste, ahorro, distancia y duración
estimados **para** evaluar la propuesta de ruta.

**Tareas**

- [ ] T-28.1 Calcular litros estimados, importe y ahorro frente a una referencia.
- [ ] T-28.2 Diseñar un resumen claro con supuestos explícitos.
- [ ] T-28.3 Actualizar el resumen al cambiar una parada o el perfil de vehículo.
- [ ] T-28.4 Señalar que los precios y duración son estimaciones.

### US-29 — Exportar una ruta a Google Maps

**Como** conductor, **quiero** abrir la ruta propuesta en Google Maps **para**
navegarla al comenzar el viaje.

**Tareas**

- [ ] T-29.1 Generar URL de Google Maps con origen, destino y paradas ordenadas.
- [ ] T-29.2 Gestionar el límite de paradas exportables y comunicarlo al usuario.
- [ ] T-29.3 Probar la apertura en móvil y escritorio.

### US-30 — Recuperar la última planificación local

**Como** conductor sin cuenta, **quiero** recuperar mi último viaje **para** no
tener que volver a introducir todos los datos al regresar a la web.

**Tareas**

- [ ] T-30.1 Persistir perfil y última planificación en almacenamiento local.
- [ ] T-30.2 Solicitar confirmación antes de reutilizar una ruta antigua.
- [ ] T-30.3 Permitir borrar los datos locales desde la interfaz.
- [ ] T-30.4 Probar recuperación, caducidad y limpieza de datos.

---

## Fase 3 — Personalización con cuenta

### US-31 — Crear una cuenta

**Como** conductor, **quiero** registrarme **para** conservar información entre
dispositivos.

**Tareas**

- [ ] T-31.1 Diseñar el flujo de registro y validación de correo y contraseña.
- [ ] T-31.2 Implementar entidad de usuario, almacenamiento seguro de contraseña
  y endpoint de registro.
- [ ] T-31.3 Añadir manejo de cuenta duplicada y mensajes no reveladores.
- [ ] T-31.4 Cubrir registro y validaciones con pruebas.

### US-32 — Iniciar y cerrar sesión de forma segura

**Como** conductor registrado, **quiero** iniciar y cerrar sesión con seguridad
**para** acceder a mi información personal.

**Tareas**

- [ ] T-32.1 Implementar autenticación y autorización en el backend.
- [ ] T-32.2 Crear pantallas de inicio y cierre de sesión.
- [ ] T-32.3 Proteger endpoints y pantallas privadas.
- [ ] T-32.4 Gestionar expiración de sesión y pruebas de acceso no autorizado.

### US-33 — Guardar estaciones favoritas

**Como** conductor registrado, **quiero** marcar gasolineras como favoritas
**para** consultarlas rápidamente.

**Tareas**

- [ ] T-33.1 Crear relación entre usuario y estación favorita.
- [ ] T-33.2 Añadir acción de favorito en tarjeta y ficha de estación.
- [ ] T-33.3 Crear vista de favoritos ordenable por precio y distancia.
- [ ] T-33.4 Probar altas, bajas y aislamiento entre usuarios.

### US-34 — Guardar rutas en la cuenta

**Como** conductor registrado, **quiero** guardar una planificación **para**
repetirla o editarla desde cualquier dispositivo.

**Tareas**

- [ ] T-34.1 Crear modelo y endpoints de rutas guardadas.
- [ ] T-34.2 Añadir acción de guardar, renombrar y eliminar desde el planificador.
- [ ] T-34.3 Crear listado de rutas y acción de cargar una ruta guardada.
- [ ] T-34.4 Probar permisos de propiedad y restauración de rutas.

### US-35 — Recibir alertas de precio

**Como** conductor registrado, **quiero** recibir avisos cuando baja el precio
de una favorita **para** repostar en un momento conveniente.

**Tareas**

- [ ] T-35.1 Diseñar preferencias de combustible, estación y umbral de aviso.
- [ ] T-35.2 Detectar descensos de precio durante la importación programada.
- [ ] T-35.3 Implementar entrega inicial por correo y registro de notificaciones.
- [ ] T-35.4 Añadir controles de consentimiento, frecuencia y baja de alertas.

---

## Fase 4 — Análisis y administración

### US-36 — Consultar historial de precios de una estación

**Como** conductor, **quiero** ver cómo ha evolucionado el precio de una
estación **para** saber si su oferta actual es habitual o excepcional.

**Tareas**

- [ ] T-36.1 Exponer historial agregado por estación y combustible.
- [ ] T-36.2 Diseñar gráfico accesible con alternativa tabular.
- [ ] T-36.3 Permitir seleccionar periodo y combustible.
- [ ] T-36.4 Probar datos sin histórico, series incompletas y zonas horarias.

### US-37 — Analizar tendencias de mercado

**Como** conductor, **quiero** comparar tendencias globales y locales **para**
entender la evolución del precio antes de repostar.

**Tareas**

- [ ] T-37.1 Calcular agregados por zona y combustible a partir de snapshots.
- [ ] T-37.2 Crear vista de tendencias con filtros de ubicación y periodo.
- [ ] T-37.3 Mostrar metodología, muestra de datos y fecha de actualización.
- [ ] T-37.4 Probar cálculos de agregación y rendimiento de consultas.

### US-38 — Administrar la calidad de datos

**Como** administrador, **quiero** supervisar importaciones y datos anómalos
**para** mantener la calidad de la información publicada.

**Tareas**

- [ ] T-38.1 Restringir un área administrativa mediante roles.
- [ ] T-38.2 Mostrar estado, duración, volumen y errores de cada importación.
- [ ] T-38.3 Detectar coordenadas, precios y horarios anómalos para revisión.
- [ ] T-38.4 Añadir trazabilidad y pruebas de autorización administrativa.

---

## Matriz de pruebas por user story

Cada historia debe cubrir como mínimo el camino válido, el rechazo de datos o
permisos incorrectos y los límites o fallos de dependencia relevantes. Estas
pruebas son parte de la aceptación de la historia, no una tarea opcional.

### US-01 — Sistema visual y temas

- [x] TEST-01.1 El modo claro carga superficies blancas, texto legible y todos
  los tokens definidos.
- [x] TEST-01.2 El modo oscuro aplica sus tokens a superficies, estados,
  sombras y foco sin dejar texto ilegible.
- [x] TEST-01.3 Una preferencia inválida o un almacenamiento inaccesible no
  rompe la página y se usa el tema del sistema.

### US-02 — Estructura y navegación

- [x] TEST-02.1 La página carga idioma español, título, metadatos y navegación
  esperados.
- [x] TEST-02.2 Cada enlace válido lleva a su ruta y la sección activa se
  anuncia correctamente.
- [ ] TEST-02.3 Una ruta desconocida muestra el estado de error previsto y la
  navegación por teclado no pierde el foco.

### US-03 — Diseño adaptable

- [x] TEST-03.1 En móvil, tableta y escritorio se muestran los controles
  correspondientes sin desbordamiento horizontal.
- [x] TEST-03.2 El panel inferior móvil puede abrirse, cerrarse y desplazarse
  sin bloquear el mapa.
- [x] TEST-03.3 Un tamaño de viewport límite conserva acciones y contenido
  accesibles.

### US-04 — Accesibilidad transversal

- [x] TEST-04.1 Todos los controles tienen nombre accesible, foco visible y
  orden de tabulación lógico.
- [x] TEST-04.2 Un diálogo o panel se puede abrir, usar y cerrar solo con
  teclado.
- [x] TEST-04.3 La auditoría falla ante contraste insuficiente, etiqueta
  ausente o dependencia exclusiva del color.

### US-05 — Calidad frontend y backend

- [x] TEST-05.1 El build, lint y conjunto de tests pasan en un checkout limpio.
- [x] TEST-05.2 Un error de tipado, lint o test provoca un resultado fallido del
  pipeline.
- [x] TEST-05.3 Las variables obligatorias ausentes generan un error de
  configuración comprensible.

### US-06 — Importar estaciones y precios

- [ ] TEST-06.1 Un fichero oficial válido crea o actualiza estaciones y precios
  normalizados.
- [ ] TEST-06.2 Una fila malformada, precio negativo o coordenada inválida se
  rechaza y queda registrada sin abortar filas válidas.
- [ ] TEST-06.3 Un fallo del proveedor conserva la última importación válida y
  marca el proceso como fallido.

### US-07 — Persistencia geoespacial

- [x] TEST-07.1 Una estación con geometría válida se guarda y se recupera con
  coordenadas correctas.
- [x] TEST-07.2 Reprocesar el mismo snapshot es idempotente y no duplica datos.
- [x] TEST-07.3 Geometría fuera de rango o combustible desconocido provoca
  rechazo de validación.

### US-08 — Estaciones cercanas

- [x] TEST-08.1 Coordenadas y radio válidos devuelven estaciones ordenadas con
  distancia y ahorro calculados.
- [x] TEST-08.2 Parámetros ausentes, no numéricos o radio negativo devuelven
  `400` y no consultan el repositorio.
- [x] TEST-08.3 Una zona sin resultados devuelve una lista vacía y un fallo de
  base de datos devuelve el error de servicio previsto.

### US-09 — Detalle de estación

- [x] TEST-09.1 Un identificador existente devuelve ficha, horario, servicios y
  precios completos.
- [x] TEST-09.2 Un identificador inexistente devuelve `404` sin datos parciales.
- [x] TEST-09.3 Un identificador con formato inválido devuelve `400`.

### US-10 — Mapa interactivo

- [x] TEST-10.1 El mapa se renderiza con atribución, zoom y desplazamiento.
- [x] TEST-10.2 Cambiar de nivel de zoom mantiene la posición y los controles
  utilizables.
- [x] TEST-10.3 Un fallo de teselas muestra alternativa o mensaje sin romper la
  lista de estaciones.

### US-11 — Geolocalización

- [x] TEST-11.1 Con permiso concedido, el mapa se centra y consulta cercanía.
- [x] TEST-11.2 Con permiso denegado, timeout o API no disponible, aparece la
  búsqueda manual y no se realiza una consulta con coordenadas falsas.
- [x] TEST-11.3 Una coordenada devuelta fuera de rango se rechaza.

### US-12 — Búsqueda manual

- [x] TEST-12.1 Una ciudad, dirección o código postal válido muestra sugerencias
  y centra el mapa al seleccionar una.
- [x] TEST-12.2 Entrada vacía, demasiado corta o ambigua se valida y comunica
  correctamente.
- [x] TEST-12.3 Un fallo o límite del geocodificador ofrece reintentar sin
  perder la ubicación anterior.

### US-13 — Combustible

- [ ] TEST-13.1 Diésel, gasolina 95 y gasolina 98 filtran los resultados y
  actualizan URL y estado visual.
- [ ] TEST-13.2 Un combustible desconocido se rechaza y no altera la consulta.
- [ ] TEST-13.3 Una estación sin precio para el combustible seleccionado no se
  recomienda como mejor opción.

### US-14 — Radio

- [ ] TEST-14.1 Los valores mínimo, máximo y los predefinidos generan consultas
  válidas.
- [ ] TEST-14.2 Radio cero, negativo, no numérico o superior al máximo se
  rechaza con mensaje útil.
- [ ] TEST-14.3 Cambios rápidos se agrupan y solo la última consulta actualiza
  resultados.

### US-15 — Marcadores y agrupaciones

- [ ] TEST-15.1 Muchos marcadores se agrupan y se expanden correctamente al
  acercar el zoom.
- [ ] TEST-15.2 Seleccionar una tarjeta resalta su marcador y viceversa.
- [ ] TEST-15.3 Una estación sin coordenadas no genera un marcador inválido.

### US-16 — Lista de resultados

- [ ] TEST-16.1 Una respuesta válida muestra tarjetas con precio, distancia,
  ahorro y marca.
- [ ] TEST-16.2 Carga, lista vacía y error muestran estados diferentes y
  acciones de recuperación adecuadas.
- [ ] TEST-16.3 Una lista grande mantiene scroll, foco y rendimiento aceptables.

### US-17 — Orden y recomendación

- [ ] TEST-17.1 Precio, distancia y ahorro producen orden estable y correcto.
- [ ] TEST-17.2 Empates conservan un desempate determinista.
- [ ] TEST-17.3 Precios caducados, nulos o negativos no se presentan como mejor
  opción.

### US-18 — Ficha detallada

- [ ] TEST-18.1 Abrir una tarjeta muestra la ficha correspondiente en panel
  lateral o bottom sheet.
- [ ] TEST-18.2 Cerrar, volver y cambiar de estación restauran el foco y el
  contexto del mapa.
- [ ] TEST-18.3 Un fallo del detalle muestra error recuperable sin cerrar toda
  la experiencia.

### US-19 — Frescura de datos

- [ ] TEST-19.1 Fecha válida reciente aparece en lista y ficha en hora local.
- [ ] TEST-19.2 Fecha antigua muestra aviso y no oculta el precio disponible.
- [ ] TEST-19.3 Fecha ausente o malformada se trata como dato desconocido, no
  como actualizado.

### US-20 — Estados vacíos y errores

- [ ] TEST-20.1 Sin resultados permite ampliar radio, cambiar combustible o
  buscar otra ubicación.
- [ ] TEST-20.2 Error de red o proveedor muestra mensaje y reintento.
- [ ] TEST-20.3 Error inesperado no expone stack trace ni deja controles
  bloqueados.

### US-21 — Indicaciones

- [ ] TEST-21.1 Coordenadas válidas generan un enlace de Google Maps correcto.
- [ ] TEST-21.2 Coordenadas ausentes deshabilitan la acción y explican el motivo.
- [ ] TEST-21.3 Direcciones con caracteres especiales se codifican sin romper
  la URL.

### US-22 — Flujo MVP

- [ ] TEST-22.1 E2E válido: ubicación o búsqueda manual → filtros → ordenar →
  ficha → indicaciones.
- [ ] TEST-22.2 E2E negativo: permiso denegado, sin resultados y error de API
  permiten continuar o recuperarse.
- [ ] TEST-22.3 El flujo funciona en viewport móvil, escritorio, tema claro y
  tema oscuro.

### US-23 — Datos de viaje

- [ ] TEST-23.1 Origen, destino y perfil de vehículo válidos permiten enviar la
  planificación.
- [ ] TEST-23.2 Consumo, capacidad o autonomía negativos, vacíos o imposibles
  bloquean el envío con validación.
- [ ] TEST-23.3 Usar ubicación actual como origen funciona cuando el permiso
  existe y ofrece alternativa cuando no.

### US-24 — Cálculo de ruta

- [ ] TEST-24.1 Un proveedor responde con geometría, distancia y duración
  válidas.
- [ ] TEST-24.2 Timeout, respuesta malformada o límite del proveedor producen
  error controlado y no una ruta inventada.
- [ ] TEST-24.3 El endpoint rechaza parámetros incompletos con `400`.

### US-25 — Corredor de estaciones

- [ ] TEST-25.1 Estaciones dentro del corredor aparecen con desvío calculado.
- [ ] TEST-25.2 Estaciones fuera del corredor o sin combustible compatible se
  excluyen.
- [ ] TEST-25.3 Ruta sin candidatas devuelve estado explícito y permite ajustar
  tolerancia.

### US-26 — Optimización de paradas

- [ ] TEST-26.1 Una ruta factible devuelve paradas que respetan autonomía y
  minimizan el coste combinado.
- [ ] TEST-26.2 Una ruta imposible no devuelve paradas engañosas y explica la
  falta de autonomía.
- [ ] TEST-26.3 Precios ausentes o desactualizados se excluyen o se etiquetan
  como estimación, según la regla definida.

### US-27 — Ruta en mapa

- [ ] TEST-27.1 Geometría válida dibuja ruta, origen, destino y paradas.
- [ ] TEST-27.2 Seleccionar una alternativa actualiza el trazado y el resumen.
- [ ] TEST-27.3 Geometría vacía o inválida muestra error recuperable.

### US-28 — Resumen económico

- [ ] TEST-28.1 Consumo, precios y distancia válidos producen litros, coste y
  ahorro coherentes.
- [ ] TEST-28.2 Falta de perfil o precio impide presentar un importe falso y
  muestra el supuesto pendiente.
- [ ] TEST-28.3 Cambiar una parada o dato recalcula el resumen sin duplicar
  valores.

### US-29 — Exportar ruta

- [ ] TEST-29.1 Origen, destino y paradas válidos generan una URL navegable.
- [ ] TEST-29.2 Superar el límite de paradas se comunica y conserva las primeras
  paradas en el orden correcto.
- [ ] TEST-29.3 Coordenadas o nombres con caracteres especiales se codifican
  correctamente.

### US-30 — Última planificación local

- [ ] TEST-30.1 Una planificación válida se recupera tras recargar la página.
- [ ] TEST-30.2 JSON corrupto, versión incompatible o almacenamiento lleno se
  ignora sin romper la aplicación.
- [ ] TEST-30.3 Borrar datos elimina la planificación y la siguiente carga parte
  limpia.

### US-31 — Registro

- [ ] TEST-31.1 Email y contraseña válidos crean una cuenta y nunca almacenan la
  contraseña en claro.
- [ ] TEST-31.2 Email duplicado, formato inválido o contraseña débil se rechazan
  sin crear usuario parcial.
- [ ] TEST-31.3 Fallo de base de datos no comunica éxito ni pierde el formulario
  innecesariamente.

### US-32 — Sesión

- [ ] TEST-32.1 Credenciales válidas inician sesión y permiten recursos privados.
- [ ] TEST-32.2 Credenciales incorrectas, sesión caducada o token manipulado
  devuelven acceso denegado sin filtrar información.
- [ ] TEST-32.3 Cerrar sesión invalida la sesión también en una petición posterior.

### US-33 — Favoritos

- [ ] TEST-33.1 Un usuario puede añadir, consultar y eliminar una estación
  favorita.
- [ ] TEST-33.2 Añadir dos veces es idempotente y no duplica la estación.
- [ ] TEST-33.3 Un usuario no puede leer, modificar ni borrar favoritos ajenos.

### US-34 — Rutas guardadas

- [ ] TEST-34.1 Una ruta válida se guarda, carga y elimina manteniendo sus
  paradas y perfil.
- [ ] TEST-34.2 Ruta incompleta o corrupta se rechaza antes de persistirla.
- [ ] TEST-34.3 Un usuario no autorizado recibe `401` o `403` y no ve rutas
  ajenas.

### US-35 — Alertas de precio

- [ ] TEST-35.1 Una bajada que alcanza el umbral crea y entrega una notificación.
- [ ] TEST-35.2 Una variación menor, precio faltante o estación no favorita no
  dispara alerta.
- [ ] TEST-35.3 Baja, frecuencia y consentimiento impiden notificaciones
  posteriores cuando corresponde.

### US-36 — Historial de estación

- [ ] TEST-36.1 Serie válida se filtra por combustible y periodo y muestra datos
  en gráfico y tabla.
- [ ] TEST-36.2 Estación sin histórico devuelve estado vacío, no un gráfico
  engañoso.
- [ ] TEST-36.3 Periodo inválido, invertido o demasiado grande se valida y no
  sobrecarga la consulta.

### US-37 — Tendencias

- [ ] TEST-37.1 Agregados válidos por zona, combustible y periodo coinciden con
  los snapshots usados.
- [ ] TEST-37.2 Filtros sin datos muestran estado vacío y los filtros inválidos
  se rechazan.
- [ ] TEST-37.3 La metodología, muestra y fecha aparecen junto al resultado.

### US-38 — Administración de datos

- [ ] TEST-38.1 Administrador autorizado consulta importaciones y anomalías.
- [ ] TEST-38.2 Usuario sin rol administrativo recibe `403` y no obtiene datos
  parciales.
- [ ] TEST-38.3 Importación con errores muestra volumen, fallos y trazabilidad;
  una importación válida muestra estado completado.
