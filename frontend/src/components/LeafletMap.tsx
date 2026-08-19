import { useCallback, useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import '../styles/leaflet-map.css';

import {
	getLastLocation,
	isValidCoordinates,
	LOCATION_CLEAR_EVENT,
	LOCATION_EVENT,
	sortStationsByDistance,
	type UserLocation,
} from '../lib/geolocation';
import {
	COMPARE_EVENT,
	RADIO_EVENT,
	STATIONS_EVENT,
	STATION_FOCUS_EVENT,
	dispatchStationDetail,
	dispatchStationSelect,
	dispatchViewportChange,
	type ViewportBounds,
} from '../lib/explorerEvents';
import { clusterizeStations } from '../lib/markerCluster';
import type { NearbyStation } from '../lib/stations';
import { isPriceFresh } from '../lib/stations';
import { MOBILE_MEDIA_QUERY, useMediaQuery } from '../lib/useMediaQuery';
import {
	PENINSULA_CENTER,
	PENINSULA_NORTH_LAT,
	SPAIN_BOUNDS,
} from '../lib/spainBounds';

export interface MapStation {
	id: string;
	lat: number;
	lon: number;
	rotulo?: string;
	price?: number;
	isBest?: boolean;
}

export interface LeafletMapProps {
	stations: MapStation[];
	center: [number, number];
	zoom: number;
	bounds?: [[number, number], [number, number]];
	onSelect?: (id: string) => void;
}

const DEFAULT_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const BOTTOM_MARGIN = 28;
/**
 * En escritorio el encuadre inicial ancla Canarias a BOTTOM_MARGIN del borde
 * inferior. Reducir el zoom (INITIAL_ZOOM_PAD) sin mover el anclaje de Canarias
 * deja la península un poco más abajo en la pantalla: España se aleja unos
 * niveles y se asienta hacia el borde inferior. El floor es el zoom mínimo
 * absoluto (MIN_ZOOM_FLOOR) de la instancia, no el encuadre, para que el
 * alejamiento tenga efecto tanto en la vista como en el floor impuesto.
 */
const INITIAL_ZOOM_PAD = 0.4;
/**
 * Umbral a partir del que se considera escritorio para aplicar
 * `INITIAL_ZOOM_PAD`: por debajo (tabletas de ~1024 px, p. ej. iPad
 * horizontal) reduciría el zoom de más y dejaría el mapa demasiado alejado.
 */
const DESKTOP_ZOOM_PAD_MIN_WIDTH = 1280;
/** Zoom mínimo absoluto de la instancia (tope inferior de la que se puede alejar el mapa). */
const MIN_ZOOM_FLOOR = 3;
const ZOOM_STEP = 0.5;
const VIEWPORT_DEBOUNCE_MS = 250;
/** Margen lateral del área desplazable alrededor de SPAIN_BOUNDS (fracción). */
const MAP_BOUNDS_PADDING_WEST = 0.2;
/** El oeste conserva su margen para que Canarias queden a la vista, pero por
 * la derecha un margen amplio (0.2) dejaba océano navegable hasta casi Grecia
 * en todas las pantallas: se reduce al mínimo en escritorio y móvil. */
const MAP_BOUNDS_PADDING_EAST = 0.05;
/**
 * Límite norte (latitud) del área desplazable: justo por encima de la vista
 * inicial de escritorio para que al arrastrar no aparezca demasiado océano
 * sobre la península. Es un valor absoluto porque la vista inicial ya se
 * detiene ~49,4º en las ventanas más altas.
 */
const MAP_NORTH_LAT = 50;
/** Margen vertical inferior según el ancho del viewport (fracción del alto de SPAIN_BOUNDS). */
const MAP_BOTTOM_PAD_NARROW = 0.35;
const MAP_BOTTOM_PAD_TABLET = 0.2;
const MAP_BOTTOM_PAD_WIDE = 0.05;
const NARROW_BREAKPOINT = 768;
const TABLET_BREAKPOINT = 1024;
/** Fracción del ancho del viewport que ocupa el rectángulo en el zoom mínimo. */
const BOX_WIDTH_FIT = 0.97;
/** Tamaño (px) de la celda que agrupa marcadores próximos al nivel de zoom actual. */
const CLUSTER_GRID_SIZE_PX = 80;
const OSM_ATTRIBUTION =
	'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

function configuredTileUrl(): string {
	const url = import.meta.env.PUBLIC_MAP_TILE_URL?.trim();
	return url || DEFAULT_TILE_URL;
}

function viewportBounds(map: import('leaflet').Map): ViewportBounds {
	const bounds = map.getBounds();
	const southWest = bounds.getSouthWest();
	const northEast = bounds.getNorthEast();
	return {
		minLat: southWest.lat,
		maxLat: northEast.lat,
		minLon: southWest.lng,
		maxLon: northEast.lng,
	};
}

function buildIcon(L: typeof import('leaflet'), station: MapStation, selected = false) {
	const label = station.price != null ? station.price.toFixed(2) : station.rotulo ?? station.id;
	const classes = ['station-marker'];
	if (station.isBest) classes.push('station-marker--best');
	if (selected) classes.push('station-marker--selected');
	return L.divIcon({
		className: classes.join(' '),
		html: `<span class="station-marker__pin">${escapeHtml(label)}</span>`,
		iconSize: [40, 38],
		// La punta inferior del pin señala la coordenada exacta de la estación.
		iconAnchor: [20, 38],
	});
}

function escapeHtml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

/** Popup de un marcador: permite añadir al comparador o abrir la ficha. */
function buildStationPopup(station: MapStation, isSelected: boolean): string {
	const compareLabel = isSelected ? 'Quitar del comparador' : 'Añadir al comparador';
	const id = escapeHtml(station.id);
	return [
		`<div class="station-popup">`,
		`<p class="station-popup__title">${escapeHtml(station.rotulo ?? station.id)}</p>`,
		`<button type="button" data-station-id="${id}" data-station-action="compare">${compareLabel}</button>`,
		`<button type="button" class="station-popup__primary" data-station-id="${id}" data-station-action="detail">Ver ficha</button>`,
		`</div>`,
	].join('');
}

function buildClusterIcon(L: typeof import('leaflet'), count: number) {
	return L.divIcon({
		className: 'station-cluster',
		html: `<span class="station-cluster__count">${count}</span>`,
		iconSize: [34, 34],
		iconAnchor: [17, 17],
	});
}

/**
 * Control de zoom propio con `<button>`: el control nativo de Leaflet usa
 * enlaces `<a href="#">`, que el auditor de accesibilidad de Astro marca
 * como enlaces con href inválido.
 */
function createZoomControl(L: typeof import('leaflet'), map: import('leaflet').Map) {
	const ZoomControl = L.Control.extend({
		options: { position: 'topleft' },
		onAdd() {
			const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control zoom-control');
			const zoomIn = L.DomUtil.create('button', 'zoom-control__button', container);
			zoomIn.type = 'button';
			zoomIn.title = 'Acercar mapa';
			zoomIn.setAttribute('aria-label', 'Acercar mapa');
			zoomIn.textContent = '+';
			const zoomOut = L.DomUtil.create(
				'button',
				'zoom-control__button zoom-control__button--bottom',
				container,
			);
			zoomOut.type = 'button';
			zoomOut.title = 'Alejar mapa';
			zoomOut.setAttribute('aria-label', 'Alejar mapa');
			zoomOut.textContent = '−';

			const updateDisabledState = () => {
				const zoom = map.getZoom();
				const minZoom = map.getMinZoom();
				const maxZoom = map.getMaxZoom();
				zoomIn.disabled = zoom >= maxZoom;
				zoomOut.disabled = zoom <= minZoom;
				zoomIn.setAttribute('aria-disabled', String(zoomIn.disabled));
				zoomOut.setAttribute('aria-disabled', String(zoomOut.disabled));
			};
			updateDisabledState();
			map.on('zoomend', updateDisabledState);

			zoomIn.addEventListener('click', (event) => {
				event.preventDefault();
				map.zoomIn();
			});
			zoomOut.addEventListener('click', (event) => {
				event.preventDefault();
				map.zoomOut();
			});

			L.DomEvent.disableClickPropagation(container);
			return container;
		},
	});
	return new ZoomControl();
}

function toMapStation(station: NearbyStation): MapStation | null {
	// Una estación sin coordenadas válidas no debe generar un marcador.
	if (!Number.isFinite(station.latitud) || !Number.isFinite(station.longitud)) {
		return null;
	}
	return {
		id: station.id,
		lat: station.latitud,
		lon: station.longitud,
		rotulo: station.rotulo,
		price: station.precio ?? undefined,
		// Un precio caducado, nulo o no positivo no se marca como mejor opción.
		isBest:
			station.precio != null &&
			station.precio > 0 &&
			station.ahorro === 0 &&
			isPriceFresh(station.fechaActualizacion),
	};
}

/**
 * Mapa interactivo de Leaflet aislado en una isla React.
 * Leaflet se carga de forma dinámica solo en el cliente; el proveedor de
 * teselas se configura con `PUBLIC_MAP_TILE_URL`. Si falla la inicialización
 * se muestra una lista alternativa accesible.
 */
export default function LeafletMap({
	stations,
	center,
	zoom,
	bounds,
	onSelect,
}: LeafletMapProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const mapRef = useRef<import('leaflet').Map | null>(null);
	const markersRef = useRef<Map<string, import('leaflet').Marker>>(new Map());
	const centerMarkerRef = useRef<import('leaflet').Marker | null>(null);
	const centerMarkerSourceRef = useRef<UserLocation['source'] | null>(null);
	const radiusCircleRef = useRef<import('leaflet').Circle | null>(null);
	const leafletRef = useRef<typeof import('leaflet') | null>(null);
	const stationsRef = useRef(stations);
	stationsRef.current = stations;
	const pendingLocationRef = useRef<UserLocation | null>(null);
	const [loadError, setLoadError] = useState(false);
	const loadErrorRef = useRef(loadError);
	loadErrorRef.current = loadError;
	const [nearbyStations, setNearbyStations] = useState<MapStation[]>(stations);
	const [querySettled, setQuerySettled] = useState(false);
	const [reference, setReference] = useState<UserLocation | null>(null);
	const [radio, setRadio] = useState<number | null>(null);
	const [selectedIds, setSelectedIds] = useState<string[]>([]);
	// Estación resaltada desde el listado; puede no estar en el comparador.
	const [focusedId, setFocusedId] = useState<string | null>(null);
	// Indica que el mapa terminó de inicializarse; el marcador de ubicación se
	// redibuja cuando cambia para no perderlo si la ubicación llegó antes.
	const [mapReady, setMapReady] = useState(false);
	// Contador que cambia en cada zoom para re-agrupar los marcadores.
	const [zoomTick, setZoomTick] = useState(0);
	// En móvil el comparador no existe: tocar un pin abre la ficha directamente.
	const isMobile = useMediaQuery(MOBILE_MEDIA_QUERY);

	const applyLocation = useCallback((location: UserLocation) => {
		const map = mapRef.current;
		if (!map || loadErrorRef.current) {
			pendingLocationRef.current = location;
			return;
		}
		map.setView([location.lat, location.lon], 15);
		setReference(location);
		setNearbyStations(sortStationsByDistance(stationsRef.current, location.lat, location.lon));
	}, []);

	// Dibuja los marcadores agrupados por proximidad al zoom actual. Las
	// estaciones añadidas al panel de comparar se pintan siempre como pines
	// individuales resaltados, fuera de su clúster, para que la comparación
	// desde el listado sea visible.
	const renderMarkers = useCallback(() => {
		const L = leafletRef.current;
		const map = mapRef.current;
		if (!L || !map) return;

		markersRef.current.forEach((marker) => marker.remove());
		markersRef.current.clear();

		const zoom = map.getZoom();
		// Resaltadas: las del panel de comparar y, además, la estación en la
		// que el usuario ha hecho clic en el listado aunque no esté en él.
		const selectedSet = new Set([...selectedIds, ...(focusedId ? [focusedId] : [])]);
		const selectedStations = nearbyStations.filter(
			(station) => selectedSet.has(station.id) && Number.isFinite(station.lat) && Number.isFinite(station.lon),
		);
		const rest = selectedStations.length > 0
			? nearbyStations.filter((station) => !selectedSet.has(station.id))
			: nearbyStations;

		const clusters = clusterizeStations(
			rest,
			(latlng, z) => map.project(latlng, z),
			zoom,
			CLUSTER_GRID_SIZE_PX,
		);

		for (const cluster of clusters) {
			if (cluster.count === 1) {
				const station = cluster.items[0];
				const marker = L.marker([station.lat, station.lon], {
					icon: buildIcon(L, station),
					title: station.rotulo ?? station.id,
					keyboard: true,
				}).addTo(map);
				if (isMobile) {
					// Sin comparador ni popups en móvil: el tap abre la ficha.
					marker.on('click', () => {
						dispatchStationDetail(station.id);
					});
				} else {
					marker.bindPopup(buildStationPopup(station, selectedIds.includes(station.id)));
					marker.on('click', () => {
						onSelect?.(station.id);
					});
				}
				markersRef.current.set(station.id, marker);
			} else {
				const marker = L.marker([cluster.lat, cluster.lon], {
					icon: buildClusterIcon(L, cluster.count),
					title: `${cluster.count} gasolineras`,
					keyboard: true,
				}).addTo(map);
				// Un clic (o Intro con el foco) acerca el zoom para expandir el
				// grupo en sus estaciones individuales.
				marker.on('click', () => {
					const next = (map.getZoom() ?? 0) + 1;
					if (next <= map.getMaxZoom()) {
						map.setView([cluster.lat, cluster.lon], next);
					}
				});
				markersRef.current.set(`cluster:${cluster.lat}:${cluster.lon}`, marker);
			}
		}

		for (const station of selectedStations) {
			const marker = L.marker([station.lat, station.lon], {
				icon: buildIcon(L, station, true),
				title: station.rotulo ?? station.id,
				keyboard: true,
				// Por encima de clústeres y demás pines para que el resaltado
				// no quede tapado.
				zIndexOffset: 1000,
			}).addTo(map);
			if (isMobile) {
				marker.on('click', () => {
					dispatchStationDetail(station.id);
				});
			} else {
				marker.bindPopup(buildStationPopup(station, selectedIds.includes(station.id)));
				marker.on('click', () => {
					onSelect?.(station.id);
				});
			}
			markersRef.current.set(station.id, marker);
		}
	}, [nearbyStations, selectedIds, focusedId, onSelect, isMobile]);

	const renderMarkersRef = useRef(renderMarkers);	renderMarkersRef.current = renderMarkers;

	useEffect(() => {
		let disposed = false;
		let wheelHandler: ((event: WheelEvent) => void) | null = null;
		let wheelTimer: ReturnType<typeof setTimeout> | undefined;
		let viewportTimer: ReturnType<typeof setTimeout> | undefined;
		let popupOpen = false;

		async function init() {
			const imported = (await import('leaflet')) as
				& { default?: typeof import('leaflet') }
				& typeof import('leaflet');
			const L = imported.default ?? imported;
			if (disposed) return;
			leafletRef.current = L;

			const container = containerRef.current;
			if (!container) return;

			// Sin límite, arrastrar lateralmente da una vuelta al mundo y el
			// viewport llega con coordenadas inválidas o con regiones sin
			// estaciones (Sao Tomé, Comoras...). El desplazamiento se acota al
			// área de España con un margen: sin él, Leaflet sujeta la vista
			// inicial contra el borde del área y Canarias quedaría cortada. El
			// margen inferior es mayor en móvil (panel inferior) y en tableta
			// (vista inicial centrada más al sur); en escritorio queda poco
			// océano bajo Canarias. El zoom mínimo (ver más abajo) impide
			// alejarse más allá de los límites.
			const [swLat, swLng] = SPAIN_BOUNDS[0];
			const [neLat, neLng] = SPAIN_BOUNDS[1];
			const latSpan = neLat - swLat;
			const lngSpan = neLng - swLng;
			const viewportWidth = window.innerWidth || container.clientWidth;
			const eastPad = MAP_BOUNDS_PADDING_EAST;
			const bottomPad =
				viewportWidth < NARROW_BREAKPOINT
					? MAP_BOTTOM_PAD_NARROW
					: viewportWidth < TABLET_BREAKPOINT
						? MAP_BOTTOM_PAD_TABLET
						: MAP_BOTTOM_PAD_WIDE;

			try {
				const map = L.map(container, {
					center,
					zoom,
					zoomControl: false,
					attributionControl: true,
					minZoom: MIN_ZOOM_FLOOR,
					maxZoom: 19,
					touchZoom: true,
					// El pellizco se frena en el zoom mínimo/máximo en lugar de
					// sobrepasarlos y rebotar al soltar el dedo.
					bounceAtZoomLimits: false,
					maxBounds: L.latLngBounds(
						[swLat - latSpan * bottomPad, swLng - lngSpan * MAP_BOUNDS_PADDING_WEST],
						[MAP_NORTH_LAT, neLng + lngSpan * eastPad],
					),
					maxBoundsViscosity: 1.0,
					zoomSnap: ZOOM_STEP,
					zoomDelta: ZOOM_STEP,
				});
			L.tileLayer(configuredTileUrl(), {
				attribution: OSM_ATTRIBUTION,
				maxZoom: 19,
			}).addTo(map);

			// La rueda nativa de Leaflet acumula el delta del navegador y
			// redondea hacia arriba a la rejilla de zoomSnap, produciendo
			// saltos grandes e irregulares. La sustituimos por pasos fijos de
			// ZOOM_STEP (los mismos que los botones + y -), acumulando el delta
			// en píxeles enteros para que cada "notch" o gesto continuo de
			// trackpad cuente un paso.
			map.scrollWheelZoom.disable();
			const STEP_PX = 100;
			let wheelAccumPx = 0;
			wheelHandler = (event: WheelEvent) => {
				event.preventDefault();
				const px =
					event.deltaY *
					(event.deltaMode === 1 ? 20 : event.deltaMode === 2 ? 400 : 1);
				wheelAccumPx += px;
				clearTimeout(wheelTimer);
				wheelTimer = setTimeout(() => {
					wheelAccumPx = 0;
				}, 120);
				if (Math.abs(wheelAccumPx) >= STEP_PX) {
					// Zoom animado y centrado en el puntero: con `animate: false`
					// las teselas viejas desaparecen al instante y la pantalla
					// parpadea mientras cargan las nuevas. La animación, en
					// cambio, mantiene las teselas escaladas hasta el final.
					// Pero mientras una animación está en curso Leaflet ignora
					// los nuevos zooms (rueda rápida = un solo paso), así que
					// antes de cada paso se finaliza la animación en curso
					// (es lo que hace el manejador nativo con `map._stop()`).
					const point = map.mouseEventToContainerPoint(event);
					const nextZoom = map.getZoom() + (wheelAccumPx > 0 ? -ZOOM_STEP : ZOOM_STEP);
					// Fuera de los límites de zoom (p. ej. rueda hacia atrás con
					// el zoom mínimo) Leaflet frenaría el zoom pero recalcularía
					// el centro del mapa para el zoom pedido: la pantalla se
					// desplazaría aunque el nivel no cambiara. En esos casos el
					// paso se ignora y la vista no se mueve, salvo cuando un paso
					// entero se queda por encima del mínimo (el zoom mínimo no cae
					// en la rejilla): entonces se llega exactamente al mínimo.
					const currentZoom = map.getZoom();
					if (nextZoom > map.getMaxZoom()) {
						wheelAccumPx = 0;
						return;
					}
					if (nextZoom < map.getMinZoom()) {
						if (currentZoom > map.getMinZoom() + 1e-9) {
							const zoomAnimation = map as unknown as {
								_animatingZoom?: boolean;
								_onZoomTransitionEnd?: () => void;
							};
							if (zoomAnimation._animatingZoom) {
								zoomAnimation._onZoomTransitionEnd?.();
							}
							map.setZoomAround(point, map.getMinZoom());
						}
						wheelAccumPx = 0;
						return;
					}
					const zoomAnimation = map as unknown as {
						_animatingZoom?: boolean;
						_onZoomTransitionEnd?: () => void;
					};
					if (zoomAnimation._animatingZoom) {
						zoomAnimation._onZoomTransitionEnd?.();
					}
					map.setZoomAround(point, nextZoom);
					wheelAccumPx -= Math.sign(wheelAccumPx) * STEP_PX;
				}
			};
			container.addEventListener('wheel', wheelHandler, { passive: false });
				if (bounds) {
					// Se calcula proyectando el rectángulo a zoom 0, que no
					// depende del zoom actual.
					const size = map.getSize();
					const boundsSouthWest = map.project(bounds[0], 0);
					const boundsNorthEast = map.project(bounds[1], 0);
					const boundsWidth = boundsNorthEast.x - boundsSouthWest.x;
					const boundsHeight = boundsSouthWest.y - boundsNorthEast.y;
					const paddedFactor = 1 + MAP_BOUNDS_PADDING_WEST + eastPad;
					// El encuadre del rectángulo (el menor de ambos ejes) hace que
					// todo el territorio español quepa en el viewport con un
					// pequeño margen lateral: es la vista inicial de siempre en
					// pantallas estrechas (móvil, tableta). Sin el margen, el
					// rectángulo llenaría el ancho exacto y Canarias rozarían el
					// borde.
					const boxFitWidth = Math.log2((size.x * BOX_WIDTH_FIT) / boundsWidth);
					const boxFitHeight = Math.log2(size.y / boundsHeight);
					// Pero si el viewport fuese más ancho que el área desplazable
					// (maxBounds, España con su margen), el arrastre escaparía
					// lateralmente de los límites y Leaflet no podría sujetarlo;
					// el zoom mínimo no puede ser menor que ese encuadre.
					const paddedFitWidth = Math.log2(size.x / (boundsWidth * paddedFactor));
					const baseMinZoom = Math.min(
						Math.max(
							Math.min(boxFitWidth, boxFitHeight),
							paddedFitWidth,
							map.getMinZoom(),
						),
						map.getMaxZoom(),
					);
					// En móvil se reduce ligeramente el zoom para dejar margen al
					// extremo oriental, incluida Menorca, sin alejar demasiado el mapa.
					const isNarrowViewport = viewportWidth < NARROW_BREAKPOINT;
					// La tableta (entre 768 y 1023 px) muestra España entera al
					// zoom mínimo, sin el anclaje de la península que usaba el
					// encuadre por altura (dejaba la península pegada arriba).
					const isTabletViewport = !isNarrowViewport && viewportWidth < TABLET_BREAKPOINT;
					const minZoom = Math.min(
						baseMinZoom + (isNarrowViewport ? 4*ZOOM_STEP/5 : 0),
						map.getMaxZoom(),
					);
					map.setMinZoom(minZoom);

					// La proporción del rectángulo es constante en cualquier zoom,
					// así que la rama no depende del zoom inicial del mapa: si la
					// altura del viewport es la que limita el encuadre, la vista
					// inicial deja Canarias con un margen inferior; si es la
					// anchura, España se muestra centrada por completo.
					const heightLimited = size.y / size.x <= boundsHeight / boundsWidth;
					if (heightLimited && !isTabletViewport) {
						// fitBounds redondea el zoom y centra el rectángulo,
						// dejando océano bajo Canarias. Centramos el mapa en la
						// península y elegimos el zoom exacto que deja su borde
						// inferior a BOTTOM_MARGIN px del borde inferior del
						// mapa. La distorsión de Mercator desplaza el centro
						// visual de la península (su punto medio en píxeles está
						// en lat ~41,1º), por eso se apunta a PENINSULA_CENTER y
						// no al centro del rectángulo.
						const bottomOffset =
							map.project(bounds[0], 0).y - map.project(PENINSULA_CENTER, 0).y;
						const baseZoom = Math.log2((size.y / 2 - BOTTOM_MARGIN) / bottomOffset);
// El zoom mínimo lo puede fijar la anchura (p. ej. una ventana
					// muy ancha) o la altura; el zoom de la península no debe
					// superar el que encaja la península en la altura del
					// viewport, ni el que encaja el rectángulo en la anchura
					// (con su margen): si España es más ancha que el viewport
					// (tableta en apaisado), se cortan sus extremos y Canarias
					// pierden su isla más occidental.
					const peninsulaSpan =
						map.project(bounds[0], 0).y -
						map.project([PENINSULA_NORTH_LAT, 0], 0).y;
					const peninsulaZoom = Math.log2(size.y / peninsulaSpan);
				// En escritorio la vista inicial encuadra la península (con Canarias
			// ancladas a `BOTTOM_MARGIN` del borde inferior) y se aleja unos niveles
			// con `INITIAL_ZOOM_PAD`: el zoom inicial es algo más bajo que la vista
			// centrada completa y, al mismo tiempo, se impone como el zoom mínimo
			// (`map.setMinZoom(framedZoom)`), de modo que al retrasar no se deje ver
			// más océano del necesario. Como el anclaje recompone `targetCenter`,
			// Canarias conserva su posición en pantalla aunque el zoom cambie.
				const targetZoom = Math.max(
					Math.min(
						baseZoom,
						map.getMaxZoom(),
						peninsulaZoom,
						boxFitWidth,
					),
					minZoom,
				);
			// Se aleja unos niveles (INITIAL_ZOOM_PAD) solo en escritorio ancho:
			// manteniendo Canarias ancladas a BOTTOM_MARGIN (el cálculo del
			// centro no depende del zoom), España se asienta más abajo en la
			// pantalla. En tablets de ~1024 px se omite por si dejara el mapa
			// demasiado alejado. El floor es el zoom mínimo absoluto (MIN_ZOOM_FLOOR)
			// y no el encuadre: el alejamiento baja el floor y la vista.
			const initialPad = viewportWidth >= DESKTOP_ZOOM_PAD_MIN_WIDTH ? INITIAL_ZOOM_PAD : 0;
			const framedZoom = Math.max(targetZoom - initialPad, MIN_ZOOM_FLOOR);
			// El zoom inicial es el mínimo permitido.
			map.setMinZoom(framedZoom);
						const peninsulaPoint = map.project(PENINSULA_CENTER, framedZoom);
						const canaryPoint = map.project(bounds[0], framedZoom);
						const targetCenter = map.unproject(
							[
								peninsulaPoint.x,
								canaryPoint.y - (size.y / 2 - BOTTOM_MARGIN),
							],
							framedZoom,
						);
						// El zoom exacto (p. ej. 4.84) no cae en la rejilla de
						// zoomSnap; se desactiva el ajuste solo durante esta vista.
						map.options.zoomSnap = 0;
					map.setView([targetCenter.lat, targetCenter.lng], framedZoom, { animate: false });
					map.options.zoomSnap = ZOOM_STEP;
					} else if (isNarrowViewport) {
						// En móvil el zoom mínimo subió un paso y el rectángulo ya
						// no cabe en el viewport: la vista inicial ancla su borde
						// oeste (Canarias) en el margen que dejaba la vista centrada
						// anterior y centra el rectángulo verticalmente, de modo
						// que las islas quedan en el mismo sitio que antes.
						const southWestPoint = map.project(bounds[0], minZoom);
						const northEastPoint = map.project(bounds[1], minZoom);
						const westMargin = (size.x * (1 - BOX_WIDTH_FIT)) / 2;
						const anchoredCenter = map.unproject(
							[
								southWestPoint.x + size.x / 2 - westMargin,
								(northEastPoint.y + southWestPoint.y) / 2,
							],
							minZoom,
						);
						map.options.zoomSnap = 0;
						map.setView([anchoredCenter.lat, anchoredCenter.lng], minZoom, { animate: false });
						map.options.zoomSnap = ZOOM_STEP;
					} else {
						// La anchura limita el encuadre: España entera (incluida
						// Canarias) centrada al zoom mínimo.
						const centered = L.latLngBounds(bounds).getCenter();
						map.options.zoomSnap = 0;
						map.setView([centered.lat, centered.lng], minZoom, { animate: false });
						map.options.zoomSnap = ZOOM_STEP;
					}
				}
				createZoomControl(L, map).addTo(map);
				mapRef.current = map;

				// El listado muestra las estaciones del área visible: se
				// notifica el viewport al terminar de encuadrar y en cada
				// movimiento del mapa (con debounce para no consultar por
				// cada evento intermedio del arrastre).
				const emitViewport = () => {
					dispatchViewportChange(viewportBounds(map));
				};
				map.on('popupopen', () => {
					// Leaflet puede hacer auto-pan para que el popup entre en la
					// pantalla. Ese movimiento no debe lanzar una nueva consulta:
					// reconstruir los marcadores durante el auto-pan cerraría el popup.
					popupOpen = true;
				});
				map.on('popupclose', () => {
					popupOpen = false;
					clearTimeout(viewportTimer);
					emitViewport();
				});
				map.on('moveend', () => {
					if (popupOpen) return;
					clearTimeout(viewportTimer);
					viewportTimer = setTimeout(emitViewport, VIEWPORT_DEBOUNCE_MS);
				});
				emitViewport();

			if (pendingLocationRef.current || getLastLocation()) {
				applyLocation(pendingLocationRef.current ?? getLastLocation()!);
				pendingLocationRef.current = null;
			}

			// El nivel de zoom decide la agrupación de marcadores: cada cambio
			// re-dibuja los pines para fundir o separar los grupos.
			map.on('zoomend', () => setZoomTick((tick) => tick + 1));

		// El pellizco con dos dedos desplaza el centro fuera del área
		// desplazable y Leaflet lo devuelve al soltar el gesto. Se clama el
		// centro en cada movimiento para que la vista no salga de los
		// límites ni un instante; si ya está dentro, no hace nada.
		// Además se actualiza el centro interno del gesto
		// (`touchZoom._center`): al soltar, Leaflet anima hacia él y, si siguiera
		// fuera de los límites, el mapa saltaría brevemente y recuperaría el
		// posición con el `panTo` del siguiente `move`, produciendo el efecto de
		// "sale fuera y vuelve". Manteniéndolo clampeado, la animación de
		// liberación ya apunta al centro válido.
		const limitCenterDuringGesture = () => {
			if (!map.options.maxBounds) return;
			const internal = map as unknown as {
				_limitCenter: (
					center: import('leaflet').LatLng,
					zoom: number,
					bounds: import('leaflet').LatLngBounds,
				) => import('leaflet').LatLng;
			};
			const touchZoom = map.touchZoom as unknown as { _center?: import('leaflet').LatLng } | undefined;
			const center = map.getCenter();
			const limited = internal._limitCenter(
				center,
				map.getZoom(),
				map.options.maxBounds as import('leaflet').LatLngBounds,
			);
			if (limited.lat !== center.lat || limited.lng !== center.lng) {
				if (touchZoom) touchZoom._center = limited;
				map.panTo(limited, { animate: false });
			}
		};
		map.on('move', limitCenterDuringGesture);
		map.on('zoom', limitCenterDuringGesture);

		// Al soltar el pellizco, Leaflet anima hacia el centro que el gesto
		// registró internamente (`touchZoom._center`), que no se acota con
		// maxBounds: el mapa saltaría brevemente fuera de los límites y solo el
		// siguiente `move` lo devolvería. Como `_onTouchEnd` se registra (sobre
		// `document`) en el primer `touchstart`, el parche debe aplicarse aquí,
		// antes de cualquier toque. Se clama el centro del gesto al límite antes
		// de ejecutar el original, de modo que la animación de liberación apunte
		// al centro válido y no rebote.
		const touchZoomHandler = map.touchZoom as unknown as {
			_center?: import('leaflet').LatLng;
			_onTouchEnd?: () => void;
		} | null;
		if (touchZoomHandler && typeof touchZoomHandler._onTouchEnd === 'function') {
			const originalOnTouchEnd = touchZoomHandler._onTouchEnd;
			touchZoomHandler._onTouchEnd = function () {
				const internal = map as unknown as {
					_limitCenter: (
						center: import('leaflet').LatLng,
						zoom: number,
						bounds: import('leaflet').LatLngBounds,
					) => import('leaflet').LatLng;
				};
				if (
					this._center &&
					map.options.maxBounds &&
					internal._limitCenter
				) {
					this._center = internal._limitCenter(
						this._center,
						map.getZoom(),
						map.options.maxBounds as import('leaflet').LatLngBounds,
					);
				}
				originalOnTouchEnd.call(this);
			};
		}

			renderMarkersRef.current();
			setMapReady(true);
		} catch (error) {
				console.error('No se pudo inicializar el mapa de Leaflet', error);
				setLoadError(true);
			}
		}

		void init();

		return () => {
			disposed = true;
			clearTimeout(wheelTimer);
			clearTimeout(viewportTimer);
			if (wheelHandler && containerRef.current) {
				containerRef.current.removeEventListener('wheel', wheelHandler);
			}
			mapRef.current?.remove();
			mapRef.current = null;
			markersRef.current.clear();
		};
	}, []);

	useEffect(() => {
		function onLocation(event: Event) {
			const location = (event as CustomEvent<UserLocation>).detail;
			if (!location || !isValidCoordinates(location.lat, location.lon)) return;
			applyLocation(location);
		}
		function onLocationClear() {
			pendingLocationRef.current = null;
			setReference(null);
		}
		window.addEventListener(LOCATION_EVENT, onLocation);
		window.addEventListener(LOCATION_CLEAR_EVENT, onLocationClear);
		return () => {
			window.removeEventListener(LOCATION_EVENT, onLocation);
			window.removeEventListener(LOCATION_CLEAR_EVENT, onLocationClear);
		};
	}, [applyLocation]);

	useEffect(() => {
		function onRadio(event: Event) {
			const detail = (event as CustomEvent<{ radio: unknown }>).detail;
			if (!detail || !(detail.radio === null || typeof detail.radio === 'number')) return;
			setRadio(detail.radio);
		}
		window.addEventListener(RADIO_EVENT, onRadio);
		return () => window.removeEventListener(RADIO_EVENT, onRadio);
	}, []);

	useEffect(() => {
		function onStations(event: Event) {
			const detail = (event as CustomEvent<{ stations?: unknown }>).detail;
			if (!detail || !Array.isArray(detail.stations)) return;
			const mapped = detail.stations
				.map(toMapStation)
				.filter((station): station is MapStation => station !== null);
			stationsRef.current = mapped;
			setNearbyStations(mapped);
			setQuerySettled(true);
		}
		window.addEventListener(STATIONS_EVENT, onStations);
		return () => window.removeEventListener(STATIONS_EVENT, onStations);
	}, []);

	useEffect(() => {
		function onCompareChange(event: Event) {
			const detail = (event as CustomEvent<{ ids: unknown; added: unknown }>).detail;
			if (!detail || !Array.isArray(detail.ids)) return;
			setSelectedIds(detail.ids.filter((id): id is string => typeof id === 'string'));
			// Al añadir una estación desde el listado, el mapa se desplaza
			// hasta ella para que el resaltado quede a la vista.
			if (typeof detail.added === 'string') {
				const map = mapRef.current;
				const station = nearbyStations.find((candidate) => candidate.id === detail.added);
				if (map && station) {
					// El comparador reduce el ancho del mapa. En el zoom mínimo,
					// combinar ese cambio de tamaño con una animación de pan y
					// maxBounds puede dejar a Leaflet en un estado intermedio y
					// bloquear los gestos hasta que el comparador desaparece.
					map.panTo([station.lat, station.lon], { animate: false });
				}
			}
		}
		window.addEventListener(COMPARE_EVENT, onCompareChange);
		return () => window.removeEventListener(COMPARE_EVENT, onCompareChange);
	}, [nearbyStations]);

	useEffect(() => {
		function onFocus(event: Event) {
			const detail = (event as CustomEvent<{ id: unknown }>).detail;
			if (!detail || (detail.id !== null && typeof detail.id !== 'string')) return;
			setFocusedId(detail.id);
			if (detail.id !== null) {
				const map = mapRef.current;
				const station = nearbyStations.find((candidate) => candidate.id === detail.id);
				if (map && station) {
					map.panTo([station.lat, station.lon]);
				}
			}
		}
		window.addEventListener(STATION_FOCUS_EVENT, onFocus);
		return () => window.removeEventListener(STATION_FOCUS_EVENT, onFocus);
	}, [nearbyStations]);

	// Cuando cambia el tamaño del contenedor (el panel de comparar aparece o
	// el panel lateral se pliega), Leaflet debe recalcular el área visible.
	useEffect(() => {
		const container = containerRef.current;
		if (!container || typeof ResizeObserver === 'undefined') return;
		const observer = new ResizeObserver(() => {
			// El ancho cambia al montar/desmontar el comparador. No dejes que
			// invalidateSize haga además un pan automático: en el zoom mínimo
			// puede entrar en conflicto con maxBounds y con el pan de selección.
			mapRef.current?.invalidateSize({ pan: false, debounceMoveend: true });
		});
		observer.observe(container);
		return () => observer.disconnect();
	}, []);


	useEffect(() => {
		const L = leafletRef.current;
		const map = mapRef.current;
		if (!L || !map || loadError || !mapReady) return;

		if (!reference) {
			centerMarkerRef.current?.remove();
			centerMarkerRef.current = null;
			centerMarkerSourceRef.current = null;
			radiusCircleRef.current?.remove();
			radiusCircleRef.current = null;
			return;
		}

		const marker = centerMarkerRef.current;
		if (marker && centerMarkerSourceRef.current === reference.source) {
			marker.setLatLng([reference.lat, reference.lon]);
		} else {			centerMarkerRef.current?.remove();
			const isDevice = reference.source === 'device';
			const icon = L.divIcon({
				className: isDevice
					? 'location-marker location-marker--device'
					: 'location-marker',
				html: `<span class="location-marker__glyph" aria-hidden="true"></span>`,
				iconSize: [26, 26],
				iconAnchor: [13, 13],
			});
			centerMarkerRef.current = L.marker([reference.lat, reference.lon], {
				icon,
				interactive: false,
				keyboard: false,
			}).addTo(map);
			centerMarkerSourceRef.current = reference.source;
		}

		if (radio === null) {
			radiusCircleRef.current?.remove();
			radiusCircleRef.current = null;
		} else {
			const circle = radiusCircleRef.current;
			if (circle) {
				circle.setLatLng([reference.lat, reference.lon]);
				circle.setRadius(radio * 1000);
			} else {
				radiusCircleRef.current = L.circle([reference.lat, reference.lon], {
					radius: radio * 1000,
					className: 'radius-circle',
					interactive: false,
				}).addTo(map);
			}
		}
	}, [reference, radio, loadError, mapReady]);

	useEffect(() => {
		if (loadError) return;
		renderMarkers();
	}, [renderMarkers, loadError, zoomTick]);

	// Los botones de los popups de Leaflet viven en el DOM del mapa; se
	// delegan los clics aquí para no depender de re-renderizados de la isla.
	useEffect(() => {
		if (!mapReady) return;
		const container = containerRef.current;
		if (!container) return;
		function onPopupClick(event: MouseEvent) {
			const target = event.target as HTMLElement | null;
			const button = target?.closest?.('[data-station-action]') as HTMLElement | null;
			if (!button) return;
			const id = button.getAttribute('data-station-id');
			const action = button.getAttribute('data-station-action');
			if (!id) return;
			if (action === 'compare') dispatchStationSelect(id);
			if (action === 'detail') dispatchStationDetail(id);
		}
		container.addEventListener('click', onPopupClick);
		return () => container.removeEventListener('click', onPopupClick);
	}, [mapReady]);

	if (loadError) {
		return (
			<ul className="leaflet-map__fallback" aria-label="Lista de gasolineras cercanas">
				{nearbyStations.map((station) => (
					<li key={station.id}>
						<button type="button" onClick={() => onSelect?.(station.id)}>
							{station.rotulo ?? station.id}
						</button>
					</li>
				))}
			</ul>
		);
	}

	return (
		<div className="leaflet-map" role="region" aria-label="Mapa de gasolineras cercanas">
			<div ref={containerRef} className="leaflet-map__container" />
			{querySettled && nearbyStations.length === 0 && (
				<p className="leaflet-map__empty">No hay estaciones que mostrar en el mapa.</p>
			)}
		</div>
	);
}
