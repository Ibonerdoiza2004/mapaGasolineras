#!/usr/bin/env bash
set -euo pipefail

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
data_dir=${MAP_TILES_DATA_DIR:-"$script_dir/data"}
source_dir="$data_dir/source"
aux_dir="$data_dir/aux"
work_dir="$data_dir/work"
output_dir="$data_dir/output"
publish_dir="$data_dir/publish"
release=${MAP_TILES_RELEASE:-$(date -u +%Y%m%dT%H%M%SZ)}
# El registro oficial solo publica `master`; el digest fija una revisión
# reproducible y conserva el índice multi-arquitectura (amd64/arm64).
tilemaker_image=${TILEMAKER_IMAGE:-ghcr.io/systemed/tilemaker:master@sha256:d32505d7827907089c2dd07517524276946d8930b4b82e93cf5c25ec989bbe41}
active_release_work_dir=
active_temporary_output=

cleanup_build_artifacts() {
	if [[ -n "$active_release_work_dir" ]]; then
		rm -rf -- "$active_release_work_dir"
	fi
	if [[ -n "$active_temporary_output" ]]; then
		rm -f -- "$active_temporary_output"
	fi
}

trap cleanup_build_artifacts EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

spain_url=https://download.geofabrik.de/europe/spain-latest.osm.pbf
canaries_url=https://download.geofabrik.de/africa/canary-islands-latest.osm.pbf
coastline_url=https://osmdata.openstreetmap.de/download/water-polygons-split-4326.zip
natural_earth_base=https://naciscdn.org/naturalearth/10m
assets_url=${BASEMAPS_ASSETS_URL:-https://github.com/protomaps/basemaps-assets/archive/refs/heads/main.zip}

case "$release" in
	*[!0-9A-Za-z._-]*|'')
		echo "MAP_TILES_RELEASE contiene caracteres no permitidos" >&2
		exit 2
		;;
esac

require_command() {
	command -v "$1" >/dev/null 2>&1 || {
		echo "Falta el comando requerido: $1" >&2
		exit 2
	}
}

download() {
	local url=$1
	local destination=$2
	if [[ -s "$destination" ]]; then
		return
	fi
	case "$url" in
		https://*) ;;
		*) echo "Se rechaza una descarga no HTTPS: $url" >&2; exit 2 ;;
	esac
	local temporary="${destination}.part"
	rm -f -- "$temporary"
	curl --fail --show-error --location --progress-bar --proto '=https' \
		--retry 4 --retry-all-errors --output "$temporary" "$url"
	mv -- "$temporary" "$destination"
}

download_fresh() {
	local url=$1
	local destination=$2
	local temporary="${destination}.part"
	case "$url" in
		https://*) ;;
		*) echo "Se rechaza una descarga no HTTPS: $url" >&2; exit 2 ;;
	esac
	rm -f -- "$temporary"
	curl --fail --show-error --location --progress-bar --proto '=https' \
		--retry 4 --retry-all-errors --output "$temporary" "$url"
	mv -- "$temporary" "$destination"
}

verify_md5() {
	local file=$1
	bash "$script_dir/verify-md5.sh" "$file" "${file}.md5"
}

prepare_sources() {
	# Los nombres upstream son `latest`: se refresca primero el checksum y solo
	# se conserva el PBF local si sigue correspondiendo a esa versión.
	download_fresh "${spain_url}.md5" "$source_dir/spain-latest.osm.pbf.md5"
	if verify_md5 "$source_dir/spain-latest.osm.pbf" >/dev/null 2>&1; then
		:
	else
		local status=$?
		if (( status != 1 )); then
			echo "No se puede validar el checksum oficial de España" >&2
			exit "$status"
		fi
		rm -f -- "$source_dir/spain-latest.osm.pbf"
		download "$spain_url" "$source_dir/spain-latest.osm.pbf"
	fi
	download_fresh "${canaries_url}.md5" "$source_dir/canary-islands-latest.osm.pbf.md5"
	if verify_md5 "$source_dir/canary-islands-latest.osm.pbf" >/dev/null 2>&1; then
		:
	else
		local status=$?
		if (( status != 1 )); then
			echo "No se puede validar el checksum oficial de Canarias" >&2
			exit "$status"
		fi
		rm -f -- "$source_dir/canary-islands-latest.osm.pbf"
		download "$canaries_url" "$source_dir/canary-islands-latest.osm.pbf"
	fi
	verify_md5 "$source_dir/spain-latest.osm.pbf"
	verify_md5 "$source_dir/canary-islands-latest.osm.pbf"
}

prepare_auxiliary_data() {
	mkdir -p "$aux_dir/coastline" "$aux_dir/landcover"
	download "$coastline_url" "$aux_dir/coastline/water-polygons-split-4326.zip"
	if [[ ! -s "$aux_dir/coastline/water_polygons.shp" ]]; then
		unzip -oq -j "$aux_dir/coastline/water-polygons-split-4326.zip" -d "$aux_dir/coastline"
	fi

	local natural_files=(
		physical/ne_10m_antarctic_ice_shelves_polys.zip
		cultural/ne_10m_urban_areas.zip
		physical/ne_10m_glaciated_areas.zip
	)
	for relative in "${natural_files[@]}"; do
		local archive=${relative##*/}
		local name=${archive%.zip}
		download "$natural_earth_base/$relative" "$aux_dir/landcover/$archive"
		if [[ ! -s "$aux_dir/landcover/$name/$name.shp" ]]; then
			mkdir -p "$aux_dir/landcover/$name"
			unzip -oq "$aux_dir/landcover/$archive" -d "$aux_dir/landcover/$name"
		fi
	done
}

prepare_assets() {
	mkdir -p "$publish_dir/fonts"
	if [[ -s "$publish_dir/fonts/Noto Sans Regular/0-255.pbf" ]]; then
		return
	fi
	local archive="$aux_dir/basemaps-assets.zip"
	local unpacked="$aux_dir/basemaps-assets"
	download "$assets_url" "$archive"
	rm -rf -- "$unpacked"
	mkdir -p "$unpacked"
	unzip -oq "$archive" -d "$unpacked"
	local root
	root=$(find "$unpacked" -mindepth 1 -maxdepth 1 -type d -name 'basemaps-assets-*' -print -quit)
	if [[ -z "$root" || ! -d "$root/fonts" ]]; then
		echo "El paquete de fuentes no tiene la estructura esperada" >&2
		exit 1
	fi
	cp -a "$root/fonts/." "$publish_dir/fonts/"
}

build_pmtiles() {
	local temporary="$output_dir/.spain-${release}.building.pmtiles"
	local maps_dir="$publish_dir/maps"
	local final="$maps_dir/spain-${release}.pmtiles"
	local release_work_dir="$work_dir/$release"
	local next_link="$maps_dir/.spain-${release}.current"
	if [[ -e "$final" ]]; then
		echo "La versión $release ya existe; usa un MAP_TILES_RELEASE nuevo" >&2
		exit 2
	fi
	active_release_work_dir=$release_work_dir
	active_temporary_output=$temporary
	rm -f -- "$temporary"
	rm -rf -- "$release_work_dir"
	mkdir -p "$release_work_dir" "$maps_dir"
	if docker run --rm \
		--volume "$data_dir:/data" \
		--volume "$script_dir/config-openmaptiles-z15.json:/data/config-openmaptiles-z15.json:ro" \
		"$tilemaker_image" \
		--input /data/source/spain-latest.osm.pbf \
		--input /data/source/canary-islands-latest.osm.pbf \
		--output "/data/output/$(basename "$temporary")" \
		--store "/data/work/$release" \
		--config /data/config-openmaptiles-z15.json \
		--process resources/process-openmaptiles.lua \
		--threads 0; then
		:
	else
		local status=$?
		rm -rf -- "$release_work_dir"
		return "$status"
	fi
	PMTILES_MIN_BYTES=${PMTILES_MIN_BYTES:-104857600} \
		PMTILES_EXPECT_MIN_ZOOM=0 PMTILES_EXPECT_MAX_ZOOM=15 \
		PMTILES_REQUIRED_BOUNDS_E7='-180000000 270000000 45000000 438000000' \
		"$script_dir/validate-pmtiles.sh" "$temporary"
	mv -- "$temporary" "$final"
	rm -rf -- "$release_work_dir"
	active_release_work_dir=
	active_temporary_output=
	ln -s -- "$(basename "$final")" "$next_link"
	mv -Tf -- "$next_link" "$maps_dir/spain.pmtiles"

	{
		printf 'release=%s\n' "$release"
		printf 'tilemaker_image=%s\n' "$tilemaker_image"
		printf 'maxzoom=15\n'
		sha256sum "$source_dir/spain-latest.osm.pbf"
		sha256sum "$source_dir/canary-islands-latest.osm.pbf"
		sha256sum "$aux_dir/basemaps-assets.zip"
		sha256sum "$final"
	} > "$maps_dir/spain-${release}.manifest"
}

require_command curl
require_command unzip
require_command md5sum
require_command sha256sum
require_command docker
mkdir -p "$source_dir" "$aux_dir" "$work_dir" "$output_dir" "$publish_dir"
bash "$script_dir/prepare-context.sh"
prepare_sources
prepare_auxiliary_data
prepare_assets
build_pmtiles

echo "Publicado: $publish_dir/maps/spain-${release}.pmtiles"
