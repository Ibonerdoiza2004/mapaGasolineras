#!/usr/bin/env bash
set -euo pipefail

file=${1:-}
min_bytes=${PMTILES_MIN_BYTES:-104857600}
expected_min_zoom=${PMTILES_EXPECT_MIN_ZOOM:-}
expected_max_zoom=${PMTILES_EXPECT_MAX_ZOOM:-}
required_bounds=${PMTILES_REQUIRED_BOUNDS_E7:-}

if [[ -z "$file" ]]; then
	echo "Uso: validate-pmtiles.sh <archivo.pmtiles>" >&2
	exit 2
fi
if [[ ! -f "$file" ]]; then
	echo "No existe el PMTiles: $file" >&2
	exit 1
fi
if [[ ! "$min_bytes" =~ ^[0-9]+$ ]] || (( min_bytes < 1 )); then
	echo "PMTILES_MIN_BYTES debe ser un entero positivo" >&2
	exit 2
fi

size=$(stat -Lc '%s' "$file")
if (( size < min_bytes || size < 127 )); then
	echo "PMTiles demasiado pequeño: $size bytes (mínimo $min_bytes)" >&2
	exit 1
fi

magic=$(LC_ALL=C head -c 7 "$file")
if [[ "$magic" != "PMTiles" ]]; then
	echo "Cabecera PMTiles inválida" >&2
	exit 1
fi

version=$(od -An -tu1 -j7 -N1 "$file" | tr -d ' ')
tile_type=$(od -An -tu1 -j99 -N1 "$file" | tr -d ' ')
min_zoom=$(od -An -tu1 -j100 -N1 "$file" | tr -d ' ')
max_zoom=$(od -An -tu1 -j101 -N1 "$file" | tr -d ' ')
read -r min_lon_e7 min_lat_e7 max_lon_e7 max_lat_e7 < <(od -An -td4 -j102 -N16 "$file")
if [[ "$version" != 3 ]]; then
	echo "Versión PMTiles no soportada: $version" >&2
	exit 1
fi
if [[ "$tile_type" != 1 ]]; then
	echo "El archivo no contiene teselas vectoriales MVT (tipo $tile_type)" >&2
	exit 1
fi
if [[ -n "$expected_min_zoom" && "$min_zoom" != "$expected_min_zoom" ]]; then
	echo "Zoom mínimo inesperado: $min_zoom (esperado $expected_min_zoom)" >&2
	exit 1
fi
if [[ -n "$expected_max_zoom" && "$max_zoom" != "$expected_max_zoom" ]]; then
	echo "Zoom máximo inesperado: $max_zoom (esperado $expected_max_zoom)" >&2
	exit 1
fi
if [[ -n "$required_bounds" ]]; then
	if [[ ! "$required_bounds" =~ ^-?[0-9]+[[:space:]]+-?[0-9]+[[:space:]]+-?[0-9]+[[:space:]]+-?[0-9]+$ ]]; then
		echo "PMTILES_REQUIRED_BOUNDS_E7 debe contener oeste sur este norte como enteros E7" >&2
		exit 2
	fi
	read -r required_west required_south required_east required_north <<< "$required_bounds"
	if (( min_lon_e7 > required_west || min_lat_e7 > required_south || max_lon_e7 < required_east || max_lat_e7 < required_north )); then
		echo "Cobertura insuficiente: $min_lon_e7 $min_lat_e7 $max_lon_e7 $max_lat_e7 (debe contener $required_bounds)" >&2
		exit 1
	fi
fi

echo "PMTiles válido: $file ($size bytes, z$min_zoom-z$max_zoom)"
