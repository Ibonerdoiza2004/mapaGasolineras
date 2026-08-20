import { useEffect, useRef } from 'react';
import { dispatchUserLocation } from '../lib/geolocation';
import { getUrlParam } from '../lib/urlState';

/** Rango geográfico de España (península, Baleares y Canarias). */
const LAT_MIN = 27;
const LAT_MAX = 44.5;
const LON_MIN = -18.5;
const LON_MAX = 5;

const DEEP_LINK_PARAMS = ['lat', 'lon', 'lugar'] as const;

/**
 * Aterrizaje desde una página SEO de municipio: si la URL lleva `lat`/`lon`
 * válidos dentro de España, los convierte en una ubicación de búsqueda (lo
 * que activa el «Radio de búsqueda» a 10 km por defecto) y limpia los
 * parámetros para que una recarga no re-aplique la ubicación.
 */
export default function DeepLinkLocation() {
	const appliedRef = useRef(false);

	useEffect(() => {
		if (appliedRef.current) return;
		appliedRef.current = true;

		const rawLat = getUrlParam('lat');
		const rawLon = getUrlParam('lon');
		if (rawLat === null || rawLon === null) return;

		const lat = Number(rawLat);
		const lon = Number(rawLon);
		if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
		if (lat < LAT_MIN || lat > LAT_MAX || lon < LON_MIN || lon > LON_MAX) return;

		dispatchUserLocation(lat, lon, 'search');

		const url = new URL(window.location.href);
		for (const param of DEEP_LINK_PARAMS) {
			url.searchParams.delete(param);
		}
		window.history.replaceState(null, '', url);
	}, []);

	return null;
}