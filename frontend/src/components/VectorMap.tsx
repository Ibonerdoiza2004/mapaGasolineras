import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';
import mapLibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import '../styles/vector-map.css';

import {
	getLastLocation,
	distanceKm,
	isValidCoordinates,
	LOCATION_CLEAR_EVENT,
	LOCATION_EVENT,
	type UserLocation,
} from '../lib/geolocation';
import {
	COMPARE_EVENT,
	FUEL_EVENT,
	getLastNearbyStations,
	getLastMapStations,
	getLastRadio,
	MAP_STATIONS_EVENT,
	MARCAS_EVENT,
	PRICE_FILTER_EVENT,
	RADIO_EVENT,
	STATIONS_EVENT,
	STATION_FOCUS_EVENT,
	dispatchStationDetail,
	dispatchStationSelect,
	dispatchViewportChange,
	dispatchMapStations,
	invalidateMapStations,
	type PriceRange,
} from '../lib/explorerEvents';
import {
	createVectorStyle,
	MAP_DISPLAY_MAX_ZOOM,
	MAP_MIN_ZOOM,
	navigationBoundsForWidth,
	readVectorMapConfig,
} from '../lib/mapConfig';
import { DEFAULT_FUEL, isFuelType, type FuelType } from '../lib/fuel';
import type { MapStationSummary, NearbyStation } from '../lib/stations';
import { fetchMapStations, isPriceFresh } from '../lib/stations';
import { getUrlParam } from '../lib/urlState';
import { MOBILE_MEDIA_QUERY, useMediaQuery } from '../lib/useMediaQuery';

import type { GeoJSONSource, LayerSpecification, Map as MapLibreMap, Marker as MapLibreMarker, Popup as MapLibrePopup } from 'maplibre-gl';

export interface MapStation {
	id: string;
	lat: number;
	lon: number;
	rotulo?: string;
	price?: number;
	isBest?: boolean;
}

export interface VectorMapProps {
	stations: MapStation[];
	center: [number, number];
	zoom: number;
	bounds?: [[number, number], [number, number]];
	onSelect?: (id: string) => void;
}

const VIEWPORT_DEBOUNCE_MS = 250;
const ZOOM_STEP = 0.5;
const STATION_SOURCE_ID = 'nearby-stations';
const STATION_CLUSTER_LAYER_ID = 'station-clusters';
const STATION_CLUSTER_COUNT_LAYER_ID = 'station-cluster-count';
const STATION_POINT_LAYER_ID = 'station-points';
const STATION_PRICE_LAYER_ID = 'station-price';
const MAP_FALLBACK_LIMIT = 50;
const STATION_CLUSTER_MAX_ZOOM = 9;
const STATION_ICON_DEFAULT = 'station-price-default';
const STATION_ICON_BEST = 'station-price-best';
const STATION_ICON_SELECTED = 'station-price-selected';
const STATION_ICON_CLUSTER = 'station-cluster-badge';
const SEARCH_RADIUS_SOURCE_ID = 'search-radius';
const SEARCH_RADIUS_CASING_LAYER_ID = 'search-radius-casing';
const SEARCH_RADIUS_OUTLINE_LAYER_ID = 'search-radius-outline';
const DEFAULT_ACTIVE_RADIUS_KM = 10;
const ICON_SCALE = 2;

type IconColor = readonly [number, number, number, number];
interface NativeIcon {
	width: number;
	height: number;
	data: Uint8Array;
}

function fuelFromUrl(): FuelType {
	const value = getUrlParam('combustible');
	return isFuelType(value) ? value : DEFAULT_FUEL;
}

function brandsFromUrl(): string[] {
	return (getUrlParam('marcas') ?? '')
		.split(',')
		.map((value) => value.trim())
		.filter(Boolean);
}

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
	return left.length === right.length && left.every((value, index) => value === right[index]);
}

interface StationFeatureProperties {
	id: string;
	label: string;
	priceLabel: string;
	priceKey: string;
	isBest: boolean;
	selected: boolean;
	sortKey: number;
}

type MapStationInput = Pick<NearbyStation, 'id' | 'rotulo' | 'latitud' | 'longitud' | 'precio'> &
	Partial<Pick<NearbyStation, 'ahorro' | 'fechaActualizacion'>> &
	Partial<Pick<MapStationSummary, 'mejorOpcion'>>;

export function toMapStation(station: MapStationInput): MapStation | null {
	if (
		!Number.isFinite(station.latitud) ||
		!Number.isFinite(station.longitud) ||
		station.latitud < -90 ||
		station.latitud > 90 ||
		station.longitud < -180 ||
		station.longitud > 180
	) return null;
	return {
		id: station.id,
		lat: station.latitud,
		lon: station.longitud,
		rotulo: station.rotulo,
		price: station.precio ?? undefined,
		isBest: (station.mejorOpcion === true && isPriceFresh(station.fechaActualizacion)) || (
			station.precio != null &&
			station.precio > 0 &&
			station.ahorro === 0 &&
			isPriceFresh(station.fechaActualizacion)
		),
	};
}

/** Aproximación circular suficiente para dibujar el radio, nunca para calcular resultados. */
export function radiusPolygon(location: UserLocation, radiusKm: number): GeoJSON.Feature<GeoJSON.Polygon> {
	if (!isValidCoordinates(location.lat, location.lon) || !Number.isFinite(radiusKm) || radiusKm <= 0 || radiusKm > 50) {
		throw new RangeError('El radio del mapa debe estar entre 0 y 50 km');
	}
	const points = 72;
	const latRadius = radiusKm / 111.32;
	const lonRadius = radiusKm / (111.32 * Math.max(Math.cos((location.lat * Math.PI) / 180), 0.1));
	const ring: [number, number][] = [];
	for (let index = 0; index <= points; index += 1) {
		const angle = (index / points) * Math.PI * 2;
		ring.push([
			location.lon + Math.cos(angle) * lonRadius,
			location.lat + Math.sin(angle) * latRadius,
		]);
	}
	return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } };
}

export function radiusZoom(
	radiusKm: number,
	latitude = 40,
	viewportSize = 360,
	minZoom = MAP_MIN_ZOOM,
): number {
	if (!Number.isFinite(radiusKm) || radiusKm <= 0 || radiusKm > 50) {
		throw new RangeError('El radio del mapa debe estar entre 0 y 50 km');
	}
	if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
		throw new RangeError('La latitud del radio debe ser válida');
	}
	const safeViewport = Number.isFinite(viewportSize) && viewportSize > 0 ? viewportSize : 360;
	// Aprovecha más mapa en escritorio sin cortar el círculo y conserva margen
	// suficiente para los controles en pantallas pequeñas.
	const targetDiameter = Math.max(220, Math.min(520, safeViewport - 96));
	const latitudeScale = Math.max(Math.cos((latitude * Math.PI) / 180), 0.1);
	const calculated = Math.log2((targetDiameter * 156543.03392 * latitudeScale) / (radiusKm * 2_000));
	return Math.max(minZoom, Math.min(15, calculated));
}

function mapViewportSize(map: MapLibreMap): number {
	const canvas = map.getCanvas();
	return Math.min(canvas.clientWidth || 360, canvas.clientHeight || 360);
}

function popupContent(station: MapStation, selected: boolean): HTMLDivElement {
	const root = document.createElement('div');
	root.className = 'station-popup';
	const title = document.createElement('p');
	title.className = 'station-popup__title';
	title.textContent = station.rotulo ?? station.id;
	root.append(title);
	for (const [action, label] of [
		['compare', selected ? 'Quitar del comparador' : 'Añadir al comparador'],
		['detail', 'Ver ficha'],
	] as const) {
		const button = document.createElement('button');
		button.type = 'button';
		button.dataset.stationAction = action;
		button.dataset.stationId = station.id;
		button.textContent = label;
		if (action === 'detail') button.className = 'station-popup__primary';
		root.append(button);
	}
	return root;
}

export function stationFeatureCollection(
	stations: readonly MapStation[],
	selectedIds: ReadonlySet<string> = new Set(),
): GeoJSON.FeatureCollection<GeoJSON.Point, StationFeatureProperties> {
	return {
		type: 'FeatureCollection',
		features: stations.map((station) => ({
			type: 'Feature',
			geometry: { type: 'Point', coordinates: [station.lon, station.lat] },
			properties: {
				id: station.id,
				label: station.rotulo ?? station.id,
				priceLabel: station.price == null ? '—' : station.price.toFixed(2).replace('.', ','),
				priceKey: station.price == null ? 'na' : String(Math.round(station.price * 100)),
				isBest: station.isBest === true,
				selected: selectedIds.has(station.id),
				// Los valores altos se dibujan después: barato sobre caro y sin precio al fondo.
				sortKey: station.price == null
					? -1_000_000
					: 10_000 - Math.round(station.price * 100) + (90 - station.lat) / 1_000,
			},
		})),
	};
}

function stationLayerColors() {
	return {
		brand: '#155978',
		success: '#0d7d56',
		surface: '#ffffff',
	};
}

function createIcon(width: number, height: number): NativeIcon {
	return { width, height, data: new Uint8Array(width * height * 4) };
}

function paintPixel(icon: NativeIcon, x: number, y: number, color: IconColor) {
	if (x < 0 || y < 0 || x >= icon.width || y >= icon.height) return;
	const offset = (y * icon.width + x) * 4;
	icon.data.set(color, offset);
}

function isInsideRoundedRect(x: number, y: number, left: number, top: number, right: number, bottom: number, radius: number) {
	if (x >= left + radius && x < right - radius) return y >= top && y < bottom;
	if (y >= top + radius && y < bottom - radius) return x >= left && x < right;
	const centerX = x < left + radius ? left + radius : right - radius - 1;
	const centerY = y < top + radius ? top + radius : bottom - radius - 1;
	return (x - centerX) ** 2 + (y - centerY) ** 2 <= radius ** 2;
}

function paintRoundedRect(icon: NativeIcon, left: number, top: number, right: number, bottom: number, radius: number, color: IconColor) {
	for (let y = top; y < bottom; y += 1) {
		for (let x = left; x < right; x += 1) {
			if (isInsideRoundedRect(x, y, left, top, right, bottom, radius)) paintPixel(icon, x, y, color);
		}
	}
}

function paintStationBadge(accent: IconColor): NativeIcon {
	const icon = createIcon(46 * ICON_SCALE, 32 * ICON_SCALE);
	const body: IconColor = [255, 255, 255, 255];
	const shadow: IconColor = [16, 61, 83, 55];
	paintRoundedRect(icon, 3 * ICON_SCALE, 4 * ICON_SCALE, 45 * ICON_SCALE, 32 * ICON_SCALE, 9 * ICON_SCALE, shadow);
	paintRoundedRect(icon, 1 * ICON_SCALE, 1 * ICON_SCALE, 44 * ICON_SCALE, 30 * ICON_SCALE, 9 * ICON_SCALE, accent);
	paintRoundedRect(icon, 3 * ICON_SCALE, 3 * ICON_SCALE, 42 * ICON_SCALE, 28 * ICON_SCALE, 7 * ICON_SCALE, body);
	return icon;
}

function paintClusterBadge(): NativeIcon {
	const icon = createIcon(46 * ICON_SCALE, 38 * ICON_SCALE);
	const body: IconColor = [20, 89, 120, 255];
	const back: IconColor = [177, 207, 219, 255];
	const shadow: IconColor = [16, 61, 83, 45];
	paintRoundedRect(icon, 7 * ICON_SCALE, 8 * ICON_SCALE, 45 * ICON_SCALE, 37 * ICON_SCALE, 7 * ICON_SCALE, shadow);
	paintRoundedRect(icon, 5 * ICON_SCALE, 5 * ICON_SCALE, 43 * ICON_SCALE, 34 * ICON_SCALE, 7 * ICON_SCALE, back);
	paintRoundedRect(icon, 1 * ICON_SCALE, 1 * ICON_SCALE, 39 * ICON_SCALE, 30 * ICON_SCALE, 7 * ICON_SCALE, body);
	return icon;
}

/** Iconos rasterizados una vez y renderizados como símbolos WebGL, no DOM. */
function ensureStationIcons(map: MapLibreMap) {
	if (!map.hasImage(STATION_ICON_CLUSTER)) {
		map.addImage(STATION_ICON_CLUSTER, paintClusterBadge(), { pixelRatio: ICON_SCALE });
	}
}

function paintPriceText(icon: NativeIcon, label: string, color: string): NativeIcon {
	if (typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes('jsdom')) return icon;
	const canvas = document.createElement('canvas');
	canvas.width = icon.width;
	canvas.height = icon.height;
	const context = canvas.getContext('2d');
	if (!context) return icon;
	const imageData = context.createImageData(icon.width, icon.height);
	imageData.data.set(icon.data);
	context.putImageData(imageData, 0, 0);
	context.fillStyle = color;
	context.font = `600 ${14 * ICON_SCALE}px Inter, system-ui, sans-serif`;
	context.textAlign = 'center';
	context.textBaseline = 'middle';
	context.fillText(label, 22.5 * ICON_SCALE, 15 * ICON_SCALE);
	return { width: icon.width, height: icon.height, data: new Uint8Array(context.getImageData(0, 0, icon.width, icon.height).data) };
}

function ensurePriceIcons(
	map: MapLibreMap,
	data: GeoJSON.FeatureCollection<GeoJSON.Point, StationFeatureProperties>,
) {
	const prices = new Map<string, string>();
	for (const feature of data.features) prices.set(feature.properties.priceKey, feature.properties.priceLabel);
	for (const [key, label] of prices) {
		for (const [prefix, accent] of [
			[STATION_ICON_DEFAULT, [20, 89, 120, 255]],
			[STATION_ICON_BEST, [13, 125, 86, 255]],
			[STATION_ICON_SELECTED, [8, 55, 84, 255]],
		] as const) {
			const id = `${prefix}-${key}`;
			if (!map.hasImage(id)) {
				map.addImage(id, paintPriceText(paintStationBadge(accent), label, '#155978'), { pixelRatio: ICON_SCALE });
			}
		}
	}
}

/**
 * Delega agrupación, animación y dibujo al worker/WebGL de MapLibre. Así un
 * zoom no elimina ni reconstruye cientos de nodos HTML en el hilo principal.
 */
function installStationLayers(map: MapLibreMap, data: GeoJSON.FeatureCollection<GeoJSON.Point, StationFeatureProperties>) {
	ensureStationIcons(map);
	ensurePriceIcons(map, data);
	const existing = map.getSource(STATION_SOURCE_ID) as GeoJSONSource | undefined;
	if (existing) {
		existing.setData(data);
		return;
	}
	const colors = stationLayerColors();
	map.addSource(STATION_SOURCE_ID, {
		type: 'geojson',
		data,
		cluster: true,
		clusterMaxZoom: STATION_CLUSTER_MAX_ZOOM,
		clusterRadius: 35,
	});
	map.addLayer({
		id: STATION_CLUSTER_LAYER_ID,
		type: 'symbol',
		source: STATION_SOURCE_ID,
		filter: ['has', 'point_count'],
		layout: {
			'icon-image': STATION_ICON_CLUSTER,
			'icon-size': ['step', ['get', 'point_count'], 0.78, 10, 0.86, 100, 0.94],
			'icon-allow-overlap': true,
			'icon-ignore-placement': true,
		},
	});
	map.addLayer({
		id: STATION_CLUSTER_COUNT_LAYER_ID,
		type: 'symbol',
		source: STATION_SOURCE_ID,
		filter: ['has', 'point_count'],
		layout: {
			'text-field': ['get', 'point_count_abbreviated'],
			'text-size': 12,
			'text-offset': [-0.2, -0.18],
			'text-allow-overlap': true,
			'text-ignore-placement': true,
		},
		paint: { 'text-color': '#ffffff' },
	});
	map.addLayer({
		id: STATION_POINT_LAYER_ID,
		type: 'circle',
		source: STATION_SOURCE_ID,
		filter: ['!', ['has', 'point_count']],
		paint: {
			'circle-color': ['case', ['==', ['get', 'isBest'], true], colors.success, colors.brand],
			'circle-radius': ['interpolate', ['linear'], ['zoom'], 9, 3.5, 12, 5],
			'circle-stroke-color': colors.surface,
			'circle-stroke-width': ['case', ['==', ['get', 'selected'], true], 3, 1.5],
		},
	});
	const priceLayer: LayerSpecification = {
		id: STATION_PRICE_LAYER_ID,
		type: 'symbol',
		source: STATION_SOURCE_ID,
		filter: ['!', ['has', 'point_count']],
		layout: {
			'icon-image': ['case',
				['==', ['get', 'selected'], true], ['concat', `${STATION_ICON_SELECTED}-`, ['get', 'priceKey']],
				['==', ['get', 'isBest'], true], ['concat', `${STATION_ICON_BEST}-`, ['get', 'priceKey']],
				['concat', `${STATION_ICON_DEFAULT}-`, ['get', 'priceKey']],
			],
			'icon-size': ['interpolate', ['linear'], ['zoom'], 9, 0.72, 12, 0.9],
			'icon-anchor': 'center',
			'icon-allow-overlap': true,
			'icon-ignore-placement': true,
			'symbol-sort-key': ['+', ['get', 'sortKey'], ['case', ['==', ['get', 'selected'], true], 1_000_000, 0]],
		},
	};
	map.addLayer(priceLayer);
}

/**
 * Mapa vectorial local. MapLibre dibuja texto y geometría a la resolución real
 * del dispositivo y evita conversiones de imagen durante cada petición.
 */
export default function VectorMap({ stations, center, zoom, bounds, onSelect }: VectorMapProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const mapRef = useRef<MapLibreMap | null>(null);
	const maplibreRef = useRef<typeof import('maplibre-gl') | null>(null);
	const locationMarkerRef = useRef<MapLibreMarker | null>(null);
	const popupRef = useRef<MapLibrePopup | null>(null);
	const popupStationIdRef = useRef<string | null>(null);
	const stationsRef = useRef(stations);
	const hasCompleteDatasetRef = useRef(false);
	const selectedIdsRef = useRef<string[]>([]);
	const focusedIdRef = useRef<string | null>(null);
	const isMobileRef = useRef(false);
	const onSelectRef = useRef(onSelect);
	const pendingLocationRef = useRef<UserLocation | null>(null);
	const drawReferenceRef = useRef<(() => void) | null>(null);
	const styleReadyRef = useRef(false);
	const initialLocation = getLastLocation();
	const initialRadio = getLastRadio() ?? (initialLocation ? DEFAULT_ACTIVE_RADIUS_KM : null);
	const referenceRef = useRef<UserLocation | null>(initialLocation);
	const radioRef = useRef<number | null>(initialRadio);
	const [mapStations, setMapStations] = useState(stations);
	const [nearbyResultStations, setNearbyResultStations] = useState<MapStation[] | null>(null);
	const [querySettled, setQuerySettled] = useState(false);
	const [reference, setReference] = useState<UserLocation | null>(initialLocation);
	const [radio, setRadio] = useState<number | null>(initialRadio);
	const [mapFuel, setMapFuel] = useState<FuelType>(DEFAULT_FUEL);
	const [mapPriceFilter, setMapPriceFilter] = useState<PriceRange | null>(null);
	const [mapBrands, setMapBrands] = useState<string[]>([]);
	const [mapFiltersReady, setMapFiltersReady] = useState(false);
	const [selectedIds, setSelectedIds] = useState<string[]>([]);
	const [focusedId, setFocusedId] = useState<string | null>(null);
	const [mapReady, setMapReady] = useState(false);
	const [renderedRadiusKm, setRenderedRadiusKm] = useState<number | null>(null);
	const [loadError, setLoadError] = useState(false);
	const [zoomValue, setZoomValue] = useState(zoom);
	const isMobile = useMediaQuery(MOBILE_MEDIA_QUERY);
	const nearbyStations = useMemo(() => {
		if (!reference || radio === null) return mapStations;
		const candidates = hasCompleteDatasetRef.current
			? mapStations
			: (nearbyResultStations ?? mapStations);
		return candidates.filter((station) =>
			distanceKm(station.lat, station.lon, reference.lat, reference.lon) <= radio,
		);
	}, [mapStations, nearbyResultStations, radio, reference]);
	stationsRef.current = nearbyStations;
	selectedIdsRef.current = selectedIds;
	focusedIdRef.current = focusedId;
	isMobileRef.current = isMobile;
	onSelectRef.current = onSelect;

	const applyLocation = useCallback((location: UserLocation) => {
		// RadioFilter y el mapa son islas independientes. Si el evento de ubicación
		// llega primero, aplicamos aquí también el valor por defecto para no esperar
		// a un segundo clic en 5/25/50 km.
		const activeRadio = getLastRadio() ?? radioRef.current ?? DEFAULT_ACTIVE_RADIUS_KM;
		radioRef.current = activeRadio;
		setRadio(activeRadio);
		referenceRef.current = location;
		setReference(location);
		const map = mapRef.current;
		if (!map) {
			pendingLocationRef.current = location;
			return;
		}
		const targetZoom = radiusZoom(
			activeRadio,
			location.lat,
			mapViewportSize(map),
			map.getMinZoom(),
		);
		map.jumpTo({ center: [location.lon, location.lat], zoom: targetZoom });
		setZoomValue(targetZoom);
	}, []);

	const syncStationLayers = useCallback(() => {
		const map = mapRef.current;
		if (!map || !mapReady || !styleReadyRef.current) return;
		const selectedSet = new Set(selectedIds);
		if (focusedId) selectedSet.add(focusedId);
		installStationLayers(map, stationFeatureCollection(nearbyStations, selectedSet));
	}, [focusedId, mapReady, nearbyStations, selectedIds]);

	const drawReference = useCallback(() => {
		const map = mapRef.current;
		const maplibre = maplibreRef.current;
		if (!map || !maplibre || !mapReady || !styleReadyRef.current) return;
		const activeReference = reference ?? referenceRef.current;
		const activeRadio = radio ?? radioRef.current;
		locationMarkerRef.current?.remove();
		locationMarkerRef.current = null;
		if (!activeReference || activeRadio === null || activeRadio <= 0) {
			if (map.getLayer(SEARCH_RADIUS_OUTLINE_LAYER_ID)) map.removeLayer(SEARCH_RADIUS_OUTLINE_LAYER_ID);
			if (map.getLayer(SEARCH_RADIUS_CASING_LAYER_ID)) map.removeLayer(SEARCH_RADIUS_CASING_LAYER_ID);
			if (map.getSource(SEARCH_RADIUS_SOURCE_ID)) map.removeSource(SEARCH_RADIUS_SOURCE_ID);
			setRenderedRadiusKm(null);
			return;
		}

		const polygon = radiusPolygon(activeReference, activeRadio);
		const source = map.getSource(SEARCH_RADIUS_SOURCE_ID) as GeoJSONSource | undefined;
		if (source) source.setData(polygon);
		else map.addSource(SEARCH_RADIUS_SOURCE_ID, { type: 'geojson', data: polygon });
		if (!map.getLayer(SEARCH_RADIUS_CASING_LAYER_ID)) {
			map.addLayer({
				id: SEARCH_RADIUS_CASING_LAYER_ID,
				type: 'line',
				source: SEARCH_RADIUS_SOURCE_ID,
				layout: { 'line-cap': 'round', 'line-join': 'round' },
				paint: { 'line-color': '#ffffff', 'line-opacity': 0.9, 'line-width': 7 },
			});
		}
		if (!map.getLayer(SEARCH_RADIUS_OUTLINE_LAYER_ID)) {
			map.addLayer({
				id: SEARCH_RADIUS_OUTLINE_LAYER_ID,
				type: 'line',
				source: SEARCH_RADIUS_SOURCE_ID,
				layout: { 'line-cap': 'round', 'line-join': 'round' },
				paint: { 'line-color': '#075d7c', 'line-opacity': 1, 'line-width': 3.5 },
			});
		}
		setRenderedRadiusKm(activeRadio);
		const marker = document.createElement('span');
		marker.className = `location-marker${activeReference.source === 'device' ? ' location-marker--device' : ''}`;
		marker.setAttribute('aria-hidden', 'true');
		locationMarkerRef.current = new maplibre.Marker({ element: marker })
			.setLngLat([activeReference.lon, activeReference.lat])
			.addTo(map);
	// `mapReady` es una dependencia de sincronización: aunque ubicación y radio
	// ya estén en caché al hidratarse, el mapa solo puede recibir la fuente tras
	// su evento `load`.
	}, [mapReady, radio, reference]);

	// Los eventos de estilo de MapLibre no provocan un render de React. Guardar
	// la última versión permite volver a instalar el contorno si el estilo se
	// termina de hidratar o se reconstruye después de recibir la ubicación.
	useEffect(() => {
		drawReferenceRef.current = drawReference;
		return () => {
			drawReferenceRef.current = null;
		};
	}, [drawReference]);

	useEffect(() => {
		let disposed = false;
		let viewportTimer: ReturnType<typeof setTimeout> | undefined;
		let protocol: import('pmtiles').Protocol | null = null;
		let initialised = false;
		async function init() {
			try {
				const [maplibre, pmtiles] = await Promise.all([import('maplibre-gl'), import('pmtiles')]);
				if (disposed || !containerRef.current) return;
				// MapLibre 6 no incorpora automáticamente su worker al build estático
				// de Vite. Si no se fija esta URL, Cloudflare Pages deja el mapa en
				// estado de carga (fondo azul, sin capas ni controles) sin un error útil.
				maplibre.setWorkerUrl(mapLibreWorkerUrl);
				const base = window.location.href;
				const rawPmtiles = import.meta.env.PUBLIC_MAP_PMTILES_URL as string | undefined;
				const config = readVectorMapConfig(
					{
						PUBLIC_MAP_PMTILES_URL: rawPmtiles,
						PUBLIC_MAP_ASSET_URL: import.meta.env.PUBLIC_MAP_ASSET_URL as string | undefined,
					},
					base,
				);
				if (rawPmtiles?.trim() && !config.pmtilesUrl) throw new Error('PUBLIC_MAP_PMTILES_URL no es segura');
				protocol = new pmtiles.Protocol();
				maplibre.addProtocol('pmtiles', protocol.tile);
				maplibreRef.current = maplibre;
				const maxBounds = navigationBoundsForWidth(window.innerWidth || containerRef.current.clientWidth);
				const startupBounds = bounds
					? [[bounds[0][1], bounds[0][0]], [bounds[1][1], bounds[1][0]]] as [[number, number], [number, number]]
					: null;
				const map = new maplibre.Map({
					container: containerRef.current,
					style: createVectorStyle(config, 'light'),
					...(startupBounds
						? { bounds: startupBounds, fitBoundsOptions: { padding: 16 } }
						: { center: [center[1], center[0]] as [number, number], zoom }),
					minZoom: MAP_MIN_ZOOM,
					maxZoom: MAP_DISPLAY_MAX_ZOOM,
					maxBounds,
					attributionControl: { compact: true },
					pitchWithRotate: false,
					dragRotate: false,
					touchPitch: false,
				});
				mapRef.current = map;
				let lastViewportKey = '';
				const emitViewport = () => {
					const visible = map.getBounds();
					const next = {
						minLat: visible.getSouth(),
						maxLat: visible.getNorth(),
						minLon: visible.getWest(),
						maxLon: visible.getEast(),
					};
					const key = `${next.minLat}:${next.maxLat}:${next.minLon}:${next.maxLon}`;
					if (key === lastViewportKey) return;
					lastViewportKey = key;
					dispatchViewportChange(next);
				};
				map.on('error', (event) => {
					if (!config.pmtilesUrl || disposed) return;
					console.error('No se pudo cargar el PMTiles vectorial', event.error);
					setLoadError(true);
					map.remove();
					mapRef.current = null;
				});
				map.on('load', () => {
					if (disposed) return;
					styleReadyRef.current = true;
					map.setMinZoom(Math.max(MAP_MIN_ZOOM, Math.min(map.getZoom(), 5)));
					setZoomValue(map.getZoom());
					initialised = true;
					const highlighted = new Set(selectedIdsRef.current);
					if (focusedIdRef.current) highlighted.add(focusedIdRef.current);
					installStationLayers(map, stationFeatureCollection(stationsRef.current, highlighted));
					map.on('click', STATION_CLUSTER_LAYER_ID, async (event) => {
						const feature = event.features?.[0];
						const clusterId = Number(feature?.properties?.cluster_id);
						if (!feature || !Number.isInteger(clusterId) || feature.geometry.type !== 'Point') return;
						const source = map.getSource(STATION_SOURCE_ID) as GeoJSONSource | undefined;
						if (!source) return;
						try {
							const expansionZoom = await source.getClusterExpansionZoom(clusterId);
							if (!disposed) map.easeTo({ center: feature.geometry.coordinates as [number, number], zoom: expansionZoom });
						} catch {
							// Si el clúster cambió mientras se resolvía, el siguiente clic usará el vigente.
						}
					});
					map.on('click', [STATION_POINT_LAYER_ID, STATION_PRICE_LAYER_ID], (event) => {
						const id = event.features?.[0]?.properties?.id;
						if (typeof id !== 'string') return;
						const station = stationsRef.current.find((item) => item.id === id);
						if (!station) return;
						if (isMobileRef.current) {
							dispatchStationDetail(id);
							return;
						}
						popupRef.current?.remove();
						popupStationIdRef.current = id;
						popupRef.current = new maplibre.Popup({ offset: 28 })
							.setLngLat([station.lon, station.lat])
							.setDOMContent(popupContent(station, selectedIdsRef.current.includes(id)))
							.addTo(map);
						onSelectRef.current?.(id);
					});
					for (const layerId of [STATION_CLUSTER_LAYER_ID, STATION_POINT_LAYER_ID, STATION_PRICE_LAYER_ID]) {
						map.on('mouseenter', layerId, () => { map.getCanvas().style.cursor = 'pointer'; });
						map.on('mouseleave', layerId, () => { map.getCanvas().style.cursor = ''; });
					}
					setMapReady(true);
					const location = pendingLocationRef.current ?? getLastLocation();
					if (location) {
						applyLocation(location);
						pendingLocationRef.current = null;
					} else {
						emitViewport();
					}
					// `load` ocurre después de la hidratación del estilo: esta llamada
					// garantiza el primer contorno incluso si React aún no ha procesado
					// el cambio de estado de la ubicación.
					drawReferenceRef.current?.();
				});
				map.on('style.load', () => {
					if (disposed) return;
					styleReadyRef.current = true;
					// El primer style.load precede al load del mapa. Las capas iniciales
					// se instalan en load; aquí solo se reconstruyen tras recargas reales.
					if (!initialised) return;
					const highlighted = new Set(selectedIdsRef.current);
					if (focusedIdRef.current) highlighted.add(focusedIdRef.current);
					installStationLayers(map, stationFeatureCollection(stationsRef.current, highlighted));
					drawReferenceRef.current?.();
				});
				map.on('moveend', () => {
					setZoomValue(map.getZoom());
					if (!initialised) return;
					clearTimeout(viewportTimer);
					viewportTimer = setTimeout(emitViewport, VIEWPORT_DEBOUNCE_MS);
				});
				map.on('zoomend', () => setZoomValue(map.getZoom()));
				const canvas = map.getCanvas();
				canvas.tabIndex = 0;
				canvas.setAttribute('aria-label', 'Mapa interactivo. Usa las flechas para desplazarte y más o menos para cambiar el zoom.');
			} catch (error) {
				console.error('No se pudo inicializar el mapa vectorial', error);
				setLoadError(true);
			}
		}
		void init();
		return () => {
			disposed = true;
			styleReadyRef.current = false;
			clearTimeout(viewportTimer);
			popupRef.current?.remove();
			locationMarkerRef.current?.remove();
			mapRef.current?.remove();
			mapRef.current = null;
			if (protocol) maplibreRef.current?.removeProtocol('pmtiles');
		};
	}, []);

	useEffect(() => {
		function onLocation(event: Event) {
			const location = (event as CustomEvent<UserLocation>).detail;
			if (location && isValidCoordinates(location.lat, location.lon)) applyLocation(location);
		}
		function onClear() {
			pendingLocationRef.current = null;
			referenceRef.current = null;
			radioRef.current = null;
			setReference(null);
		}
		window.addEventListener(LOCATION_EVENT, onLocation);
		window.addEventListener(LOCATION_CLEAR_EVENT, onClear);
		return () => {
			window.removeEventListener(LOCATION_EVENT, onLocation);
			window.removeEventListener(LOCATION_CLEAR_EVENT, onClear);
		};
	}, [applyLocation]);

	useEffect(() => {
		function onRadio(event: Event) {
			const value = (event as CustomEvent<{ radio: unknown }>).detail?.radio;
			if (value !== null && !(typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= 50)) return;
			radioRef.current = value;
			setRadio(value);
			const map = mapRef.current;
			const location = referenceRef.current;
			if (map && location && value !== null) {
				const targetZoom = radiusZoom(value, location.lat, mapViewportSize(map), map.getMinZoom());
				map.jumpTo({ center: [location.lon, location.lat], zoom: targetZoom });
				setZoomValue(targetZoom);
			}
		}
		window.addEventListener(RADIO_EVENT, onRadio);
		return () => window.removeEventListener(RADIO_EVENT, onRadio);
	}, []);

	useEffect(() => {
		function applyStations(value: unknown, complete: boolean) {
			if (!Array.isArray(value)) return;
			const mapped = (value as MapStationInput[])
				.map(toMapStation)
				.filter((station): station is MapStation => station !== null);
			if (complete) {
				hasCompleteDatasetRef.current = true;
				stationsRef.current = mapped;
				setMapStations(mapped);
			} else {
				setNearbyResultStations(mapped);
				if (!hasCompleteDatasetRef.current) {
					stationsRef.current = mapped;
					setMapStations(mapped);
				}
			}
			setQuerySettled(true);
		}
		function onStations(event: Event) {
			applyStations((event as CustomEvent<{ stations?: unknown }>).detail?.stations, false);
		}
		function onMapStations(event: Event) {
			const value = (event as CustomEvent<{ stations?: unknown }>).detail?.stations;
			if (value === null) {
				hasCompleteDatasetRef.current = false;
				return;
			}
			applyStations(value, true);
		}
		window.addEventListener(STATIONS_EVENT, onStations);
		window.addEventListener(MAP_STATIONS_EVENT, onMapStations);
		const lastMapStations = getLastMapStations();
		if (lastMapStations !== null) {
			applyStations(lastMapStations, true);
		} else {
			const lastStations = getLastNearbyStations();
			if (lastStations !== null) applyStations(lastStations, false);
		}
		return () => {
			window.removeEventListener(STATIONS_EVENT, onStations);
			window.removeEventListener(MAP_STATIONS_EVENT, onMapStations);
		};
	}, []);

	useEffect(() => {
		// Las islas se hidratan de forma independiente: la URL garantiza que el
		// primer conjunto completo use los filtros persistidos aunque un evento
		// se haya emitido antes de registrar estos listeners.
		setMapFuel(fuelFromUrl());
		const restoredBrands = brandsFromUrl();
		setMapBrands((current) => sameStrings(current, restoredBrands) ? current : restoredBrands);
		setMapFiltersReady(true);
		function onFuel(event: Event) {
			const value = (event as CustomEvent<{ combustible?: unknown }>).detail?.combustible;
			if (isFuelType(value)) setMapFuel(value);
		}
		function onPrice(event: Event) {
			const detail = (event as CustomEvent<{ min?: unknown; max?: unknown }>).detail;
			if (
				typeof detail?.min === 'number' && Number.isFinite(detail.min) &&
				typeof detail.max === 'number' && Number.isFinite(detail.max) &&
				detail.max >= detail.min
			) setMapPriceFilter({ min: detail.min, max: detail.max });
		}
		function onBrands(event: Event) {
			const value = (event as CustomEvent<{ marcas?: unknown }>).detail?.marcas;
			if (Array.isArray(value)) {
				const next = value.filter((item): item is string => typeof item === 'string');
				setMapBrands((current) => sameStrings(current, next) ? current : next);
			}
		}
		window.addEventListener(FUEL_EVENT, onFuel);
		window.addEventListener(PRICE_FILTER_EVENT, onPrice);
		window.addEventListener(MARCAS_EVENT, onBrands);
		return () => {
			window.removeEventListener(FUEL_EVENT, onFuel);
			window.removeEventListener(PRICE_FILTER_EVENT, onPrice);
			window.removeEventListener(MARCAS_EVENT, onBrands);
		};
	}, []);

	useEffect(() => {
		if (!mapFiltersReady) return;
		const controller = new AbortController();
		invalidateMapStations();
		const timer = window.setTimeout(() => {
			fetchMapStations({
				combustible: mapFuel,
				minPrecio: mapPriceFilter?.min,
				maxPrecio: mapPriceFilter?.max,
				marcas: mapBrands,
			}, controller.signal)
				.then(dispatchMapStations)
				.catch(() => {
					// Si falla la carga completa se siguen aceptando los resultados
					// limitados del listado, sin romper el mapa ni las tarjetas.
				});
		}, 100);
		return () => {
			window.clearTimeout(timer);
			controller.abort();
		};
	}, [mapBrands, mapFiltersReady, mapFuel, mapPriceFilter]);

	useEffect(() => {
		function onCompare(event: Event) {
			const detail = (event as CustomEvent<{ ids: unknown; added: unknown }>).detail;
			if (!detail || !Array.isArray(detail.ids)) return;
			setSelectedIds(detail.ids.filter((id): id is string => typeof id === 'string'));
			if (typeof detail.added === 'string') {
				const station = nearbyStations.find((item) => item.id === detail.added);
				if (station) mapRef.current?.panTo([station.lon, station.lat], { animate: false });
			}
		}
		function onFocus(event: Event) {
			const id = (event as CustomEvent<{ id: unknown }>).detail?.id;
			if (id !== null && typeof id !== 'string') return;
			setFocusedId(id);
			const station = nearbyStations.find((item) => item.id === id);
			if (station) mapRef.current?.panTo([station.lon, station.lat]);
		}
		window.addEventListener(COMPARE_EVENT, onCompare);
		window.addEventListener(STATION_FOCUS_EVENT, onFocus);
		return () => {
			window.removeEventListener(COMPARE_EVENT, onCompare);
			window.removeEventListener(STATION_FOCUS_EVENT, onFocus);
		};
	}, [nearbyStations]);

	useEffect(syncStationLayers, [syncStationLayers]);
	useEffect(drawReference, [drawReference]);

	useEffect(() => {
		const id = popupStationIdRef.current;
		const popup = popupRef.current;
		if (!id || !popup) return;
		const station = nearbyStations.find((item) => item.id === id);
		if (!station) return;
		popup.setDOMContent(popupContent(station, selectedIds.includes(id)));
	}, [nearbyStations, selectedIds]);

	useEffect(() => {
		const container = containerRef.current;
		if (!container || typeof ResizeObserver === 'undefined') return;
		const observer = new ResizeObserver(() => {
			const map = mapRef.current;
			if (!map) return;
			map.resize();
			map.setMaxBounds(navigationBoundsForWidth(window.innerWidth || container.clientWidth));
		});
		observer.observe(container);
		return () => observer.disconnect();
	}, []);

	useEffect(() => {
		const container = containerRef.current;
		if (!container || !mapReady) return;
		function onPopupAction(event: MouseEvent) {
			const button = (event.target as HTMLElement | null)?.closest?.<HTMLElement>('[data-station-action]');
			const id = button?.dataset.stationId;
			if (!id) return;
			if (button.dataset.stationAction === 'compare') dispatchStationSelect(id);
			if (button.dataset.stationAction === 'detail') dispatchStationDetail(id);
		}
		container.addEventListener('click', onPopupAction);
		return () => container.removeEventListener('click', onPopupAction);
	}, [mapReady]);

	if (loadError) {
		return (
			<div className="vector-map__fallback">
				<p role="alert">No se pudo cargar el mapa. Puedes usar la lista de gasolineras.</p>
				<ul aria-label="Lista de gasolineras cercanas">
					{nearbyStations.slice(0, MAP_FALLBACK_LIMIT).map((station) => (
						<li key={station.id}><button type="button" onClick={() => onSelect?.(station.id)}>{station.rotulo ?? station.id}</button></li>
					))}
				</ul>
			</div>
		);
	}

	return (
		<div
			className="vector-map"
			role="region"
			aria-label="Mapa de gasolineras cercanas"
			data-marker-renderer="maplibre-native"
			data-station-count={nearbyStations.length}
			data-map-zoom={zoomValue.toFixed(1)}
			data-radius-km={renderedRadiusKm === null ? undefined : String(renderedRadiusKm)}
			data-radius-rendered={renderedRadiusKm === null ? undefined : 'true'}
		>
			<div ref={containerRef} className="vector-map__container" />
			{mapReady && (
				<div className="vector-map__zoom" aria-label="Controles del mapa">
					<button type="button" aria-label="Acercar mapa" disabled={zoomValue >= MAP_DISPLAY_MAX_ZOOM} onClick={() => {
						const next = Math.min(zoomValue + ZOOM_STEP, MAP_DISPLAY_MAX_ZOOM);
						mapRef.current?.jumpTo({ zoom: next });
						setZoomValue(next);
					}}><svg aria-hidden="true" viewBox="0 0 20 20"><path d="M10 4v12M4 10h12" /></svg></button>
					<button type="button" aria-label="Alejar mapa" disabled={zoomValue <= (mapRef.current?.getMinZoom() ?? MAP_MIN_ZOOM)} onClick={() => {
						const next = Math.max(zoomValue - ZOOM_STEP, mapRef.current?.getMinZoom() ?? MAP_MIN_ZOOM);
						mapRef.current?.jumpTo({ zoom: next });
						setZoomValue(next);
					}}><svg aria-hidden="true" viewBox="0 0 20 20"><path d="M4 10h12" /></svg></button>
				</div>
			)}
			{querySettled && nearbyStations.length === 0 && <p className="vector-map__empty">No hay estaciones que mostrar en el mapa.</p>}
		</div>
	);
}
