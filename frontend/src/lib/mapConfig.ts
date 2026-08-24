import type { StyleSpecification } from 'maplibre-gl';

import { SPAIN_BOUNDS } from './spainBounds';

export const MAP_NATIVE_MAX_ZOOM = 15;
export const MAP_DISPLAY_MAX_ZOOM = 19;
export const MAP_MIN_ZOOM = 3;

export type MapTheme = 'light' | 'dark';
export type MapBounds = [[number, number], [number, number]];

const NARROW_BREAKPOINT = 768;
const TABLET_BREAKPOINT = 1024;

/**
 * Límites de navegación [oeste, sur] → [este, norte]. Conservan exactamente
 * el área que ya usaba la interfaz por dispositivo para no pedir datos fuera
 * de la zona útil.
 */
export function navigationBoundsForWidth(width: number): MapBounds {
	const south = width < NARROW_BREAKPOINT ? 19.041 : width < TABLET_BREAKPOINT ? 22.722 : 26.403;
	return [
		[-24.184, south],
		[13.466, 50],
	];
}

function isPrivateDevelopmentHost(hostname: string): boolean {
	if (hostname === 'localhost' || hostname === '::1') return true;
	const parts = hostname.split('.').map(Number);
	if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
	return parts[0] === 10
		|| parts[0] === 127
		|| (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
		|| (parts[0] === 192 && parts[1] === 168);
}

/** Solo se admiten URLs HTTPS; HTTP queda limitado al equipo o LAN de desarrollo. */
export function safeMapUrl(value: string | undefined, base = 'http://localhost'): string | null {
	const raw = value?.trim();
	if (!raw) return null;
	try {
		const parsed = new URL(raw, base);
		if (parsed.protocol === 'https:') return parsed.href;
		if (parsed.protocol === 'http:' && isPrivateDevelopmentHost(parsed.hostname)) {
			return parsed.href;
		}
	} catch {
		// La configuración inválida se convierte en un fallo controlado.
	}
	return null;
}

export interface VectorMapConfig {
	pmtilesUrl: string | null;
	assetOrigin: string | null;
}

export function readVectorMapConfig(
	env: Record<string, string | undefined>,
	base = 'http://localhost',
): VectorMapConfig {
	const pmtilesUrl = safeMapUrl(env.PUBLIC_MAP_PMTILES_URL, base);
	const configuredAssets = safeMapUrl(env.PUBLIC_MAP_ASSET_URL, base);
	let assetOrigin = configuredAssets?.replace(/\/$/, '') ?? null;
	if (!assetOrigin && pmtilesUrl) assetOrigin = new URL(pmtilesUrl).origin;
	return { pmtilesUrl, assetOrigin };
}

const light = {
	background: '#ece8dc',
	land: '#f2e6c7',
	portugalLand: '#e8ded0',
	franceLand: '#e4ead1',
	africaLand: '#ecd5b2',
	forest: '#9fc68f',
	grass: '#c5dda1',
	farmland: '#e5cf8f',
	scrub: '#c9c48f',
	sand: '#efcd83',
	wetland: '#a8d3be',
	park: '#afd499',
	residential: '#e8e3da',
	commercial: '#ead2c3',
	industrial: '#dcd8dc',
	water: '#9bcde0',
	waterLine: '#5eabc6',
	building: '#d2c8bb',
	buildingOutline: '#b8ab9d',
	minorRoad: '#ffffff',
	secondaryRoad: '#f6d991',
	majorRoad: '#e9ad55',
	motorway: '#d77b62',
	roadCase: '#bbb7ae',
	rail: '#99958f',
	boundary: '#677783',
	label: '#273945',
	mutedLabel: '#5d6b73',
	halo: '#fcfcf9',
};

const dark = {
	background: '#292d30',
	land: '#3c3d3a',
	portugalLand: '#383a3b',
	franceLand: '#394039',
	africaLand: '#423c34',
	forest: '#354b40',
	grass: '#445344',
	farmland: '#514c3f',
	scrub: '#484b42',
	sand: '#665943',
	wetland: '#36514e',
	park: '#3e5546',
	residential: '#363b3d',
	commercial: '#403b39',
	industrial: '#3d3e42',
	water: '#29434d',
	waterLine: '#477d8d',
	building: '#464d50',
	buildingOutline: '#566064',
	minorRoad: '#6a7072',
	secondaryRoad: '#80755f',
	majorRoad: '#978063',
	motorway: '#99736a',
	roadCase: '#303436',
	rail: '#707779',
	boundary: '#75838a',
	label: '#edf1f0',
	mutedLabel: '#c1c9c8',
	halo: '#2b3032',
};

/** Estilo local OpenMapTiles. z16–z19 reutiliza el detalle nativo de z15. */
export function createVectorStyle(config: VectorMapConfig, theme: MapTheme): StyleSpecification {
	const palette = theme === 'dark' ? dark : light;
	const style: Record<string, unknown> = {
		version: 8,
		name: `Ahorra Repostando ${theme}`,
		sources: {},
		layers: [
			{ id: 'background', type: 'background', paint: { 'background-color': config.pmtilesUrl && config.assetOrigin ? palette.water : palette.background } },
		],
	};
	if (!config.pmtilesUrl) return style as unknown as StyleSpecification;

	style.sources = {
		...(config.assetOrigin ? {
			context: {
				type: 'geojson',
				data: `${config.assetOrigin}/context/ne_110m_land.geojson`,
				attribution: 'Contexto terrestre: Natural Earth',
			},
			contextRegion: {
				type: 'geojson',
				data: `${config.assetOrigin}/context/iberia_land.geojson`,
			},
			contextPlaces: {
				type: 'geojson',
				data: `${config.assetOrigin}/context/spain_cities.geojson`,
			},
		} : {}),
		openmaptiles: {
			type: 'vector',
			url: `pmtiles://${config.pmtilesUrl}`,
			minzoom: 0,
			maxzoom: MAP_NATIVE_MAX_ZOOM,
			bounds: [-18.92352, 26.361175, 5.098525, 44.14855],
			attribution:
				'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
		},
	};
	if (config.assetOrigin) {
		style.glyphs = `${config.assetOrigin}/fonts/{fontstack}/{range}.pbf`;
	}
	const roadClasses = {
		motorway: ['motorway', 'trunk'],
		major: ['primary'],
		secondary: ['secondary', 'tertiary'],
		local: ['minor', 'service', 'track', 'path'],
	};
	const visiblePlaceName = [
		'!',
		['in',
			['coalesce', ['get', 'name:es'], ['get', 'name'], ['get', 'name:latin']],
			['literal', ['España', 'Spain', 'Gibraltar']],
		],
	];
	style.layers = [
		...(style.layers as object[]),
		...(config.assetOrigin ? [{
			id: 'context-land',
			type: 'fill',
			source: 'context',
			paint: { 'fill-color': palette.background },
		}, {
			id: 'context-region-land',
			type: 'fill',
			source: 'contextRegion',
			paint: {
				'fill-color': [
					'match', ['get', 'territory'],
					'ESP', palette.land,
					'PRT', palette.portugalLand,
					'FRA', palette.franceLand,
					['MAR', 'DZA', 'SAH'], palette.africaLand,
					palette.background,
				],
			},
		}] : []),
		{
			id: 'landcover', type: 'fill', source: 'openmaptiles', 'source-layer': 'landcover',
			paint: {
				'fill-color': [
					'match', ['get', 'class'],
					['wood', 'forest'], palette.forest,
					['grass', 'meadow'], palette.grass,
					'farmland', palette.farmland,
					['scrub', 'heath'], palette.scrub,
					['sand', 'beach'], palette.sand,
					'wetland', palette.wetland,
					palette.land,
				],
				'fill-opacity': 0.88,
			},
		},
		{
			id: 'landuse', type: 'fill', source: 'openmaptiles', 'source-layer': 'landuse', minzoom: 4,
			paint: {
				'fill-color': [
					'match', ['get', 'class'],
					'residential', palette.residential,
					['commercial', 'retail'], palette.commercial,
					['industrial', 'railway'], palette.industrial,
					['cemetery', 'grass', 'recreation_ground', 'village_green'], palette.park,
					'farmland', palette.farmland,
					['orchard', 'vineyard'], palette.grass,
					palette.land,
				],
				'fill-opacity': ['interpolate', ['linear'], ['zoom'], 4, 0.35, 10, 0.8],
			},
		},
		{ id: 'parks', type: 'fill', source: 'openmaptiles', 'source-layer': 'park', minzoom: 9, paint: { 'fill-color': palette.park, 'fill-opacity': 0.9 } },
		{ id: 'water', type: 'fill', source: 'openmaptiles', 'source-layer': 'water', paint: { 'fill-color': palette.water } },
		{ id: 'waterway', type: 'line', source: 'openmaptiles', 'source-layer': 'waterway', minzoom: 8, paint: { 'line-color': palette.waterLine, 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.65, 15, 2.4] } },
		{
			id: 'boundaries-regional', type: 'line', source: 'openmaptiles', 'source-layer': 'boundary', minzoom: 5,
			filter: ['>=', ['to-number', ['get', 'admin_level']], 4],
			paint: { 'line-color': palette.boundary, 'line-dasharray': [2, 2], 'line-width': ['interpolate', ['linear'], ['zoom'], 5, 0.55, 10, 1], 'line-opacity': 0.5 },
		},
		{
			id: 'boundaries-country', type: 'line', source: 'openmaptiles', 'source-layer': 'boundary',
			filter: ['<=', ['to-number', ['get', 'admin_level']], 2],
			paint: { 'line-color': palette.boundary, 'line-width': ['interpolate', ['linear'], ['zoom'], 3, 0.8, 10, 1.6], 'line-opacity': 0.8 },
		},
		{
			id: 'railways', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation', minzoom: 9,
			filter: ['in', ['get', 'class'], ['literal', ['rail', 'transit']]],
			paint: { 'line-color': palette.rail, 'line-dasharray': [2, 2], 'line-width': ['interpolate', ['linear'], ['zoom'], 9, 0.6, 15, 1.5], 'line-opacity': 0.72 },
		},
		...Object.entries([
			['local', roadClasses.local, 11, palette.minorRoad, [11, 0.55, 15, 3]],
			['secondary', roadClasses.secondary, 7, palette.secondaryRoad, [7, 0.55, 15, 4]],
			['major', roadClasses.major, 5, palette.majorRoad, [5, 0.65, 15, 5]],
			['motorway', roadClasses.motorway, 4, palette.motorway, [4, 0.75, 15, 6]],
		] as const).flatMap(([, definition]) => {
			const [name, classes, minzoom, color, widths] = definition;
			return [
				{
					id: `roads-${name}-case`, type: 'line', source: 'openmaptiles', 'source-layer': 'transportation', minzoom,
					filter: ['in', ['get', 'class'], ['literal', classes]],
					layout: { 'line-cap': 'round', 'line-join': 'round' },
					paint: { 'line-color': palette.roadCase, 'line-width': ['interpolate', ['linear'], ['zoom'], widths[0], widths[1] + 0.65, widths[2], widths[3] + 1.3], 'line-opacity': 0.76 },
				},
				{
					id: `roads-${name}`, type: 'line', source: 'openmaptiles', 'source-layer': 'transportation', minzoom,
					filter: ['in', ['get', 'class'], ['literal', classes]],
					layout: { 'line-cap': 'round', 'line-join': 'round' },
					paint: { 'line-color': color, 'line-width': ['interpolate', ['linear'], ['zoom'], ...widths], 'line-opacity': 0.9 },
				},
			];
		}),
		{ id: 'buildings', type: 'fill', source: 'openmaptiles', 'source-layer': 'building', minzoom: 13, paint: { 'fill-color': palette.building, 'fill-outline-color': palette.buildingOutline, 'fill-opacity': 0.92 } },
	];
	if (config.assetOrigin) {
		(style.layers as object[]).push(
			{
				id: 'context-city-labels', type: 'symbol', source: 'contextPlaces', minzoom: 3, maxzoom: 6,
				layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Medium'], 'text-size': ['match', ['get', 'rank'], 1, 12, 2, 11.5, 11], 'text-padding': 8, 'symbol-sort-key': ['get', 'rank'] },
				paint: { 'text-color': palette.label, 'text-halo-color': palette.halo, 'text-halo-width': 1.5, 'text-halo-blur': 0.4 },
			},
			{
				id: 'place-labels', type: 'symbol', source: 'openmaptiles', 'source-layer': 'place', minzoom: 3,
				filter: ['all', ['==', ['get', 'class'], 'city'], visiblePlaceName],
				layout: { 'text-field': ['coalesce', ['get', 'name:es'], ['get', 'name'], ['get', 'name:latin']], 'text-font': ['Noto Sans Medium'], 'text-size': ['interpolate', ['linear'], ['zoom'], 3, 9.5, 8, 12.5, 15, 15], 'text-padding': 8, 'symbol-sort-key': ['coalesce', ['get', 'rank'], 99] },
				paint: { 'text-color': palette.label, 'text-halo-color': palette.halo, 'text-halo-width': 1.5, 'text-halo-blur': 0.4 },
			},
			{
				id: 'place-locality-labels', type: 'symbol', source: 'openmaptiles', 'source-layer': 'place', minzoom: 7,
				filter: ['all', ['in', ['get', 'class'], ['literal', ['town', 'village', 'suburb', 'neighbourhood']]], visiblePlaceName],
				layout: { 'text-field': ['coalesce', ['get', 'name:es'], ['get', 'name'], ['get', 'name:latin']], 'text-font': ['Noto Sans Regular'], 'text-size': ['interpolate', ['linear'], ['zoom'], 7, 10, 15, 13], 'text-padding': 6, 'symbol-sort-key': ['coalesce', ['get', 'rank'], 99] },
				paint: { 'text-color': palette.label, 'text-halo-color': palette.halo, 'text-halo-width': 1.35, 'text-halo-blur': 0.3 },
			},
			{
				id: 'road-labels', type: 'symbol', source: 'openmaptiles', 'source-layer': 'transportation_name', minzoom: 8,
				filter: ['in', ['get', 'class'], ['literal', ['motorway', 'trunk', 'primary', 'secondary']]],
				layout: { 'symbol-placement': 'line', 'text-field': ['coalesce', ['get', 'ref'], ['get', 'name:es'], ['get', 'name'], ['get', 'name:latin']], 'text-font': ['Noto Sans Regular'], 'text-size': ['interpolate', ['linear'], ['zoom'], 8, 9, 15, 12], 'text-padding': 12 },
				paint: { 'text-color': palette.mutedLabel, 'text-halo-color': palette.halo, 'text-halo-width': 1.25 },
			},
			{
				id: 'road-labels-local', type: 'symbol', source: 'openmaptiles', 'source-layer': 'transportation_name', minzoom: 13,
				filter: ['in', ['get', 'class'], ['literal', ['tertiary', 'minor', 'service']]],
				layout: { 'symbol-placement': 'line', 'text-field': ['coalesce', ['get', 'name:es'], ['get', 'name'], ['get', 'name:latin']], 'text-font': ['Noto Sans Regular'], 'text-size': 11, 'text-padding': 10 },
				paint: { 'text-color': palette.mutedLabel, 'text-halo-color': palette.halo, 'text-halo-width': 1.1 },
			},
		);
	}
	return style as unknown as StyleSpecification;
}

export function initialBounds(): MapBounds {
	return [
		[SPAIN_BOUNDS[0][1], SPAIN_BOUNDS[0][0]],
		[SPAIN_BOUNDS[1][1], SPAIN_BOUNDS[1][0]],
	];
}
