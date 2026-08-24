import { apiUrl } from '../config/runtime';
import type { FuelType } from './fuel';
import type { ViewportBounds } from './explorerEvents';

export interface NearbyStation {
	id: string;
	rotulo: string;
	direccion: string;
	localidad: string;
	provincia: string;
	latitud: number;
	longitud: number;
	distanciaKm: number;
	/** null si la estación no vende el combustible consultado. */
	precio: number | null;
	/** null si no hay precio; 0 para la mejor opción. */
	ahorro: number | null;
	fechaActualizacion: string;
}

/** Contrato ligero del conjunto completo que consume exclusivamente el mapa. */
export interface MapStationSummary {
	id: string;
	rotulo: string;
	latitud: number;
	longitud: number;
	precio: number | null;
	mejorOpcion: boolean;
	fechaActualizacion: string;
}

export interface MapStationsQuery {
	combustible: FuelType;
	minPrecio?: number;
	maxPrecio?: number;
	marcas?: string[];
}

export type OrderBy = 'precio' | 'distancia';

export const DEFAULT_ORDER: OrderBy = 'precio';

export const ORDER_OPTIONS: ReadonlyArray<{ value: OrderBy; label: string }> = [
	{ value: 'precio', label: 'Más barato' },
	{ value: 'distancia', label: 'Más cercano' },
];

export function isOrderBy(value: unknown): value is OrderBy {
	return value === 'precio' || value === 'distancia';
}

export interface NearbyQuery {
	lat: number;
	lon: number;
	/** Radio en kilómetros; null consulta el viewport del mapa. */
	radio: number | null;
	/** Rectángulo del viewport; se envía cuando no hay radio. */
	bounds?: ViewportBounds;
	combustible: FuelType;
	orden: OrderBy;
	/** Límite del modo viewport; por defecto NEARBY_LIMIT. */
	limit?: number;
	/** Precio mínimo en €/l para acotar los resultados (opcional). */
	minPrecio?: number;
	/** Precio máximo en €/l para acotar los resultados (opcional). */
	maxPrecio?: number;
	/** Códigos de marca seleccionados para filtrar (vacío o ausente = sin filtro). */
	marcas?: string[];
}

/** Marca del catálogo con el número de estaciones que la usan (GET /api/stations/brands). */
export interface Brand {
	code: string;
	label: string;
	count: number;
}

/** Tope de resultados del modo viewport: acota la carga al abrir el mapa.
 *  Con radio no se envía límite: se devuelven todas las estaciones. */
export const NEARBY_LIMIT = 500;

/** Rango de precios (mínimo y máximo) del dataset completo de un área. */
export interface PriceRangeResponse {
	min: number | null;
	max: number | null;
}

/** Ficha completa de una estación devuelta por GET /api/stations/{id}. */
export interface StationDetail {
	id: string;
	rotulo: string;
	direccion: string;
	codigoPostal: string;
	localidad: string;
	municipio: string;
	provincia: string;
	latitud: number;
	longitud: number;
	horario: string | null;
	tipoVenta: string | null;
	margen: string | null;
	precios: Partial<Record<FuelType, number>>;
	fechaActualizacion: string;
}

/** Consulta las estaciones al backend (única fuente de precios). */
export async function fetchNearbyStations(query: NearbyQuery, signal?: AbortSignal): Promise<NearbyStation[]> {
	const params = new URLSearchParams({
		lat: String(query.lat),
		lon: String(query.lon),
		combustible: query.combustible,
		orden: query.orden,
	});
	if (query.radio !== null) {
		params.set('radio', String(query.radio));
	} else {
		params.set('limit', String(query.limit ?? NEARBY_LIMIT));
		if (query.bounds) {
			params.set('minLat', String(query.bounds.minLat));
			params.set('maxLat', String(query.bounds.maxLat));
			params.set('minLon', String(query.bounds.minLon));
			params.set('maxLon', String(query.bounds.maxLon));
		}
	}
	if (query.minPrecio != null) {
		params.set('minPrecio', String(query.minPrecio));
	}
	if (query.maxPrecio != null) {
		params.set('maxPrecio', String(query.maxPrecio));
	}
	if (query.marcas && query.marcas.length > 0) {
		params.set('marcas', query.marcas.join(','));
	}
	const response = await fetch(apiUrl(`/api/stations/nearby?${params.toString()}`), { signal });
	if (!response.ok) {
		throw new Error(`nearby ${response.status}`);
	}
	return (await response.json()) as NearbyStation[];
}

/**
 * Descarga todas las estaciones aplicables en un único contrato compacto. No
 * incluye viewport, radio, orden ni datos de tarjeta: mover el mapa no repite
 * esta petición.
 */
export async function fetchMapStations(
	query: MapStationsQuery,
	signal?: AbortSignal,
): Promise<MapStationSummary[]> {
	const params = new URLSearchParams({ combustible: query.combustible });
	if (query.minPrecio != null) params.set('minPrecio', String(query.minPrecio));
	if (query.maxPrecio != null) params.set('maxPrecio', String(query.maxPrecio));
	if (query.marcas && query.marcas.length > 0) params.set('marcas', query.marcas.join(','));
	const response = await fetch(apiUrl(`/api/stations/map?${params.toString()}`), { signal });
	if (!response.ok) throw new Error(`map stations ${response.status}`);
	return (await response.json()) as MapStationSummary[];
}

/**
 * Catálogo de marcas con conteos de estaciones. Se usa para el filtro de
 * marca; ante un fallo del backend se devuelve una lista vacía y el filtro
 * se oculta en lugar de bloquear la búsqueda.
 */
export async function fetchBrands(): Promise<Brand[]> {
	const response = await fetch(apiUrl('/api/stations/brands'));
	if (!response.ok) {
		return [];
	}
	return (await response.json()) as Brand[];
}
/**
 * Rango de precios (mínimo y máximo) sobre toda la base de datos, sin filtrar
 * por combustible: acota el slider de precio y se mantiene estable aunque el
 * usuario haga zoom, cambie de zona o de combustible.
 */
export async function fetchPriceRange(): Promise<PriceRangeResponse | null> {
	const response = await fetch(apiUrl('/api/stations/nearby/price-range'));
	if (!response.ok) {
		return null;
	}
	return (await response.json()) as PriceRangeResponse;
}

/** Ficha completa de una estación (precios, horario, dirección y fecha). */
export async function fetchStationDetail(id: string): Promise<StationDetail> {
	const response = await fetch(apiUrl(`/api/stations/${encodeURIComponent(id)}`));
	if (!response.ok) {
		throw new Error(`detail ${response.status}`);
	}
	return (await response.json()) as StationDetail;
}

export function formatPrice(precio: number): string {
	return `${precio.toLocaleString('es-ES', {
		minimumFractionDigits: 3,
		maximumFractionDigits: 3,
	})} €/l`;
}

export function formatDistance(distanciaKm: number): string {
	return `${distanciaKm.toLocaleString('es-ES', { maximumFractionDigits: 1 })} km`;
}

/** Una estación con un precio más antiguo que esto no se recomienda como mejor opción. */
export const PRICE_FRESHNESS_DAYS = 7;

/** Convierte a Date tanto fechas ISO 8601 como el formato MITECO (dd/MM/yyyy HH:mm:ss). */
function parseFlexibleDate(value: string): Date {
	const iso = new Date(value);
	if (!Number.isNaN(iso.getTime())) return iso;
	const match = /^(\d{2})\/(\d{2})\/(\d{4})(?: (\d{1,2}):(\d{2}):(\d{2}))?$/.exec(value.trim());
	if (match) {
		const [, d, m, y, hh = '0', mm = '0', ss = '0'] = match;
		return new Date(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm), Number(ss));
	}
	return new Date(Number.NaN);
}

/** Indica si la fecha de actualización del precio es reciente (no caducada). */
export function isPriceFresh(iso: string | null | undefined): boolean {
	if (!iso) return false;
	const date = parseFlexibleDate(iso);
	if (Number.isNaN(date.getTime())) return false;
	const ageMs = Date.now() - date.getTime();
	return ageMs >= 0 && ageMs <= PRICE_FRESHNESS_DAYS * 24 * 60 * 60 * 1000;
}

/** Formatea la fecha de actualización en hora local; null si no es válida. */
export function formatUpdateDate(iso: string | null | undefined): string | null {
	if (!iso) return null;
	const date = parseFlexibleDate(iso);
	if (Number.isNaN(date.getTime())) return null;
	return date.toLocaleDateString('es-ES', {
		day: '2-digit',
		month: 'short',
		hour: '2-digit',
		minute: '2-digit',
	});
}
