#!/usr/bin/env bash
set -euo pipefail

file=${1:-}
checksum_file=${2:-}

if [[ -z "$file" || -z "$checksum_file" ]]; then
	echo "Uso: verify-md5.sh <archivo> <checksum.md5>" >&2
	exit 2
fi
if [[ ! -f "$checksum_file" ]]; then
	echo "No existe el checksum: $checksum_file" >&2
	exit 2
fi

expected=$(awk 'NR == 1 { print $1 }' "$checksum_file")
if [[ ! "$expected" =~ ^[0-9a-fA-F]{32}$ ]]; then
	echo "Checksum MD5 inválido para $file" >&2
	exit 2
fi
if [[ ! -f "$file" ]]; then
	echo "No existe el archivo que se debe validar: $file" >&2
	exit 1
fi

actual=$(md5sum "$file" | awk '{ print $1 }')
if [[ "${actual,,}" != "${expected,,}" ]]; then
	echo "Checksum incorrecto para $file" >&2
	exit 1
fi

echo "Checksum válido: $file"
