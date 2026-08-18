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
import { PENINSULA_CENTER, SPAIN_BOUNDS } from '../lib/spainBounds';

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
const VIEW_PADDING = 16;
const BOTTOM_MARGIN = 28;
const ZOOM_STEP = 0.5;
const VIEWPORT_DEBOUNCE_MS = 250;
/** Margen del área desplazable alrededor de SPAIN_BOUNDS (fracción). */
const MAP_BOUNDS_PADDING = 0.08;
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
				marker.bindPopup(buildStationPopup(station, selectedIds.includes(station.id)));
				marker.on('click', () => {
					onSelect?.(station.id);
				});
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
			marker.bindPopup(buildStationPopup(station, true));
			marker.on('click', () => {
				onSelect?.(station.id);
			});
			markersRef.current.set(station.id, marker);
		}
	}, [nearbyStations, selectedIds, focusedId, onSelect]);

	const renderMarkersRef = useRef(renderMarkers);	renderMarkersRef.current = renderMarkers;

	useEffect(() => {
		let disposed = false;
		let wheelHandler: ((event: WheelEvent) => void) | null = null;
		let wheelTimer: ReturnType<typeof setTimeout> | undefined;
		let viewportTimer: ReturnType<typeof setTimeout> | undefined;

		async function init() {
			const imported = (await import('leaflet')) as
				& { default?: typeof import('leaflet') }
				& typeof import('leaflet');
			const L = imported.default ?? imported;
			if (disposed) return;
			leafletRef.current = L;

			const container = containerRef.current;
			if (!container) return;

			try {
				const map = L.map(container, {
					center,
					zoom,
					zoomControl: false,
					attributionControl: true,
					minZoom: 3,
					maxZoom: 19,
					// Sin límite, arrastrar lateralmente da una vuelta al mundo y
					// el viewport llega con coordenadas inválidas o con regiones
					// sin estaciones (Sao Tomé, Comoras...). El desplazamiento se
					// acota al área de España con un margen: sin él, Leaflet
					// sujeta la vista inicial contra el borde del área y Canarias
					// quedaría cortada. El zoom mínimo (ver más abajo) impide
					// alejarse más allá de los límites.
					maxBounds: L.latLngBounds(SPAIN_BOUNDS).pad(MAP_BOUNDS_PADDING),
					maxBoundsViscosity: 1.0,
zoomSnap: ZOOM_STEP,
				zoomDelta: ZOOM_STEP,
			});
			L.tileLayer(configuredTileUrl(), {
				attribution: OSM_ATTRIBUTION,
				maxZoom: 19,
			}).addTo(map);
			L.control.zoom({ zoomInTitle: 'Acercar mapa', zoomOutTitle: 'Alejar mapa' }).addTo(map);

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
					// paso se ignora y la vista no se mueve.
					if (nextZoom < map.getMinZoom() || nextZoom > map.getMaxZoom()) {
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
					map.fitBounds(bounds, { padding: [VIEW_PADDING, VIEW_PADDING] });

					// fitBounds redondea el zoom y centra el rectángulo, dejando
					// océano bajo Canarias. Si es la altura lo que limita el
					// encuadre, centramos el mapa en la península y elegimos el
					// zoom exacto que deja su borde inferior a BOTTOM_MARGIN px
					// del borde inferior del mapa.
					const size = map.getSize();
					const fittedZoom = map.getZoom();
					const southWest = map.project(bounds[0], fittedZoom);
					const northEast = map.project(bounds[1], fittedZoom);
					const frameWidth = northEast.x - southWest.x;
					const frameHeight = southWest.y - northEast.y;
					if (frameWidth / size.x <= frameHeight / size.y) {
						// La distorsión de Mercator desplaza el centro visual de la
						// península (su punto medio en píxeles está en lat ~41,1º),
						// por eso el mapa se centra en PENINSULA_CENTER y no en el
						// centro del rectángulo.
						const bottomOffset =
							map.project(bounds[0], 0).y - map.project(PENINSULA_CENTER, 0).y;
						const targetZoom = Math.min(
							Math.log2((size.y / 2 - BOTTOM_MARGIN) / bottomOffset),
							map.getMaxZoom(),
						);
						// El zoom exacto (p. ej. 4.84) no cae en la rejilla de
						// zoomSnap; se desactiva el ajuste solo durante esta vista.
						map.options.zoomSnap = 0;
						map.setView(PENINSULA_CENTER, targetZoom, { animate: false });
						map.options.zoomSnap = ZOOM_STEP;
						// El zoom mínimo coincide con la vista inicial de España:
						// no se puede alejar más, de modo que el viewport nunca
						// abarca terreno fuera de los límites. El margen del área
						// permite la vista inicial sin que Leaflet la sujete.
						map.setMinZoom(targetZoom);
					} else {
						map.setMinZoom(fittedZoom);
					}
				}
				mapRef.current = map;

				// El listado muestra las estaciones del área visible: se
				// notifica el viewport al terminar de encuadrar y en cada
				// movimiento del mapa (con debounce para no consultar por
				// cada evento intermedio del arrastre).
				const emitViewport = () => {
					dispatchViewportChange(viewportBounds(map));
				};
				map.on('moveend', () => {
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
					map.panTo([station.lat, station.lon]);
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
			mapRef.current?.invalidateSize();
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
