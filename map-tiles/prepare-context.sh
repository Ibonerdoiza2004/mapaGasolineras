#!/usr/bin/env bash
set -euo pipefail

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
data_dir=${MAP_TILES_DATA_DIR:-"$script_dir/data"}
context_dir="$data_dir/publish/context"
source_dir="$data_dir/aux/context"
land_destination="$context_dir/ne_110m_land.geojson"
regional_land_destination="$context_dir/iberia_land.geojson"
places_destination="$context_dir/spain_cities.geojson"
places_source="$source_dir/ne_50m_populated_places_simple.geojson"
map_units_source="$source_dir/ne_10m_admin_0_map_units.geojson"
land_url=https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_110m_land.geojson
places_url=https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_50m_populated_places_simple.geojson
map_units_url=https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_10m_admin_0_map_units.geojson
land_sha256=9e0729ee253ca7d7a5c4ae9395fb1902264c5377c52e224d13dd85010e2835d9
places_source_sha256=8e70756b39fae9bcdc1e332bfc510c024c5edd3a13203ffd20092ee37b61d978
map_units_source_sha256=57da82be755f4afccd8f3b14251bb2752f5df1395f47d2d86f817470c4a48862
regional_land_sha256=170220f13046fca5fca90ade363a6f041355edb5f7e73acf0a57edd7c506c1cf
places_sha256=5511e1f4605864a76a57de9ce71c82d23a5b6abf895dc48bb80e243dd7c520d6

for command in curl sha256sum python3; do
	command -v "$command" >/dev/null 2>&1 || {
		echo "Falta el comando requerido: $command" >&2
		exit 2
	}
done

valid_checksum() {
	[[ -f "$1" ]] && [[ "$(sha256sum "$1" | cut -d' ' -f1)" == "$2" ]]
}

download_verified() {
	local url=$1
	local destination=$2
	local checksum=$3
	local temporary="${destination}.part"
	if valid_checksum "$destination" "$checksum"; then
		return
	fi
	rm -f -- "$temporary"
	curl --fail --show-error --location --proto '=https' --retry 4 --retry-all-errors \
		--output "$temporary" "$url"
	if ! valid_checksum "$temporary" "$checksum"; then
		rm -f -- "$temporary"
		echo "El recurso Natural Earth no coincide con la versión esperada" >&2
		exit 1
	fi
	mv -- "$temporary" "$destination"
}

if valid_checksum "$land_destination" "$land_sha256" \
	&& valid_checksum "$regional_land_destination" "$regional_land_sha256" \
	&& valid_checksum "$places_destination" "$places_sha256"; then
	echo "Contexto Natural Earth ya disponible: $context_dir"
	exit 0
fi

mkdir -p "$context_dir" "$source_dir"
download_verified "$land_url" "$land_destination" "$land_sha256"
download_verified "$places_url" "$places_source" "$places_source_sha256"
download_verified "$map_units_url" "$map_units_source" "$map_units_source_sha256"
python3 "$script_dir/derive-context.py" \
	"$map_units_source" "$places_source" \
	"${regional_land_destination}.part" "${places_destination}.part"

if ! valid_checksum "${regional_land_destination}.part" "$regional_land_sha256" \
	|| ! valid_checksum "${places_destination}.part" "$places_sha256"; then
	rm -f -- "${regional_land_destination}.part" "${places_destination}.part"
	echo "Las capas derivadas no coinciden con el resultado esperado" >&2
	exit 1
fi
mv -- "${regional_land_destination}.part" "$regional_land_destination"
mv -- "${places_destination}.part" "$places_destination"
echo "Contexto Natural Earth publicado: $context_dir"
