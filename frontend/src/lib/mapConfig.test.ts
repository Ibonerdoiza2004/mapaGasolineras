import { describe, expect, it } from 'vitest';

import {
	createVectorStyle,
	initialBounds,
	MAP_DISPLAY_MAX_ZOOM,
	MAP_NATIVE_MAX_ZOOM,
	navigationBoundsForWidth,
	readVectorMapConfig,
	safeMapUrl,
} from './mapConfig';

describe('configuración del mapa vectorial', () => {
	it('conserva los límites de navegación por móvil, tableta y escritorio', () => {
		expect(navigationBoundsForWidth(767)).toEqual([[-24.184, 19.041], [13.466, 50]]);
		expect(navigationBoundsForWidth(768)).toEqual([[-24.184, 22.722], [13.466, 50]]);
		expect(navigationBoundsForWidth(1023)).toEqual([[-24.184, 22.722], [13.466, 50]]);
		expect(navigationBoundsForWidth(1024)).toEqual([[-24.184, 26.403], [13.466, 50]]);
	});

	it('genera z0-z15 nativo y deja que MapLibre lo amplíe hasta z19', () => {
		const config = readVectorMapConfig({ PUBLIC_MAP_PMTILES_URL: 'https://tiles.example/maps/spain.pmtiles' });
		const style = createVectorStyle(config, 'light');
		const source = style.sources.openmaptiles;
		expect(source).toMatchObject({ type: 'vector', maxzoom: MAP_NATIVE_MAX_ZOOM });
		expect(MAP_NATIVE_MAX_ZOOM).toBe(15);
		expect(MAP_DISPLAY_MAX_ZOOM).toBe(19);
		expect(JSON.stringify(style)).not.toContain('pixelRatio');
	});

	it('deriva las tipografías del mismo origen y ofrece tema oscuro', () => {
		const config = readVectorMapConfig({ PUBLIC_MAP_PMTILES_URL: 'https://tiles.example/maps/spain.pmtiles' });
		const style = createVectorStyle(config, 'dark');
		expect(config.assetOrigin).toBe('https://tiles.example');
		expect(style.glyphs).toBe('https://tiles.example/fonts/{fontstack}/{range}.pbf');
		expect(style.sources.context).toMatchObject({
			type: 'geojson',
			data: 'https://tiles.example/context/ne_110m_land.geojson',
		});
		expect(style.sources.contextRegion).toMatchObject({
			type: 'geojson',
			data: 'https://tiles.example/context/iberia_land.geojson',
		});
		expect(style.sources.contextPlaces).toMatchObject({
			type: 'geojson',
			data: 'https://tiles.example/context/spain_cities.geojson',
		});
		expect(style.name).toContain('dark');
		const background = style.layers.find((layer) => layer.id === 'background');
		const motorway = style.layers.find((layer) => layer.id === 'roads-motorway');
		expect(background).toMatchObject({ paint: { 'background-color': '#29434d' } });
		expect(motorway).toMatchObject({ paint: { 'line-color': '#99736a' } });
		expect(JSON.stringify(style)).not.toContain('#b85f4c');
	});

	it('aplica jerarquía cartográfica a carreteras, límites y etiquetas', () => {
		const style = createVectorStyle(readVectorMapConfig({
			PUBLIC_MAP_PMTILES_URL: 'https://tiles.example/maps/spain.pmtiles',
		}), 'light');
		const ids = style.layers.map((layer) => layer.id);
		expect(ids).toEqual(expect.arrayContaining([
			'context-land',
			'context-region-land',
			'context-city-labels',
			'water',
			'boundaries-country',
			'roads-motorway',
			'roads-secondary',
			'roads-local',
			'place-labels',
			'road-labels',
		]));
		expect(ids).not.toContain('place-country-labels');
		expect(ids).not.toContain('place-region-labels');
		expect(ids.indexOf('context-land')).toBeLessThan(ids.indexOf('water'));
		expect(ids.indexOf('context-region-land')).toBeLessThan(ids.indexOf('water'));
		expect(ids.indexOf('roads-motorway')).toBeLessThan(ids.indexOf('buildings'));
		expect(ids.indexOf('buildings')).toBeLessThan(ids.indexOf('place-labels'));
	});

	it('oculta España y Gibraltar de todas las capas de lugares', () => {
		const style = createVectorStyle(readVectorMapConfig({
			PUBLIC_MAP_PMTILES_URL: 'https://tiles.example/maps/spain.pmtiles',
		}), 'light');
		const placeLayers = style.layers.filter((layer) => layer.id.startsWith('place-'));
		expect(placeLayers.length).toBeGreaterThan(0);
		expect(placeLayers.every((layer) => 'filter' in layer && JSON.stringify(layer.filter).includes('Gibraltar'))).toBe(true);
		expect(placeLayers.every((layer) => 'filter' in layer && JSON.stringify(layer.filter).includes('España'))).toBe(true);
		expect(style.layers.some((layer) => layer.id === 'place-country-labels')).toBe(false);
		expect(style.layers.some((layer) => layer.id === 'place-region-labels')).toBe(false);
	});

	it('usa colores distintos para territorio, vegetación, cultivo, arena y agua en ambos temas', () => {
		for (const theme of ['light', 'dark'] as const) {
			const style = createVectorStyle(readVectorMapConfig({
				PUBLIC_MAP_PMTILES_URL: 'https://tiles.example/maps/spain.pmtiles',
			}), theme);
			const serialized = JSON.stringify(style);
			const colors = new Set(serialized.match(/#[0-9a-f]{6}/gi));
			expect(colors.size).toBeGreaterThanOrEqual(18);
			expect(serialized).toContain('farmland');
			expect(serialized).toContain('sand');
			expect(serialized).toContain('wetland');
		}
	});

	it('funciona sin archivo en desarrollo, sin realizar peticiones externas', () => {
		const style = createVectorStyle(readVectorMapConfig({}), 'light');
		expect(style.sources).toEqual({});
		expect(style.layers).toHaveLength(1);
	});

	it('rechaza protocolos inseguros y HTTP público, pero admite localhost y la LAN privada de desarrollo', () => {
		expect(safeMapUrl('javascript:alert(1)')).toBeNull();
		expect(safeMapUrl('http://tiles.example/map.pmtiles')).toBeNull();
		expect(safeMapUrl('http://localhost:8080/map.pmtiles')).toBe('http://localhost:8080/map.pmtiles');
		expect(safeMapUrl('http://192.168.1.115:8081/maps/spain.pmtiles')).toBe('http://192.168.1.115:8081/maps/spain.pmtiles');
		expect(safeMapUrl('http://172.31.0.2:8081/maps/spain.pmtiles')).toBe('http://172.31.0.2:8081/maps/spain.pmtiles');
		expect(safeMapUrl('http://172.32.0.2:8081/maps/spain.pmtiles')).toBeNull();
		expect(safeMapUrl('/maps/spain.pmtiles', 'https://example.com/app')).toBe('https://example.com/maps/spain.pmtiles');
	});

	it('convierte los límites iniciales de latitud/longitud a longitud/latitud', () => {
		expect(initialBounds()).toEqual([[-18.45, 27.35], [4.75, 44.15]]);
	});
});
