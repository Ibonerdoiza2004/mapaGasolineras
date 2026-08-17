import { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import '../styles/leaflet-map.css';

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
	onSelect?: (id: string) => void;
}

const DEFAULT_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
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
	onSelect,
}: LeafletMapProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const mapRef = useRef<import('leaflet').Map | null>(null);
	const markersRef = useRef<Map<string, import('leaflet').Marker>>(new Map());
	const leafletRef = useRef<typeof import('leaflet') | null>(null);
	const [loadError, setLoadError] = useState(false);

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
				});
				L.tileLayer(configuredTileUrl(), {
					attribution: OSM_ATTRIBUTION,
					maxZoom: 19,
				}).addTo(map);
				L.control.zoom({ zoomInTitle: 'Acercar mapa', zoomOutTitle: 'Alejar mapa' }).addTo(map);
				mapRef.current = map;

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
		const L = leafletRef.current;
		const map = mapRef.current;
		if (!L || !map || loadError) return;

		markersRef.current.forEach((marker) => marker.remove());
		markersRef.current.clear();

		for (const station of stations) {
			const marker = L.marker([station.lat, station.lon], {
				icon: buildIcon(L, station),
				title: station.rotulo ?? station.id,
				keyboard: true,
			}).addTo(map);
			if (onSelect) marker.on('click', () => onSelect(station.id));
			markersRef.current.set(station.id, marker);
		}
	}, [stations, loadError, onSelect]);

	if (loadError) {
		return (
			<ul className="leaflet-map__fallback" aria-label="Lista de gasolineras cercanas">
				{stations.map((station) => (
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
			{stations.length === 0 && (
				<p className="leaflet-map__empty" role="status">
					No hay estaciones que mostrar en el mapa.
				</p>
			)}
		</div>
	);
}
