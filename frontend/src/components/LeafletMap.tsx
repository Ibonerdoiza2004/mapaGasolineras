import { useCallback, useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import '../styles/leaflet-map.css';

import {
	isValidCoordinates,
	LOCATION_EVENT,
	sortStationsByDistance,
	type UserLocation,
} from '../lib/geolocation';
import { PENINSULA_CENTER } from '../lib/spainBounds';

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
const BOTTOM_MARGIN = 18;
const ZOOM_STEP = 0.5;
const OSM_ATTRIBUTION =
	'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

function configuredTileUrl(): string {
	const url = import.meta.env.PUBLIC_MAP_TILE_URL?.trim();
	return url || DEFAULT_TILE_URL;
}

function buildIcon(L: typeof import('leaflet'), station: MapStation) {
	const label = station.price != null ? station.price.toFixed(2) : station.rotulo ?? station.id;
	return L.divIcon({
		className: `station-marker${station.isBest ? ' station-marker--best' : ''}`,
		html: `<span class="station-marker__pin">${label}</span>`,
		iconSize: [34, 34],
		iconAnchor: [17, 17],
	});
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
	const leafletRef = useRef<typeof import('leaflet') | null>(null);
	const stationsRef = useRef(stations);
	stationsRef.current = stations;
	const pendingLocationRef = useRef<UserLocation | null>(null);
	const [loadError, setLoadError] = useState(false);
	const loadErrorRef = useRef(loadError);
	loadErrorRef.current = loadError;
	const [nearbyStations, setNearbyStations] = useState<MapStation[]>(stations);

	const applyLocation = useCallback((location: UserLocation) => {
		const map = mapRef.current;
		if (!map || loadErrorRef.current) {
			pendingLocationRef.current = location;
			return;
		}
		map.setView([location.lat, location.lon], 15);
		setNearbyStations(sortStationsByDistance(stationsRef.current, location.lat, location.lon));
	}, []);

	useEffect(() => {
		let disposed = false;
		let wheelHandler: ((event: WheelEvent) => void) | null = null;
		let wheelTimer: ReturnType<typeof setTimeout> | undefined;

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
					}
				}
				mapRef.current = map;

				if (pendingLocationRef.current) {
					applyLocation(pendingLocationRef.current);
					pendingLocationRef.current = null;
				}

				for (const station of stations) {
					const marker = L.marker([station.lat, station.lon], {
						icon: buildIcon(L, station),
						title: station.rotulo ?? station.id,
						keyboard: true,
					}).addTo(map);
					if (onSelect) marker.on('click', () => onSelect(station.id));
					markersRef.current.set(station.id, marker);
				}
			} catch (error) {
				console.error('No se pudo inicializar el mapa de Leaflet', error);
				setLoadError(true);
			}
		}

		void init();

		return () => {
			disposed = true;
			clearTimeout(wheelTimer);
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
		window.addEventListener(LOCATION_EVENT, onLocation);
		return () => window.removeEventListener(LOCATION_EVENT, onLocation);
	}, [applyLocation]);

	useEffect(() => {
		const L = leafletRef.current;
		const map = mapRef.current;
		if (!L || !map || loadError) return;

		markersRef.current.forEach((marker) => marker.remove());
		markersRef.current.clear();

		for (const station of nearbyStations) {
			const marker = L.marker([station.lat, station.lon], {
				icon: buildIcon(L, station),
				title: station.rotulo ?? station.id,
				keyboard: true,
			}).addTo(map);
			if (onSelect) marker.on('click', () => onSelect(station.id));
			markersRef.current.set(station.id, marker);
		}
	}, [nearbyStations, loadError, onSelect]);

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
			{nearbyStations.length === 0 && (
				<p className="leaflet-map__empty" role="status">
					No hay estaciones que mostrar en el mapa.
				</p>
			)}
		</div>
	);
}
