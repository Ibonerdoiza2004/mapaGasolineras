import { useCallback, useEffect, useRef, useState } from 'react';

import {
	COMPARE_EVENT,
	FUEL_EVENT,
	getLastRadio,
	getLastViewport,
	MARCAS_EVENT,
	ORDEN_EVENT,
	PRICE_FILTER_EVENT,
	PRICE_RANGE_REQUEST_EVENT,
	RADIO_EVENT,
	STATIONS_EVENT,
	VIEWPORT_EVENT,
	dispatchPriceRange,
	dispatchStationDetail,
	dispatchStationFocus,
	dispatchStationSelect,
	type PriceRange,
	type ViewportBounds,
} from '../lib/explorerEvents';
import { DEFAULT_FUEL, fuelLabel, isFuelType, type FuelType } from '../lib/fuel';
import {
	LOCATION_CLEAR_EVENT,
	LOCATION_EVENT,
	getLastLocation,
	type UserLocation,
	isValidCoordinates,
} from '../lib/geolocation';
import { isRadioValue, DEFAULT_RADIO } from '../lib/radio';
import { updateResultCount } from '../lib/resultCount';
import {
	DEFAULT_ORDER,
	fetchNearbyStations,
	fetchPriceRange,
	formatDistance,
	formatPrice,
	formatUpdateDate,
	isOrderBy,
	isPriceFresh,
	NEARBY_LIMIT,
	type NearbyStation,
	type OrderBy,
} from '../lib/stations';
import { getUrlParam } from '../lib/urlState';
import { MOBILE_MEDIA_QUERY, useMediaQuery } from '../lib/useMediaQuery';

type Status = 'idle' | 'loading' | 'success' | 'empty' | 'error';

const FUEL_URL_PARAM = 'combustible';
const ORDEN_URL_PARAM = 'orden';
const MAX_VIEWPORT_DEGREES = 180;

function isValidBounds(bounds: ViewportBounds): boolean {
	return (
		Number.isFinite(bounds.minLat) &&
		Number.isFinite(bounds.maxLat) &&
		Number.isFinite(bounds.minLon) &&
		Number.isFinite(bounds.maxLon) &&
		bounds.minLat <= bounds.maxLat &&
		bounds.minLon <= bounds.maxLon &&
		Math.abs(bounds.maxLat - bounds.minLat) <= MAX_VIEWPORT_DEGREES &&
		Math.abs(bounds.maxLon - bounds.minLon) <= MAX_VIEWPORT_DEGREES
	);
}

function readFuelFromUrl(): FuelType {
	const value = getUrlParam(FUEL_URL_PARAM);
	return isFuelType(value) ? value : DEFAULT_FUEL;
}

function readOrdenFromUrl(): OrderBy {
	const value = getUrlParam(ORDEN_URL_PARAM);
	return isOrderBy(value) ? value : DEFAULT_ORDER;
}

const FUEL_CLASS: Record<FuelType, string> = {
	DIESEL: 'station-card__fuel--diesel',
	GASOLINA_95: 'station-card__fuel--gasolina-95',
	GASOLINA_98: 'station-card__fuel--gasolina-98',
};

/**
 * Listado de estaciones. Escucha la ubicación (`gasolineras:location`), el
 * combustible (`gasolineras:fuel`), el radio (`gasolineras:radio`) y el
 * viewport del mapa (`gasolineras:viewport`) para consultar el backend y
 * difunde los resultados (`gasolineras:stations`) para el mapa.
 *
 * Con radio acotado se consultan las estaciones del radio alrededor de la
 * ubicación; con "todas" se consultan las del área visible en el mapa —sin
 * necesitar ubicación—, por lo que al entrar se ven las estaciones en
 * pantalla y mover o alejar el mapa vuelve a consultar.
 */
export default function StationList() {
	// La isla puede hidratarse después de que el filtro y el deep-link hayan
	// emitido sus eventos: se recupera el último valor notificado (como con el
	// viewport) para no quedarse en modo "área visible" ni sin punto de
	// referencia al aterrizar desde una página de municipio.
	const [location, setLocation] = useState<UserLocation | null>(() => {
		const last = getLastLocation();
		return last && isValidCoordinates(last.lat, last.lon) ? last : null;
	});
	const [fuel, setFuel] = useState<FuelType>(readFuelFromUrl);
	const [radio, setRadio] = useState<number | null>(() =>
		isRadioValue(getLastRadio()) ? getLastRadio() : DEFAULT_RADIO,
	);
	const [orden, setOrden] = useState<OrderBy>(readOrdenFromUrl);
	const [viewport, setViewport] = useState<ViewportBounds | null>(null);
	const [status, setStatus] = useState<Status>('idle');
	const [stations, setStations] = useState<NearbyStation[]>([]);
	const [isRefreshing, setIsRefreshing] = useState(false);
	const [selectedIds, setSelectedIds] = useState<string[]>([]);
	// Tarjeta con las acciones desplegadas (añadir al comparador / ver ficha).
	const [expandedId, setExpandedId] = useState<string | null>(null);
	// Estación resaltada en el mapa desde la lista (independiente del comparador).
	const [focusedId, setFocusedId] = useState<string | null>(null);
	// Aviso cuando un refresco falla pero se conservan resultados previos.
	const [refreshFailed, setRefreshFailed] = useState(false);
	// Filtro de precio: el rango son los extremos del dataset completo (lo
	// consulta el backend) y la selección se aplica en la propia consulta.
	const [priceFilter, setPriceFilter] = useState<PriceRange | null>(null);
	// Marcas seleccionadas para filtrar (vacío = sin filtro).
	const [marcas, setMarcas] = useState<string[]>([]);
	// En móvil el comparador no existe: tocar una tarjeta abre la ficha.
	const isMobile = useMediaQuery(MOBILE_MEDIA_QUERY);
	const requestIdRef = useRef(0);
	const abortRef = useRef<AbortController | null>(null);
	// Refresco en segundo plano: al cambiar una opción la lista actual
	// permanece visible mientras llega la nueva consulta, para que el panel
	// no parpadee. El mensaje de "buscando" solo se muestra si aún no hay
	// resultados que enseñar.
	const hasContentRef = useRef(false);
	// Último estado renderizado: sirve para conservar el mensaje actual
	// (vacío o error) durante un refresco por movimiento del mapa, evitando
	// que el panel parpadee entre el mensaje y el esqueleto.
	const lastStatusRef = useRef<Status>('idle');
	useEffect(() => {
		lastStatusRef.current = status;
	}, [status]);

	useEffect(() => {
		function onFuel(event: Event) {
			const detail = (event as CustomEvent<{ combustible: unknown }>).detail;
			if (detail && isFuelType(detail.combustible)) {
				setFuel(detail.combustible);
			}
		}
		window.addEventListener(FUEL_EVENT, onFuel);
		return () => window.removeEventListener(FUEL_EVENT, onFuel);
	}, []);

	useEffect(() => {
		function onRadio(event: Event) {
			const detail = (event as CustomEvent<{ radio: unknown }>).detail;
			if (detail && isRadioValue(detail.radio)) {
				setRadio(detail.radio);
			}
		}
		window.addEventListener(RADIO_EVENT, onRadio);
		return () => window.removeEventListener(RADIO_EVENT, onRadio);
	}, []);

	useEffect(() => {
		function onOrden(event: Event) {
			const detail = (event as CustomEvent<{ orden: unknown }>).detail;
			if (detail && isOrderBy(detail.orden)) {
				setOrden(detail.orden);
			}
		}
		window.addEventListener(ORDEN_EVENT, onOrden);
		return () => window.removeEventListener(ORDEN_EVENT, onOrden);
	}, []);

	useEffect(() => {
		// El mapa puede emitir el viewport inicial antes de que esta isla se
		// hidrate: se recupera el último valor emitido junto con el listener.
		const last = getLastViewport();
		if (last && isValidBounds(last)) {
			setViewport(last);
		}
		function onViewport(event: Event) {
			const detail = (event as CustomEvent<{ bounds?: ViewportBounds }>).detail;
			const bounds = detail?.bounds;
			if (!bounds || !isValidBounds(bounds)) return;
			setViewport(bounds);
		}
		window.addEventListener(VIEWPORT_EVENT, onViewport);
		return () => window.removeEventListener(VIEWPORT_EVENT, onViewport);
	}, []);

	useEffect(() => {
		function onLocation(event: Event) {
			const detail = (event as CustomEvent<UserLocation>).detail;
			if (detail && isValidCoordinates(detail.lat, detail.lon)) {
				setLocation({ lat: detail.lat, lon: detail.lon, source: detail.source });
			}
		}
		function onLocationClear() {
			setLocation(null);
		}
		window.addEventListener(LOCATION_EVENT, onLocation);
		window.addEventListener(LOCATION_CLEAR_EVENT, onLocationClear);
		return () => {
			window.removeEventListener(LOCATION_EVENT, onLocation);
			window.removeEventListener(LOCATION_CLEAR_EVENT, onLocationClear);
		};
	}, []);

	useEffect(() => {
		function onCompareChange(event: Event) {
			const detail = (event as CustomEvent<{ ids: unknown }>).detail;
			if (!detail || !Array.isArray(detail.ids)) return;
			setSelectedIds(detail.ids.filter((id): id is string => typeof id === 'string'));
		}
		window.addEventListener(COMPARE_EVENT, onCompareChange);
		return () => window.removeEventListener(COMPARE_EVENT, onCompareChange);
	}, []);

	useEffect(() => {
		function onPriceFilter(event: Event) {
			const detail = (event as CustomEvent<{ min: unknown; max: unknown }>).detail;
			if (
				!detail ||
				typeof detail.min !== 'number' ||
				typeof detail.max !== 'number' ||
				detail.max < detail.min
			) {
				return;
			}
			setPriceFilter({ min: detail.min, max: detail.max });
		}
		window.addEventListener(PRICE_FILTER_EVENT, onPriceFilter);
		return () => window.removeEventListener(PRICE_FILTER_EVENT, onPriceFilter);
	}, []);

	useEffect(() => {
		function onMarcas(event: Event) {
			const detail = (event as CustomEvent<{ marcas: unknown }>).detail;
			if (!detail || !Array.isArray(detail.marcas)) return;
			setMarcas(detail.marcas.filter((code): code is string => typeof code === 'string'));
		}
		window.addEventListener(MARCAS_EVENT, onMarcas);
		return () => window.removeEventListener(MARCAS_EVENT, onMarcas);
	}, []);

	const load = useCallback(async () => {
		// Con radio se necesita el punto de referencia; sin él (todas), basta
		// con el área visible del mapa.
		if (radio === null) {
			if (!viewport) return;
		} else if (!location) {
			return;
		}
		const requestId = ++requestIdRef.current;
		abortRef.current?.abort();
		const controller = new AbortController();
		abortRef.current = controller;
		const refreshing = hasContentRef.current;
		const previous = lastStatusRef.current;
		setIsRefreshing(refreshing);
		if (refreshing) {
			// Hay resultados previos: se mantienen visibles mientras se refresca.
			setStatus('success');
		} else if (previous === 'empty' || previous === 'error') {
			// Sin resultados y sin error nuevo: se conserva el mensaje actual
			// mientras llega la consulta (p. ej. al mover el mapa), para que el
			// panel no parpadee con el esqueleto.
			setStatus(previous);
		} else {
			setStatus('loading');
		}
		try {
			// La distancia se mide siempre desde la ubicación marcada (dispositivo
			// o búsqueda); solo si no hay ninguna se usa el centro del mapa como
			// referencia, y mover el mapa nunca cambia el punto de referencia.
			const reference = location
				? { lat: location.lat, lon: location.lon }
				: {
						lat: (viewport!.minLat + viewport!.maxLat) / 2,
						lon: (viewport!.minLon + viewport!.maxLon) / 2,
					};
			const result = await fetchNearbyStations({
				lat: reference.lat,
				lon: reference.lon,
				radio,
				bounds: radio === null ? viewport ?? undefined : undefined,
				combustible: fuel,
				orden,
				limit: NEARBY_LIMIT,
				minPrecio: priceFilter?.min,
				maxPrecio: priceFilter?.max,
				marcas,
			});
			if (requestIdRef.current !== requestId) return;
			setStations(result);
			hasContentRef.current = result.length > 0;
			setIsRefreshing(false);
			setRefreshFailed(false);
			setStatus(result.length === 0 ? 'empty' : 'success');
			updateResultCount(result.length);
			window.dispatchEvent(
				new CustomEvent<{ stations: NearbyStation[] }>(STATIONS_EVENT, {
					detail: { stations: result },
				}),
			);
		} catch {
			if (requestIdRef.current === requestId) {
				// Si ya había resultados se conservan visibles (datos en caché):
				// se avisa de que no se pudieron actualizar.
				if (hasContentRef.current) {
					setIsRefreshing(false);
					setRefreshFailed(true);
				} else {
					setStatus('error');
				}
			}
		}
	}, [location, fuel, radio, orden, viewport, priceFilter, marcas]);

	useEffect(() => {
		// El rango del slider es global (toda la base de datos, todos los
		// combustibles): solo se consulta una vez y no depende del área ni del
		// combustible seleccionado.
		function requestPriceRange() {
			fetchPriceRange()
				.then((range) => {
					const min = range?.min;
					const max = range?.max;
					if (min != null && max != null && Number.isFinite(min) && Number.isFinite(max) && max >= min) {
						dispatchPriceRange({ min, max });
					} else {
						dispatchPriceRange(null);
					}
				})
				.catch(() => dispatchPriceRange(null));
		}
		window.addEventListener(PRICE_RANGE_REQUEST_EVENT, requestPriceRange);
		return () => window.removeEventListener(PRICE_RANGE_REQUEST_EVENT, requestPriceRange);
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

	if (status === 'idle') {
		return (
			<p className="explorer__search-message">
				Cargando el mapa para mostrar las gasolineras…
			</p>
		);
	}

	if (status === 'loading') {
		// Esqueleto de tarjetas mientras llega la primera consulta; decorativo
		// para lectores de pantalla, que reciben el anuncio de búsqueda.
		return (
			<>
				<p className="visually-hidden" role="status">
					Buscando gasolineras…
				</p>
				<ol className="explorer__stations" aria-hidden="true">
					{Array.from({ length: 3 }, (_, index) => (
						<li key={index} className="station-card station-card--skeleton">
							<div className="skeleton-line skeleton-line--title" />
							<div className="skeleton-line skeleton-line--price" />
							<div className="skeleton-line skeleton-line--short" />
						</li>
					))}
				</ol>
			</>
		);
	}

	if (status === 'error') {
		return (
			<div className="explorer__search-error" role="alert">
				<span>No se pudieron cargar las gasolineras. Revisa tu conexión e inténtalo de nuevo.</span>
				<button type="button" className="explorer__location-manual" onClick={() => void load()}>
					Reintentar
				</button>
			</div>
		);
	}

	if (status === 'empty') {
		// Con un filtro de precio activo, el vacío viene del rango elegido.
		if (priceFilter != null) {
			return (
				<p className="explorer__search-message" role="status">
					Ninguna gasolinera en ese rango de precios. Ajusta el rango o cambia el combustible.
				</p>
			);
		}
		return (
			<p className="explorer__search-message" role="status">
				No hay gasolineras con precios de {fuelLabel(fuel)}
				{radio === null
					? '. Prueba a mover el mapa o cambiar el combustible.'
					: ' en este radio. Prueba a ampliar el radio o cambiar el combustible.'}
			</p>
		);
	}

	const capped = radio === null && stations.length >= NEARBY_LIMIT;

	return (
		<>
			{refreshFailed && (
				<p className="explorer__search-message" role="status">
					No se pudo actualizar los precios; se muestran los últimos datos disponibles.
				</p>
			)}
			{capped && (
				<p className="explorer__search-message" role="status">
					Hay más resultados: mostrando las {NEARBY_LIMIT} mejores opciones.
				</p>
			)}
			<ol
				className={[
					'explorer__stations',
					isRefreshing ? 'explorer__stations--refreshing' : '',
				].join(' ')}
				aria-label="Lista de gasolineras cercanas"
				aria-busy={isRefreshing}
			>
			{stations.map((station) => {
				const hasPrice = station.precio != null;
				// Mejor opción: precio válido, reciente y el más bajo del rango
				// (ahorro 0). Un precio caducado, nulo o no positivo nunca se
				// presenta como recomendación.
				const isBest =
					hasPrice &&
					station.precio! > 0 &&
					station.ahorro === 0 &&
					isPriceFresh(station.fechaActualizacion);
				const fecha = formatUpdateDate(station.fechaActualizacion);
				const isSelected = selectedIds.includes(station.id);
				const isExpanded = expandedId === station.id;
				const isFocused = focusedId === station.id;
				const cardClass = [
					'station-card',
					isBest ? 'station-card--featured' : '',
					isSelected ? 'station-card--selected' : '',
					isFocused ? 'station-card--focused' : '',
					isExpanded ? 'station-card--expanded' : '',
				].join(' ');
				const toggleCard = () => {
					if (isMobile) {
						// En móvil no hay comparador: el tap abre la ficha de la
						// estación y la resalta en el mapa.
						dispatchStationFocus(station.id);
						setFocusedId(station.id);
						dispatchStationDetail(station.id);
						return;
					}
					setExpandedId((current) => (current === station.id ? null : station.id));
					setFocusedId((current) => {
						// Resalta en el mapa aunque no esté en el comparador; al
						// deseleccionar, si está en el comparador seguirá resaltada
						// por ese motivo (lo decide el mapa).
						const next = current === station.id ? null : station.id;
						dispatchStationFocus(next);
						return next;
					});
				};
				return (
					<li
						key={station.id}
						className={cardClass}
						onClick={toggleCard}
					>
						<button
							type="button"
							className="station-card__trigger"
							tabIndex={0}
							aria-expanded={isExpanded}
							aria-current={isFocused ? 'true' : undefined}
						>
						<div className="station-card__topline">
							<div>
								{isBest && (
									<span
										className="station-card__tag"
										title="Precio más bajo de los resultados mostrados"
									>
										Mejor opción
									</span>
								)}
								<h3>{station.rotulo}</h3>
							</div>
							<div className="station-card__price">
								{station.precio != null ? (
									<strong>{formatPrice(station.precio)}</strong>
								) : (
									<span className="station-card__price-missing">Precio no disponible</span>
								)}
								<span className={['station-card__fuel', FUEL_CLASS[fuel]].join(' ')}>
									<span className="station-card__fuel-dot" aria-hidden="true" />
									{fuelLabel(fuel)}
								</span>
							</div>
						</div>
						<p className="station-card__address">{station.direccion}</p>
						{station.ahorro != null && station.ahorro > 0 && (
							<p className="station-card__savings">
								Cuesta {formatPrice(station.ahorro)} más que la mejor opción
							</p>
						)}
						<div className="station-card__meta">
							<span>{location != null ? formatDistance(station.distanciaKm) : '—'}</span>
							{fecha && (
								<span
									className={
										hasPrice && !isPriceFresh(station.fechaActualizacion)
											? 'station-card__stale'
											: ''
									}
								>
									Actualizado {fecha}
								</span>
							)}
						</div>
						</button>
						{isExpanded && (
							<div className="station-card__actions">
								<button
									type="button"
									className="station-card__action"
									onClick={(event) => {
										event.stopPropagation();
										dispatchStationSelect(station.id);
									}}
								>
									{isSelected ? 'Quitar del comparador' : 'Añadir al comparador'}
								</button>
								<button
									type="button"
									className="station-card__action station-card__action--primary"
									onClick={(event) => {
										event.stopPropagation();
										dispatchStationDetail(station.id);
									}}
								>
									Ver ficha
								</button>
							</div>
						)}
					</li>
				);
			})}
			</ol>
		</>
	);
}
