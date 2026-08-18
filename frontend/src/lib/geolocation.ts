export type GeolocationErrorKind = 'denied' | 'timeout' | 'unavailable' | 'unsupported' | 'invalid';

/** Origen de la ubicación: geolocalización del dispositivo o búsqueda manual. */
export type LocationSource = 'device' | 'search';

export interface UserLocation {
	lat: number;
	lon: number;
	source: LocationSource;
}

export const LOCATION_EVENT = 'gasolineras:location';

/** Se emite cuando se descarta la ubicación marcada (p. ej. al volver al modo mapa). */
export const LOCATION_CLEAR_EVENT = 'gasolineras:location-clear';

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
export function dispatchUserLocation(
	lat: number,
	lon: number,
	source: LocationSource = 'search',
): void {
	lastLocation = { lat, lon, source };
	window.dispatchEvent(
		new CustomEvent<UserLocation>(LOCATION_EVENT, { detail: { lat, lon, source } }),
	);
}

let lastLocation: UserLocation | null = null;

/**
 * Última ubicación notificada, o null. Queda disponible para las islas que se
 * hidraten después del primer evento (por ejemplo, el mapa al inicializarse).
 */
export function getLastLocation(): UserLocation | null {
	return lastLocation;
}

/** Limpia la última ubicación recordada (solo para aislamiento de pruebas). */
export function resetLastLocation(): void {
	lastLocation = null;
}

/** Descarta la ubicación marcada y lo notifica al resto de islas. */
export function dispatchLocationClear(): void {
	lastLocation = null;
	window.dispatchEvent(new CustomEvent(LOCATION_CLEAR_EVENT));
}

/** Distancia en kilómetros entre dos coordenadas (fórmula del haversine). */
export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
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