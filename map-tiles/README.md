# Mapa vectorial propio

Este directorio construye un único PMTiles vectorial z0–z15 con los extractos
de España y Canarias de Geofabrik. Los datos generados viven en `data/` y no se
versionan; únicamente se versionan configuración, scripts y pruebas.

La vista general mantiene Península, Baleares y Canarias simultáneamente. Una
capa terrestre ligera de Natural Earth v5.1.2 se sirve también en local para
dar continuidad a costas y países vecinos fuera del rectángulo del PMTiles;
no se consulta ningún proveedor cartográfico desde el navegador.

Requisitos: Docker, `curl`, `unzip`, `md5sum`, `sha256sum`, Python 3 y bastante espacio
temporal en SSD. Reserva al menos 160 GB libres; el tamaño y el tiempo reales
dependen de la versión de OSM y del equipo y no deben estimarse a partir de los
1,4 GB comprimidos del PBF. La construcción completa usa almacenamiento en
disco (`--store`) para reducir la presión de memoria. Esos aproximadamente
120 GB son temporales: se eliminan al terminar, fallar o interrumpir el script;
no forman parte del mapa publicado.

Como referencia, la construcción completa del 21-08-2026 produjo un PMTiles
de 2.221.935.959 bytes (2,07 GiB). El artefacto final es pequeño comparado con
el espacio temporal que necesita tilemaker durante la generación.

```bash
task tiles:build
```

Es el único paso pesado. Después, `task`, `task frontend` o `task map` montan
automáticamente `data/publish` en el Caddy local de `http://localhost:8081`.
`frontend/.env.local` ya apunta al archivo estable; si accedes desde otro
dispositivo, conserva la IP privada del equipo en las dos variables del mapa.
El backend no necesita variables cartográficas.

El resultado publicado queda en:

```text
map-tiles/data/publish/maps/spain-AAAAMMDDThhmmssZ.pmtiles
map-tiles/data/publish/maps/spain.pmtiles
map-tiles/data/publish/fonts/
map-tiles/data/publish/context/ne_110m_land.geojson
map-tiles/data/publish/context/iberia_land.geojson
map-tiles/data/publish/context/spain_cities.geojson
```

`spain.pmtiles` es un enlace a la versión actual. Las versiones fechadas se
pueden cachear como inmutables; la URL estable se sirve con revalidación.

Para una versión explícita:

```bash
MAP_TILES_RELEASE=20260821T180000Z task tiles:build
```

La actualización es atómica: el enlace `spain.pmtiles` solo cambia después de
validar la cabecera y el tamaño mínimo del nuevo artefacto. La versión anterior
permanece disponible para rollback.

En cada ejecución se descargan de nuevo los pequeños checksum de Geofabrik. Si
los PBF locales siguen siendo actuales se reutilizan; si han cambiado se
descargan otra vez antes de construir la nueva versión.

`task frontend` y `task map` preparan automáticamente el contexto si falta.
También puede hacerse por separado con `task tiles:context`: el navegador
recibe 138 KB de tierra global, unos 216 KB de costa regional detallada y
790 bytes con seis ciudades españolas. La capa regional conserva Península,
Baleares y Canarias y excluye Gibraltar. El script verifica sumas SHA-256
fijadas antes de publicar los tres archivos.

En producción, el workflow manual **Build production vector map** ejecuta este
mismo script por SSH sobre el directorio persistente definido por
`MAP_DATA_DIR`. Debe lanzarse una vez después del primer despliegue y, después,
solo cuando se quiera actualizar OpenStreetMap. El despliegue normal nunca
sobrescribe los datos del mapa.
