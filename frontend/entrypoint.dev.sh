#!/bin/sh
set -eu

lock_hash=$(sha256sum package-lock.json | awk '{ print $1 }')
installed_hash=$(cat node_modules/.package-lock.sha256 2>/dev/null || true)

if [ "$lock_hash" != "$installed_hash" ]; then
	echo "package-lock.json ha cambiado; sincronizando dependencias de desarrollo"
	npm ci
	printf '%s\n' "$lock_hash" > node_modules/.package-lock.sha256
fi

# Astro/Vite regeneran estas cachés al arrancar. No deben sobrevivir a una
# reconstrucción de la imagen porque pueden apuntar a workers ya inexistentes.
rm -rf -- .astro node_modules/.vite
exec npm run dev -- --host 0.0.0.0
