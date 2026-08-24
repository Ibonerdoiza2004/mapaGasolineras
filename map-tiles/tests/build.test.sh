#!/usr/bin/env bash
set -euo pipefail

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
project_dir=$(cd -- "$script_dir/.." && pwd)
tmp_dir=$(mktemp -d)
trap 'rm -rf -- "$tmp_dir"' EXIT

valid="$tmp_dir/valid.pmtiles"
invalid="$tmp_dir/invalid.pmtiles"
dd if=/dev/zero of="$valid" bs=127 count=1 status=none
printf 'PMTiles\003' | dd of="$valid" conv=notrunc status=none
printf '\001\000\017' | dd of="$valid" bs=1 seek=99 conv=notrunc status=none
python3 - "$valid" <<'PY'
import struct
import sys

with open(sys.argv[1], "r+b") as target:
    target.seek(102)
    target.write(struct.pack("<iiii", -189235200, 263611750, 50985250, 441485500))
PY
printf 'not-pmtiles' > "$invalid"

PMTILES_MIN_BYTES=8 PMTILES_EXPECT_MIN_ZOOM=0 PMTILES_EXPECT_MAX_ZOOM=15 \
	PMTILES_REQUIRED_BOUNDS_E7='-180000000 270000000 45000000 438000000' \
	"$script_dir/validate-pmtiles.sh" "$valid" >/dev/null
ln -s "$(basename "$valid")" "$tmp_dir/current.pmtiles"
PMTILES_MIN_BYTES=8 PMTILES_EXPECT_MAX_ZOOM=15 \
	"$script_dir/validate-pmtiles.sh" "$tmp_dir/current.pmtiles" >/dev/null

if PMTILES_MIN_BYTES=8 "$script_dir/validate-pmtiles.sh" "$invalid" >/dev/null 2>&1; then
	echo "Se aceptó una cabecera inválida" >&2
	exit 1
fi
if PMTILES_MIN_BYTES=1000 "$script_dir/validate-pmtiles.sh" "$valid" >/dev/null 2>&1; then
	echo "Se aceptó un PMTiles truncado" >&2
	exit 1
fi
if PMTILES_MIN_BYTES=no "$script_dir/validate-pmtiles.sh" "$valid" >/dev/null 2>&1; then
	echo "Se aceptó un límite no numérico" >&2
	exit 1
fi

wrong_zoom="$tmp_dir/wrong-zoom.pmtiles"
cp "$valid" "$wrong_zoom"
printf '\016' | dd of="$wrong_zoom" bs=1 seek=101 conv=notrunc status=none
if PMTILES_MIN_BYTES=8 PMTILES_EXPECT_MAX_ZOOM=15 "$script_dir/validate-pmtiles.sh" "$wrong_zoom" >/dev/null 2>&1; then
	echo "Se aceptó un PMTiles con zoom máximo incorrecto" >&2
	exit 1
fi
if "$script_dir/validate-pmtiles.sh" "$tmp_dir/missing.pmtiles" >/dev/null 2>&1; then
	echo "Se aceptó un archivo ausente" >&2
	exit 1
fi
insufficient_bounds="$tmp_dir/insufficient-bounds.pmtiles"
cp "$valid" "$insufficient_bounds"
python3 - "$insufficient_bounds" <<'PY'
import struct
import sys

with open(sys.argv[1], "r+b") as target:
    target.seek(102)
    target.write(struct.pack("<iiii", -100000000, 300000000, 30000000, 430000000))
PY
if PMTILES_MIN_BYTES=8 PMTILES_REQUIRED_BOUNDS_E7='-180000000 270000000 45000000 438000000' \
	"$script_dir/validate-pmtiles.sh" "$insufficient_bounds" >/dev/null 2>&1; then
	echo "Se aceptó un PMTiles sin cobertura completa de España y Canarias" >&2
	exit 1
fi
if PMTILES_MIN_BYTES=8 PMTILES_REQUIRED_BOUNDS_E7='invalido' \
	"$script_dir/validate-pmtiles.sh" "$valid" >/dev/null 2>&1; then
	echo "Se aceptó una cobertura esperada malformada" >&2
	exit 1
fi

payload="$tmp_dir/payload"
checksum="$tmp_dir/payload.md5"
printf 'datos oficiales' > "$payload"
md5sum "$payload" > "$checksum"
bash "$script_dir/verify-md5.sh" "$payload" "$checksum" >/dev/null
if bash "$script_dir/verify-md5.sh" "$tmp_dir/missing" "$checksum" >/dev/null 2>&1; then
	echo "Se aceptó un PBF ausente" >&2
	exit 1
fi
printf 'datos alterados' > "$payload"
if bash "$script_dir/verify-md5.sh" "$payload" "$checksum" >/dev/null 2>&1; then
	echo "Se aceptó un archivo con checksum incorrecto" >&2
	exit 1
fi
printf 'checksum-invalido  payload\n' > "$checksum"
set +e
bash "$script_dir/verify-md5.sh" "$payload" "$checksum" >/dev/null 2>&1
checksum_status=$?
set -e
if [[ $checksum_status -ne 2 ]]; then
	echo "Un checksum malformado no se rechazó como error de configuración" >&2
	exit 1
fi

python3 - "$script_dir/config-openmaptiles-z15.json" <<'PY'
import json
import sys

with open(sys.argv[1], encoding="utf-8") as source:
    config = json.load(source)
settings = config["settings"]
assert settings["minzoom"] == 0
assert settings["maxzoom"] == 15
assert settings["basezoom"] == 15
for required in ("transportation", "building", "place", "water", "landuse"):
    assert config["layers"][required]["maxzoom"] == 15
assert all(layer["maxzoom"] <= 15 for layer in config["layers"].values())
PY

grep -q -- '--input /data/source/spain-latest.osm.pbf' "$script_dir/build.sh"
grep -q -- '--input /data/source/canary-islands-latest.osm.pbf' "$script_dir/build.sh"
grep -Eq 'tilemaker:master@sha256:[0-9a-f]{64}' "$script_dir/build.sh"
grep -q 'verify_md5 "$source_dir/spain-latest.osm.pbf"' "$script_dir/build.sh"
grep -q 'verify_md5 "$source_dir/canary-islands-latest.osm.pbf"' "$script_dir/build.sh"
grep -q -- '--store "/data/work/$release"' "$script_dir/build.sh"
grep -q 'trap cleanup_build_artifacts EXIT' "$script_dir/build.sh"
grep -q 'active_release_work_dir=$release_work_dir' "$script_dir/build.sh"
grep -q 'mv -Tf -- "$next_link" "$maps_dir/spain.pmtiles"' "$script_dir/build.sh"
grep -q 'water_polygons.shp' "$script_dir/build.sh"
grep -q 'bash "$script_dir/prepare-context.sh"' "$script_dir/build.sh"
bash -n "$script_dir/prepare-context.sh"
grep -q 'natural-earth-vector/v5.1.2/geojson/ne_110m_land.geojson' "$script_dir/prepare-context.sh"
grep -q 'natural-earth-vector/v5.1.2/geojson/ne_50m_populated_places_simple.geojson' "$script_dir/prepare-context.sh"
grep -q 'natural-earth-vector/v5.1.2/geojson/ne_10m_admin_0_map_units.geojson' "$script_dir/prepare-context.sh"
grep -Eq '^land_sha256=[0-9a-f]{64}$' "$script_dir/prepare-context.sh"
grep -Eq '^places_source_sha256=[0-9a-f]{64}$' "$script_dir/prepare-context.sh"
grep -Eq '^map_units_source_sha256=[0-9a-f]{64}$' "$script_dir/prepare-context.sh"
grep -Eq '^regional_land_sha256=[0-9a-f]{64}$' "$script_dir/prepare-context.sh"
grep -Eq '^places_sha256=[0-9a-f]{64}$' "$script_dir/prepare-context.sh"
grep -q -- "--proto '=https'" "$script_dir/prepare-context.sh"

units_fixture="$tmp_dir/map-units.geojson"
places_fixture="$tmp_dir/places.geojson"
regional_fixture="$tmp_dir/iberia.geojson"
cities_fixture="$tmp_dir/cities.geojson"
python3 - "$units_fixture" <<'PY'
import json
import sys

polygon = lambda ring: [[ring]]
spain = {
    "type": "Feature",
    "properties": {"GU_A3": "ESP", "ADM0_A3": "ESP", "NAME": "Spain"},
    "geometry": {"type": "MultiPolygon", "coordinates": [
        polygon([[-9, 36], [4, 36], [4, 44], [-9, 44], [-9, 36]])[0],
        polygon([[2, 39], [3, 39], [3, 40], [2, 40], [2, 39]])[0],
        polygon([[-18, 28], [-14, 28], [-14, 29], [-18, 29], [-18, 28]])[0],
    ]},
}
gibraltar = {
    "type": "Feature",
    "properties": {"GU_A3": "GIB", "ADM0_A3": "GIB", "NAME": "Gibraltar"},
    "geometry": {"type": "Polygon", "coordinates": [[
        [-5.4, 36], [-5.3, 36], [-5.3, 36.2], [-5.4, 36.2], [-5.4, 36],
    ]]},
}
with open(sys.argv[1], "w", encoding="utf-8") as target:
    json.dump({"type": "FeatureCollection", "features": [spain, gibraltar]}, target)
PY
cat > "$places_fixture" <<'JSON'
{"type":"FeatureCollection","features":[{"type":"Feature","properties":{"adm0name":"Spain","min_zoom":4,"name":"Madrid","scalerank":1},"geometry":{"type":"Point","coordinates":[-3.7,40.4]}}]}
JSON
python3 "$script_dir/derive-context.py" "$units_fixture" "$places_fixture" "$regional_fixture" "$cities_fixture"
python3 - "$regional_fixture" "$cities_fixture" <<'PY'
import json
import sys

with open(sys.argv[1], encoding="utf-8") as source:
    land = json.load(source)
with open(sys.argv[2], encoding="utf-8") as source:
    cities = json.load(source)
assert [feature["properties"]["territory"] for feature in land["features"]] == ["ESP"]
assert cities["features"][0]["properties"]["name"] == "Madrid"
PY

missing_islands="$tmp_dir/missing-islands.geojson"
python3 - "$units_fixture" "$missing_islands" <<'PY'
import json
import sys

with open(sys.argv[1], encoding="utf-8") as source:
    data = json.load(source)
spain = next(feature for feature in data["features"] if feature["properties"]["GU_A3"] == "ESP")
spain["geometry"]["coordinates"] = spain["geometry"]["coordinates"][:1]
with open(sys.argv[2], "w", encoding="utf-8") as target:
    json.dump(data, target)
PY
if python3 "$script_dir/derive-context.py" "$missing_islands" "$places_fixture" \
	"$tmp_dir/invalid-land.geojson" "$tmp_dir/invalid-cities.geojson" >/dev/null 2>&1; then
	echo "El contexto aceptó una España sin Baleares ni Canarias" >&2
	exit 1
fi

mock_bin="$tmp_dir/mock-bin"
mkdir -p "$mock_bin"
cat > "$mock_bin/curl" <<'SH'
#!/bin/sh
output=
while [ "$#" -gt 0 ]; do
	if [ "$1" = "--output" ]; then
		shift
		output=$1
	fi
	shift
done
printf 'contenido alterado' > "$output"
SH
chmod +x "$mock_bin/curl"
if PATH="$mock_bin:$PATH" MAP_TILES_DATA_DIR="$tmp_dir/context-data" \
	bash "$script_dir/prepare-context.sh" >/dev/null 2>&1; then
	echo "El contexto aceptó una descarga con checksum incorrecto" >&2
	exit 1
fi
if grep -q -- '--threads 0 --verbose' "$script_dir/build.sh"; then
	echo "El constructor conserva una salida verbose excesiva" >&2
	exit 1
fi
grep -q 'Access-Control-Expose-Headers "Accept-Ranges' "$project_dir/Caddyfile"
grep -q 'file_server' "$project_dir/Caddyfile"
grep -q 'https://{$MAP_DOMAIN}' "$project_dir/Caddyfile"
grep -q '/context/\*' "$project_dir/Caddyfile"
grep -q '/context/\*' "$script_dir/Caddyfile.dev"
grep -q '^  map-server:' "$project_dir/docker-compose.dev.yml"
grep -q './map-tiles/data/publish:/srv/maps:ro' "$project_dir/docker-compose.dev.yml"
grep -q 'package-lock.sha256' "$project_dir/frontend/entrypoint.dev.sh"
grep -q 'frontend-entrypoint-dev' "$project_dir/frontend/Dockerfile.dev"
if grep -q 'reverse_proxy tile-proxy' "$project_dir/Caddyfile"; then
	echo "Caddy conserva el proxy raster retirado" >&2
	exit 1
fi
if grep -q '^  tile-proxy:' "$project_dir/docker-compose.prod.yml"; then
	echo "Compose conserva el servicio raster retirado" >&2
	exit 1
fi
if grep -q 'raw.githubusercontent.com' "$project_dir/frontend/src/lib/mapConfig.ts"; then
	echo "El navegador conserva una dependencia cartográfica externa" >&2
	exit 1
fi

echo "Tests del constructor PMTiles: OK"
