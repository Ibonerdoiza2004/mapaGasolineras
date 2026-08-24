#!/usr/bin/env bash
set -euo pipefail

tmp_dir=$(mktemp -d)
trap 'rm -rf -- "$tmp_dir"' EXIT

curl --fail --silent --show-error http://localhost:8081/health > /dev/null
curl --fail --silent --show-error \
	--range 0-6 \
	--header 'Origin: http://localhost:4321' \
	--dump-header "$tmp_dir/headers" \
	--output "$tmp_dir/range" \
	http://localhost:8081/maps/spain.pmtiles

if [[ $(LC_ALL=C head -c 7 "$tmp_dir/range") != PMTiles ]]; then
	echo "La respuesta Range local no contiene una cabecera PMTiles" >&2
	exit 1
fi
grep -Eiq '^HTTP/[0-9.]+ 206' "$tmp_dir/headers"
grep -Eiq '^Content-Range: bytes 0-6/' "$tmp_dir/headers"
grep -Eiq '^Access-Control-Allow-Origin: \*' "$tmp_dir/headers"

echo "Servidor PMTiles local: OK"
