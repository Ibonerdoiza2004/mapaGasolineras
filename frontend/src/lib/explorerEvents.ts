import type { FuelType } from './fuel';
import type { NearbyStation, OrderBy } from './stations';

/** Cambio del combustible seleccionado por el usuario (detail: { combustible }). */
export const FUEL_EVENT = 'gasolineras:fuel';

/** Cambio del radio de búsqueda (detail: { radio: number | null }). */
export const RADIO_EVENT = 'gasolineras:radio';

/** Cambio del criterio de ordenación (detail: { orden: OrderBy }). */
export const ORDEN_EVENT = 'gasolineras:orden';

/** Rectángulo visible del mapa (detail: { bounds }). */
export const VIEWPORT_EVENT = 'gasolineras:viewport';

/** Nuevos resultados de estaciones cercanas (detail: { stations }). */
export const STATIONS_EVENT = 'gasolineras:stations';

/** Estación añadida o quitada del panel de comparar (detail: { id: string | null }). */
export const STATION_SELECT_EVENT = 'gasolineras:station-select';

/** Estación resaltada en el mapa desde la lista (detail: { id: string | null }). */
export const STATION_FOCUS_EVENT = 'gasolineras:station-focus';

/** Cambia el conjunto de estaciones en el panel de comparar (detail: { ids, added }). */
export const COMPARE_EVENT = 'gasolineras:comparar';

/** Ficha detallada de una estación (detail: { id: string | null }). */
export const STATION_DETAIL_EVENT = 'gasolineras:detalle';

/** Rango de precios de los resultados actuales (detail: { range: PriceRange | null }). */
export const PRICE_RANGE_EVENT = 'gasolineras:precio-rango';

/** Filtro de precio elegido por el usuario (detail: { min: number; max: number }). */
export const PRICE_FILTER_EVENT = 'gasolineras:precio';

/** Solicitud del rango completo por parte del slider. */
export const PRICE_RANGE_REQUEST_EVENT = 'gasolineras:solicitar-rango-precio';

export interface PriceRange {
	min: number;
	max: number;
}

export interface ViewportBounds {
	minLat: number;
	maxLat: number;
	minLon: number;
	maxLon: number;
}

let lastViewport: ViewportBounds | null = null;

export function dispatchFuelChange(combustible: FuelType): void {
	window.dispatchEvent(
		new CustomEvent<{ combustible: FuelType }>(FUEL_EVENT, { detail: { combustible } }),
	);
}

/** Notifica el radio en kilómetros; null significa "lo visible en el mapa". */
export function dispatchRadioChange(radio: number | null): void {
	window.dispatchEvent(new CustomEvent<{ radio: number | null }>(RADIO_EVENT, { detail: { radio } }));
}

/** Notifica el criterio de ordenación elegido (precio, distancia o ahorro). */
export function dispatchOrdenChange(orden: OrderBy): void {
	window.dispatchEvent(new CustomEvent<{ orden: OrderBy }>(ORDEN_EVENT, { detail: { orden } }));
}

/**
 * Notifica el rectángulo geográfico que muestra el mapa en este momento. El
 * último valor queda disponible para las islas que se hidraten después del
 * primer evento (el mapa emite el viewport inicial antes de que el listado
 * haya registrado su listener).
 */
export function dispatchViewportChange(bounds: ViewportBounds): void {
	lastViewport = bounds;
	window.dispatchEvent(
		new CustomEvent<{ bounds: ViewportBounds }>(VIEWPORT_EVENT, { detail: { bounds } }),
	);
}

/** Último viewport notificado por el mapa, o null si aún no lo ha emitido. */
export function getLastViewport(): ViewportBounds | null {
	return lastViewport;
}

/** Limpia el último viewport recordado (solo para aislamiento de pruebas). */
export function resetLastViewport(): void {
	lastViewport = null;
}

export function dispatchNearbyStations(stations: NearbyStation[]): void {
	window.dispatchEvent(
		new CustomEvent<{ stations: NearbyStation[] }>(STATIONS_EVENT, { detail: { stations } }),
	);
}

/** Notifica la estación que se añade o quita del panel de comparar. */
export function dispatchStationSelect(id: string | null): void {
	window.dispatchEvent(
		new CustomEvent<{ id: string | null }>(STATION_SELECT_EVENT, { detail: { id } }),
	);
}

/** Notifica la estación resaltada en el mapa desde la lista; null la limpia. */
export function dispatchStationFocus(id: string | null): void {
	window.dispatchEvent(
		new CustomEvent<{ id: string | null }>(STATION_FOCUS_EVENT, { detail: { id } }),
	);
}

/** Notifica el conjunto de estaciones añadidas al panel de comparar. */
export function dispatchCompareChange(ids: string[], added: string | null): void {
	window.dispatchEvent(
		new CustomEvent<{ ids: string[]; added: string | null }>(COMPARE_EVENT, {
			detail: { ids, added },
		}),
	);
}

/** Notifica la ficha a abrir; null la cierra. */
export function dispatchStationDetail(id: string | null): void {
	window.dispatchEvent(
		new CustomEvent<{ id: string | null }>(STATION_DETAIL_EVENT, { detail: { id } }),
	);
}

/** Notifica el rango de precios de los resultados actuales (min/max del dataset). */
export function dispatchPriceRange(range: PriceRange | null): void {
	window.dispatchEvent(
		new CustomEvent<{ range: PriceRange | null }>(PRICE_RANGE_EVENT, { detail: { range } }),
	);
}

/** Notifica el rango de precios elegido por el usuario para filtrar. */
export function dispatchPriceFilter(min: number, max: number): void {
	window.dispatchEvent(
		new CustomEvent<{ min: number; max: number }>(PRICE_FILTER_EVENT, { detail: { min, max } }),
	);
}

export function dispatchPriceRangeRequest(): void {
	window.dispatchEvent(new CustomEvent(PRICE_RANGE_REQUEST_EVENT));
}
