export type GeolocationErrorKind = 'denied' | 'timeout' | 'unavailable' | 'unsupported' | 'invalid';

export interface UserLocation {
	lat: number;
	lon: number;
}

export const LOCATION_EVENT = 'gasolineras:location';

/** Acepta coordenadas finitas dentro de los rangos geográficos válidos. */
export function isValidCoordinates(lat: number, lon: number): boolean {
	return (
		Number.isFinite(lat) &&
		Number.isFinite(lon) &&
		lat >= -90 &&
		lat <= 90 &&
		lon >= -180 &&
		lon <= 180
	);
}

/** Traduce el código de error del navegador a un estado de producto. */
export function describeLocationError(code: number | null | undefined): GeolocationErrorKind {
	if (code === 1) return 'denied';
	if (code === 3) return 'timeout';
	return 'unavailable';
}

/** Notifica a las islas (mapa, listado) que el usuario tiene una ubicación nueva. */
export function dispatchUserLocation(lat: number, lon: number): void {
	window.dispatchEvent(new CustomEvent<UserLocation>(LOCATION_EVENT, { detail: { lat, lon } }));
}

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
	const toRad = (deg: number) => (deg * Math.PI) / 180;
	const dLat = toRad(lat2 - lat1);
	const dLon = toRad(lon2 - lon1);
	const a =
		Math.sin(dLat / 2) ** 2 +
		Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
	return 2 * 6371 * Math.asin(Math.sqrt(a));
}

/** Devuelve una copia de las estaciones ordenadas por distancia al punto dado. */
export function sortStationsByDistance<T extends { lat: number; lon: number }>(
	stations: readonly T[],
	lat: number,
	lon: number,
): T[] {
	return [...stations].sort(
		(a, b) => distanceKm(a.lat, a.lon, lat, lon) - distanceKm(b.lat, b.lon, lat, lon),
	);
}