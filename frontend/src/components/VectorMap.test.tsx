import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
	COMPARE_EVENT,
	dispatchNearbyStations,
	dispatchRadioChange,
	resetLastMapStations,
	resetLastNearbyStations,
	resetLastRadio,
	STATIONS_EVENT,
} from '../lib/explorerEvents';
import { dispatchUserLocation, resetLastLocation } from '../lib/geolocation';
import type { MapStationSummary, NearbyStation } from '../lib/stations';
import VectorMap, {
	radiusPolygon,
	radiusZoom,
	stationFeatureCollection,
	toMapStation,
	type MapStation,
} from './VectorMap';

const mapMock = vi.hoisted(() => {
	const state = { fail: false, instances: [] as MockMap[], popups: [] as MockPopup[] };
	class MockGeoJSONSource {
		data: unknown;
		setData = vi.fn((data: unknown) => { this.data = data; });
		getClusterExpansionZoom = vi.fn(async () => 8);
		constructor(data: unknown) { this.data = data; }
	}
	class MockMap {
		zoom = 5;
		styleLoaded = true;
		container: HTMLElement;
		listeners = new Map<string, Array<(...args: unknown[]) => void>>();
		sources = new Map<string, MockGeoJSONSource>();
		layers = new Map<string, unknown>();
		images = new Map<string, unknown>();
		zoomTo = vi.fn((value: number) => { this.zoom = value; this.emit('zoomend'); this.emit('moveend'); });
		panTo = vi.fn();
		jumpTo = vi.fn((options: { zoom?: number; center?: unknown }) => { if (options.zoom != null) this.zoom = options.zoom; this.emit('zoomend'); this.emit('moveend'); });
		easeTo = vi.fn();
		resize = vi.fn();
		setMaxBounds = vi.fn();
		setStyle = vi.fn(() => {
			this.sources.clear();
			this.layers.clear();
			this.emit('style.load');
			this.emit('idle');
		});
		setMinZoom = vi.fn();
		remove = vi.fn();
		addSource = vi.fn((id: string, source: { data: unknown }) => { this.sources.set(id, new MockGeoJSONSource(source.data)); });
		addLayer = vi.fn((layer: { id: string }) => { this.layers.set(layer.id, layer); });
		addImage = vi.fn((id: string, image: unknown) => { this.images.set(id, image); });
		removeImage = vi.fn((id: string) => { this.images.delete(id); });
		hasImage(id: string) { return this.images.has(id); }
		removeSource = vi.fn((id: string) => { this.sources.delete(id); });
		removeLayer = vi.fn((id: string) => { this.layers.delete(id); });
		options: Record<string, unknown>;
		constructor(options: { container: HTMLElement } & Record<string, unknown>) {
			if (state.fail) throw new Error('WebGL unavailable');
			this.options = options;
			this.container = options.container;
			this.layers.set('context-city-labels', { id: 'context-city-labels', type: 'symbol' });
			const canvas = document.createElement('canvas');
			canvas.className = 'maplibregl-canvas';
			this.container.append(canvas);
			state.instances.push(this);
			queueMicrotask(() => this.emit('load'));
		}
		on(name: string, layerOrCallback: string | string[] | ((...args: unknown[]) => void), callback?: (...args: unknown[]) => void) {
			if (Array.isArray(layerOrCallback)) {
				for (const layer of layerOrCallback) {
					if (callback) this.listeners.set(`${name}:${layer}`, [...(this.listeners.get(`${name}:${layer}`) ?? []), callback]);
				}
				return this;
			}
			const key = typeof layerOrCallback === 'string' ? `${name}:${layerOrCallback}` : name;
			const listener = typeof layerOrCallback === 'string' ? callback : layerOrCallback;
			if (listener) this.listeners.set(key, [...(this.listeners.get(key) ?? []), listener]);
			return this;
		}
		once(name: string, callback: (...args: unknown[]) => void) { return this.on(name, callback); }
		emit(name: string, ...args: unknown[]) { for (const callback of this.listeners.get(name) ?? []) callback(...args); }
		emitLayer(name: string, layer: string, ...args: unknown[]) { for (const callback of this.listeners.get(`${name}:${layer}`) ?? []) callback(...args); }
		getZoom() { return this.zoom; }
		getMinZoom() { return 3; }
		getBounds() { return { getSouth: () => 27, getNorth: () => 44, getWest: () => -18, getEast: () => 5 }; }
		getCanvas() { return this.container.querySelector('canvas') as HTMLCanvasElement; }
		getLayer(id: string) { return this.layers.get(id); }
		getSource(id: string) { return this.sources.get(id); }
		isStyleLoaded() { return this.styleLoaded; }
	}
	class MockMarker {
		element: HTMLElement;
		constructor(options: { element: HTMLElement }) { this.element = options.element; }
		setLngLat() { return this; }
		setPopup() { return this; }
		addTo(map: MockMap) { map.container.append(this.element); return this; }
		remove() { this.element.remove(); }
	}
	class MockPopup {
		content: HTMLElement | null = null;
		remove = vi.fn();
		constructor() { state.popups.push(this); }
		setLngLat() { return this; }
		setDOMContent(content: HTMLElement) { this.content = content; return this; }
		addTo() { return this; }
	}
	return { state, MockMap, MockMarker, MockPopup };
});

vi.mock('maplibre-gl', () => ({
	Map: mapMock.MockMap,
	Marker: mapMock.MockMarker,
	Popup: mapMock.MockPopup,
	addProtocol: vi.fn(),
	removeProtocol: vi.fn(),
}));
vi.mock('pmtiles', () => ({ Protocol: class { tile = vi.fn(); } }));
vi.mock('../config/runtime', () => ({
	apiUrl: (path: string) => `https://api.test${path}`,
}));

const station: MapStation = { id: 's1', lat: 40.4, lon: -3.7, rotulo: 'Estación Centro', price: 1.459 };

describe('VectorMap', () => {
	beforeEach(() => {
		document.documentElement.dataset.theme = 'light';
		mapMock.state.fail = false;
		mapMock.state.instances.length = 0;
		mapMock.state.popups.length = 0;
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));
		resetLastMapStations();
		resetLastNearbyStations();
		resetLastRadio();
		resetLastLocation();
	});

	it('inicializa MapLibre, expone el lienzo y opera el zoom con botones', async () => {
		render(<VectorMap stations={[]} center={[40.4, -3.7]} zoom={13} bounds={[[27.63, -18.16], [43.8, 4.33]]} />);
		await screen.findByRole('button', { name: 'Acercar mapa' });
		await waitFor(() => expect(document.querySelector('.maplibregl-canvas')).toHaveAttribute('tabindex', '0'));
		expect(mapMock.state.instances[0].options).toMatchObject({
			bounds: [[-18.16, 27.63], [4.33, 43.8]],
			fitBoundsOptions: { padding: 16 },
		});
		expect(mapMock.state.instances[0].options).not.toHaveProperty('center');
		fireEvent.click(screen.getByRole('button', { name: 'Acercar mapa' }));
		expect(mapMock.state.instances[0].jumpTo).toHaveBeenCalledWith({ zoom: 5.5 });
	});

	it('actualiza la acción del popup cuando cambia el comparador', async () => {
		render(<VectorMap stations={[station]} center={[40.4, -3.7]} zoom={13} />);
		await screen.findByRole('button', { name: 'Acercar mapa' });
		const map = mapMock.state.instances[0];
		map.emitLayer('click', 'station-price', { features: [{ properties: { id: 's1' } }] });
		expect(mapMock.state.popups[0].content).toHaveTextContent('Añadir al comparador');

		window.dispatchEvent(new CustomEvent(COMPARE_EVENT, { detail: { ids: ['s1'], added: 's1' } }));
		await waitFor(() => expect(mapMock.state.popups[0].content).toHaveTextContent('Quitar del comparador'));

		window.dispatchEvent(new CustomEvent(COMPARE_EVENT, { detail: { ids: [], added: null } }));
		await waitFor(() => expect(mapMock.state.popups[0].content).toHaveTextContent('Añadir al comparador'));
	});

	it('dibuja y encuadra el radio completo, y lo elimina al volver al área visible', async () => {
		render(<VectorMap stations={[station]} center={[40.4, -3.7]} zoom={13} />);
		await screen.findByRole('button', { name: 'Acercar mapa' });
		const map = mapMock.state.instances[0];

		dispatchUserLocation(40.4168, -3.7038, 'search');
		dispatchRadioChange(10);

		const targetZoom = radiusZoom(10, 40.4168, 360, 3);
		await waitFor(() => expect(map.getLayer('search-radius-outline')).toBeDefined());
		expect(map.getSource('search-radius')).toBeDefined();
		expect(map.getLayer('search-radius-casing')).toBeDefined();
		expect(screen.getByRole('region', { name: 'Mapa de gasolineras cercanas' })).toHaveAttribute(
			'data-radius-rendered',
			'true',
		);
		expect(map.jumpTo).toHaveBeenLastCalledWith({ center: [-3.7038, 40.4168], zoom: targetZoom });

		dispatchRadioChange(null);
		await waitFor(() => expect(map.getLayer('search-radius-outline')).toBeUndefined());
		expect(map.getLayer('search-radius-casing')).toBeUndefined();
		expect(map.getSource('search-radius')).toBeUndefined();
		expect(screen.getByRole('region', { name: 'Mapa de gasolineras cercanas' })).not.toHaveAttribute(
			'data-radius-rendered',
		);
	});

	it('actualiza etiquetas y radio aunque MapLibre siga cargando teselas', async () => {
		render(<VectorMap stations={[]} center={[40.4, -3.7]} zoom={13} />);
		await screen.findByRole('button', { name: 'Acercar mapa' });
		const map = mapMock.state.instances[0];
		map.styleLoaded = false;

		dispatchNearbyStations([{
			id: 'during-tiles', latitud: 40.42, longitud: -3.7, rotulo: 'Durante carga', precio: 1.5,
			ahorro: 0, fechaActualizacion: new Date().toISOString(),
		} as NearbyStation]);
		dispatchUserLocation(40.4168, -3.7038, 'search');
		dispatchRadioChange(10);

		const region = screen.getByRole('region', { name: 'Mapa de gasolineras cercanas' });
		await waitFor(() => expect(region).toHaveAttribute('data-station-count', '1'));
		await waitFor(() => expect(map.getLayer('search-radius-outline')).toBeDefined());
		expect(map.getSource('nearby-stations')).toBeDefined();
		expect(region).toHaveAttribute('data-radius-rendered', 'true');
	});

	it('vuelve a instalar el contorno si el estilo termina de cargar después de la ubicación', async () => {
		render(<VectorMap stations={[station]} center={[40.4, -3.7]} zoom={13} />);
		await screen.findByRole('button', { name: 'Acercar mapa' });
		const map = mapMock.state.instances[0];

		dispatchUserLocation(40.4168, -3.7038, 'search');
		dispatchRadioChange(10);
		await waitFor(() => expect(map.getLayer('search-radius-outline')).toBeDefined());

		map.setStyle();
		await waitFor(() => expect(map.getLayer('search-radius-outline')).toBeDefined());
		expect(map.getSource('search-radius')).toBeDefined();
	});

	it('no dibuja ni encuadra radios fuera del límite permitido', async () => {
		render(<VectorMap stations={[]} center={[40.4, -3.7]} zoom={13} />);
		await screen.findByRole('button', { name: 'Acercar mapa' });
		const map = mapMock.state.instances[0];
		window.dispatchEvent(new CustomEvent('gasolineras:radio', { detail: { radio: 51 } }));

		await waitFor(() => expect(map.getCanvas()).toBeInTheDocument());
		expect(map.getSource('search-radius')).toBeUndefined();
		expect(map.jumpTo).not.toHaveBeenCalled();
	});

	it('actualiza la fuente GeoJSON nativa sin crear nodos HTML por estación', async () => {
		render(<VectorMap stations={[]} center={[40.4, -3.7]} zoom={13} />);
		await screen.findByRole('button', { name: 'Acercar mapa' });
		window.dispatchEvent(new CustomEvent(STATIONS_EVENT, { detail: { stations: [{
			id: 's1', latitud: 40.4, longitud: -3.7, rotulo: 'Estación Centro', precio: 1.459,
			ahorro: 0.02, fechaActualizacion: new Date().toISOString(),
		} as NearbyStation] } }));
		const source = mapMock.state.instances[0].sources.get('nearby-stations');
		await waitFor(() => expect((source?.data as GeoJSON.FeatureCollection).features).toHaveLength(1));
		expect(source?.data).toMatchObject({
			type: 'FeatureCollection',
			features: [{ geometry: { coordinates: [-3.7, 40.4] }, properties: { id: 's1', priceLabel: '1,46' } }],
		});
		expect(document.querySelector('.station-marker')).toBeNull();
	});

	it('configura clustering nativo y amplía inmediatamente el grupo pulsado', async () => {
		render(<VectorMap stations={[station]} center={[40.4, -3.7]} zoom={13} />);
		await screen.findByRole('button', { name: 'Acercar mapa' });
		const map = mapMock.state.instances[0];
		expect(map.addSource).toHaveBeenCalledWith('nearby-stations', expect.objectContaining({
			type: 'geojson', cluster: true, clusterRadius: 35, clusterMaxZoom: 9,
		}));
		map.emitLayer('click', 'station-clusters', {
			features: [{ properties: { cluster_id: 7 }, geometry: { type: 'Point', coordinates: [-3.7, 40.4] } }],
		});
		await waitFor(() => expect(map.easeTo).toHaveBeenCalledWith({ center: [-3.7, 40.4], zoom: 8 }));
	});

	it('compone cada precio en un único sprite y ordena la pastilla completa al solaparse', async () => {
		render(<VectorMap stations={[station]} center={[40.4, -3.7]} zoom={13} />);
		await screen.findByRole('button', { name: 'Acercar mapa' });
		const map = mapMock.state.instances[0];
		expect(map.addImage).toHaveBeenCalledTimes(4);
		expect(map.layers.get('station-clusters')).toMatchObject({
			type: 'symbol', layout: { 'icon-image': 'station-cluster-badge' },
		});
		expect(map.layers.get('station-cluster-count')).toMatchObject({ paint: { 'text-color': '#ffffff' } });
		expect(map.images.get('station-cluster-badge')).toMatchObject({ width: 92, height: 76 });
		expect(map.layers.get('station-points')).toMatchObject({ type: 'circle' });
		const priceLayer = map.layers.get('station-price') as { layout: Record<string, unknown> };
		expect(priceLayer).toMatchObject({
			type: 'symbol',
			layout: {
				'icon-allow-overlap': true,
				'icon-ignore-placement': true,
				'symbol-sort-key': expect.arrayContaining([['get', 'sortKey']]),
			},
		});
		expect(priceLayer.layout['icon-image']).toEqual([
			'case',
			['==', ['get', 'selected'], true], ['concat', 'station-price-selected-', ['get', 'priceKey']],
			['==', ['get', 'isBest'], true], ['concat', 'station-price-best-', ['get', 'priceKey']],
			['concat', 'station-price-default-', ['get', 'priceKey']],
		]);
		expect(priceLayer.layout).not.toHaveProperty('text-field');
		expect(map.images.has('station-price-default-146')).toBe(true);
		expect(map.images.has('station-price-best-146')).toBe(true);
		expect(map.images.has('station-price-selected-146')).toBe(true);
		expect(map.images.get('station-price-default-146')).toMatchObject({ width: 92, height: 64 });
		expect(map.layers.get('station-price')).not.toHaveProperty('minzoom');
		expect(map.addLayer).toHaveBeenCalledWith(expect.objectContaining({ id: 'station-price' }));
		expect(document.querySelector('.station-marker')).toBeNull();
	});

	it('mantiene la cartografía y las estaciones sin recargar el estilo al cambiar el tema de la interfaz', async () => {
		render(<VectorMap stations={[station]} center={[40.4, -3.7]} zoom={10} />);
		await screen.findByRole('button', { name: 'Acercar mapa' });
		const map = mapMock.state.instances[0];

		document.documentElement.dataset.theme = 'dark';

		await waitFor(() => expect(document.documentElement).toHaveAttribute('data-theme', 'dark'));
		expect(map.setStyle).not.toHaveBeenCalled();
		expect(map.sources.has('nearby-stations')).toBe(true);
		expect(map.layers.has('station-points')).toBe(true);
		expect(map.layers.has('station-price')).toBe(true);
		expect(map.images.size).toBe(4);
		expect(map.addImage).toHaveBeenCalledTimes(4);
	});

	it('recupera resultados emitidos antes de que la isla del mapa se hidrate', async () => {
		dispatchNearbyStations([{
			id: 'early', latitud: 40.4, longitud: -3.7, rotulo: 'Resultado temprano', precio: 1.5,
			ahorro: 0, fechaActualizacion: new Date().toISOString(),
		} as NearbyStation]);
		render(<VectorMap stations={[]} center={[40.4, -3.7]} zoom={13} />);
		await screen.findByRole('button', { name: 'Acercar mapa' });
		const source = mapMock.state.instances[0].sources.get('nearby-stations');
		await waitFor(() => expect((source?.data as GeoJSON.FeatureCollection).features[0]?.properties?.id).toBe('early'));
	});

	it('sustituye el fallback limitado por todas las estaciones y no las pierde al mover la lista', async () => {
		const complete = Array.from({ length: 650 }, (_, index): MapStationSummary => ({
			id: `all-${index}`,
			rotulo: `Estación ${index}`,
			latitud: 36 + (index % 80) * 0.05,
			longitud: -8 + (index % 100) * 0.08,
			precio: 1.4 + (index % 10) / 100,
			mejorOpcion: index === 0,
			fechaActualizacion: new Date().toISOString(),
		}));
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			json: () => Promise.resolve(complete),
		}));

		render(<VectorMap stations={[]} center={[40.4, -3.7]} zoom={13} />);

		const map = await screen.findByRole('region', { name: 'Mapa de gasolineras cercanas' });
		await waitFor(() => expect(map).toHaveAttribute('data-station-count', '650'));
		dispatchNearbyStations([{
			id: 'limited', latitud: 40.4, longitud: -3.7, rotulo: 'Limitada', precio: 1.5,
			ahorro: 0, fechaActualizacion: new Date().toISOString(),
		} as NearbyStation]);
		expect(map).toHaveAttribute('data-station-count', '650');
	});

	it('aplica los 10 km en la primera ubicación antes de cualquier cambio manual', async () => {
		// Regresión: la ubicación puede llegar antes que el evento de RadioFilter,
		// pero el mapa debe aplicar igualmente los 10 km predeterminados.
		dispatchUserLocation(40.4168, -3.7038, 'search');
		render(<VectorMap stations={[]} center={[40.4, -3.7]} zoom={13} />);
		await screen.findByRole('button', { name: 'Acercar mapa' });
		dispatchNearbyStations([
			{ id: 'inside', rotulo: 'Cercana', latitud: 40.42, longitud: -3.7, precio: 1.5, ahorro: 0, fechaActualizacion: new Date().toISOString() },
			{ id: 'outside', rotulo: 'Lejana', latitud: 42, longitud: -3.7, precio: 1.6, ahorro: 0.1, fechaActualizacion: new Date().toISOString() },
		] as NearbyStation[]);

		const map = await screen.findByRole('region', { name: 'Mapa de gasolineras cercanas' });
		await waitFor(() => expect(map).toHaveAttribute('data-station-count', '1'));
	});

	it('dibuja el radio si la ubicación llegó antes de hidratar el mapa', async () => {
		dispatchUserLocation(40.4168, -3.7038, 'search');
		render(<VectorMap stations={[]} center={[40.4, -3.7]} zoom={13} />);
		await screen.findByRole('button', { name: 'Acercar mapa' });
		const map = mapMock.state.instances[0];
		await waitFor(() => expect(map.getLayer('search-radius-outline')).toBeDefined());
		expect(map.getSource('search-radius')).toBeDefined();
	});

	it('muestra el estado vacío solo después de recibir resultados', async () => {
		render(<VectorMap stations={[]} center={[40.4, -3.7]} zoom={13} />);
		expect(screen.queryByText('No hay estaciones que mostrar en el mapa.')).toBeNull();
		window.dispatchEvent(new CustomEvent(STATIONS_EVENT, { detail: { stations: [] } }));
		expect(await screen.findByText('No hay estaciones que mostrar en el mapa.')).toBeVisible();
	});

	it('degrada a una lista utilizable si WebGL falla', async () => {
		mapMock.state.fail = true;
		const onSelect = vi.fn();
		render(<VectorMap stations={[station]} center={[40.4, -3.7]} zoom={13} onSelect={onSelect} />);
		const fallback = await screen.findByRole('list', { name: 'Lista de gasolineras cercanas' });
		fireEvent.click(fallback.querySelector('button') as HTMLButtonElement);
		expect(onSelect).toHaveBeenCalledWith('s1');
		expect(screen.getByRole('alert')).toHaveTextContent('No se pudo cargar el mapa');
	});

	it('rechaza estaciones sin coordenadas finitas y genera un radio cerrado', () => {
		expect(toMapStation({ id: 'bad', latitud: Number.NaN, longitud: 0 } as NearbyStation)).toBeNull();
		expect(toMapStation({ id: 'bad', latitud: 91, longitud: 0 } as NearbyStation)).toBeNull();
		const polygon = radiusPolygon({ lat: 40, lon: -3, source: 'search' }, 10);
		expect(polygon.geometry.coordinates[0]).toHaveLength(73);
		expect(polygon.geometry.coordinates[0][0]).toEqual(polygon.geometry.coordinates[0][72]);
		expect(radiusZoom(5)).toBeGreaterThan(radiusZoom(10));
		expect(radiusZoom(10)).toBeGreaterThan(radiusZoom(50));
		expect(() => radiusZoom(0)).toThrow(RangeError);
		expect(() => radiusZoom(10, 91)).toThrow(RangeError);
		expect(() => radiusPolygon({ lat: 40, lon: -3, source: 'search' }, 0)).toThrow(RangeError);
		expect(() => radiusPolygon({ lat: 40, lon: -3, source: 'search' }, 51)).toThrow(RangeError);
	});

	it('serializa precio, mejor opción y selección en propiedades seguras de la capa', () => {
		const collection = stationFeatureCollection([{ ...station, isBest: true }], new Set(['s1']));
		expect(collection.features[0].properties).toEqual({
			id: 's1', label: 'Estación Centro', priceLabel: '1,46', priceKey: '146',
			isBest: true, selected: true, sortKey: 9854.0496,
		});
		const ordered = stationFeatureCollection([
			station,
			{ ...station, id: 'expensive', price: 1.8 },
			{ ...station, id: 'unavailable', price: undefined },
		]).features;
		expect(ordered[0].properties.sortKey).toBeGreaterThan(ordered[1].properties.sortKey);
		expect(ordered[1].properties.sortKey).toBeGreaterThan(ordered[2].properties.sortKey);
		expect(ordered[2].properties.priceLabel).toBe('—');
	});
});
