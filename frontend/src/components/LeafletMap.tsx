import { useCallback, useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import '../styles/leaflet-map.css';

import {
	isValidCoordinates,
	LOCATION_EVENT,
	sortStationsByDistance,
	type UserLocation,
} from '../lib/geolocation';

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
					zoomSnap: 0.25,
					zoomDelta: 0.25,
				});
				L.tileLayer(configuredTileUrl(), {
					attribution: OSM_ATTRIBUTION,
					maxZoom: 19,
				}).addTo(map);
				L.control.zoom({ zoomInTitle: 'Acercar mapa', zoomOutTitle: 'Alejar mapa' }).addTo(map);
				if (bounds) {
					map.fitBounds(bounds, { padding: [VIEW_PADDING, VIEW_PADDING] });

					// fitBounds redondea el zoom y centra el rectángulo, dejando océano
					// bajo Canarias. Si es la altura lo que limita el encuadre, apoyamos
					// su borde inferior en el borde inferior del mapa: Canarias entran
					// justas y la península conserva su centro horizontal.
					const size = map.getSize();
					const fittedZoom = map.getZoom();
					const southWest = map.project(bounds[0], fittedZoom);
					const northEast = map.project(bounds[1], fittedZoom);
					const frameWidth = northEast.x - southWest.x;
					const frameHeight = southWest.y - northEast.y;
					if (frameWidth / size.x <= frameHeight / size.y) {
						// Coordenadas del mundo: centro horizontal del rectángulo y
						// centro vertical desplazado para que su borde inferior quede
						// a VIEW_PADDING px del borde inferior del mapa (la y crece hacia abajo).
						const center = map.unproject(
							[(southWest.x + northEast.x) / 2, southWest.y + VIEW_PADDING - size.y / 2],
							fittedZoom,
						);
						map.setView(center, fittedZoom, { animate: false });
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
