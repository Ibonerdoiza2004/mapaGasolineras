import { afterEach, describe, expect, it, vi } from 'vitest';

import {
	dispatchFuelChange,
	dispatchMarcasChange,
	dispatchMapStations,
	dispatchNearbyStations,
	dispatchOrdenChange,
	dispatchRadioChange,
	dispatchStationFocus,
	dispatchViewportChange,
	FUEL_EVENT,
	getLastNearbyStations,
	getLastMapStations,
	getLastRadio,
	getLastViewport,
	MARCAS_EVENT,
	MAP_STATIONS_EVENT,
	ORDEN_EVENT,
	RADIO_EVENT,
	resetLastRadio,
	resetLastNearbyStations,
	resetLastMapStations,
	resetLastViewport,
	STATIONS_EVENT,
	STATION_FOCUS_EVENT,
	VIEWPORT_EVENT,
} from './explorerEvents';

afterEach(() => {
	resetLastViewport();
	resetLastRadio();
	resetLastNearbyStations();
	resetLastMapStations();
	vi.restoreAllMocks();
});

describe('explorerEvents — eventos entre islas', () => {
	it('notifica el cambio de combustible con su valor canónico', () => {
		const listener = vi.fn();
		window.addEventListener(FUEL_EVENT, listener);

		dispatchFuelChange('GASOLINA_98');

		expect(listener).toHaveBeenCalledOnce();
		const event = listener.mock.calls[0][0] as CustomEvent<{ combustible: string }>;
		expect(event.detail.combustible).toBe('GASOLINA_98');
		window.removeEventListener(FUEL_EVENT, listener);
	});

	it('notifica el cambio de radio en kilómetros o null para todas', () => {
		const listener = vi.fn();
		window.addEventListener(RADIO_EVENT, listener);

		dispatchRadioChange(50);
		dispatchRadioChange(null);

		expect(listener).toHaveBeenCalledTimes(2);
		const events = listener.mock.calls.map(
			([event]) => (event as CustomEvent<{ radio: number | null }>).detail.radio,
		);
		expect(events).toEqual([50, null]);
		window.removeEventListener(RADIO_EVENT, listener);
	});

	it('conserva el último radio para las islas que se hidraten después', () => {
		expect(getLastRadio()).toBeNull();

		dispatchRadioChange(10);

		expect(getLastRadio()).toBe(10);

		// El modo "todas" (área visible) también se recuerda como radio nulo.
		dispatchRadioChange(null);
		expect(getLastRadio()).toBeNull();

		dispatchRadioChange(25);
		resetLastRadio();
		expect(getLastRadio()).toBeNull();
	});

	it('notifica el cambio de ordenación con el criterio elegido', () => {
		const listener = vi.fn();
		window.addEventListener(ORDEN_EVENT, listener);

		dispatchOrdenChange('distancia');

		expect(listener).toHaveBeenCalledOnce();
		const event = listener.mock.calls[0][0] as CustomEvent<{ orden: string }>;
		expect(event.detail.orden).toBe('distancia');
		window.removeEventListener(ORDEN_EVENT, listener);
	});

	it('notifica el viewport del mapa con sus límites geográficos', () => {
		const listener = vi.fn();
		window.addEventListener(VIEWPORT_EVENT, listener);

		dispatchViewportChange({ minLat: 39.5, maxLat: 41.0, minLon: -4.2, maxLon: -3.2 });

		expect(listener).toHaveBeenCalledOnce();
		const event = listener.mock.calls[0][0] as CustomEvent<{
			bounds: { minLat: number };
		}>;
		expect(event.detail.bounds).toEqual({ minLat: 39.5, maxLat: 41.0, minLon: -4.2, maxLon: -3.2 });
		window.removeEventListener(VIEWPORT_EVENT, listener);
	});

	it('conserva el último viewport para las islas que se hidraten después', () => {
		expect(getLastViewport()).toBeNull();

		dispatchViewportChange({ minLat: 36.5, maxLat: 43.8, minLon: -9.5, maxLon: 3.5 });

		expect(getLastViewport()).toEqual({
			minLat: 36.5,
			maxLat: 43.8,
			minLon: -9.5,
			maxLon: 3.5,
		});

		resetLastViewport();
		expect(getLastViewport()).toBeNull();
	});

	it('notifica los resultados de estaciones cercanas', () => {
		const listener = vi.fn();
		window.addEventListener(STATIONS_EVENT, listener);

		dispatchNearbyStations([]);

		expect(listener).toHaveBeenCalledOnce();
		const event = listener.mock.calls[0][0] as CustomEvent<{ stations: unknown[] }>;
		expect(event.detail.stations).toEqual([]);
		expect(getLastNearbyStations()).toEqual([]);
		window.removeEventListener(STATIONS_EVENT, listener);
	});

	it('conserva y notifica el conjunto completo del mapa, incluido el vacío', () => {
		const listener = vi.fn();
		window.addEventListener(MAP_STATIONS_EVENT, listener);
		const stations = [{
			id: 'm1', rotulo: 'REPSOL', latitud: 40.4, longitud: -3.7,
			precio: 1.499, mejorOpcion: true, fechaActualizacion: '2026-08-22T10:00:00',
		}];

		dispatchMapStations(stations);

		expect(listener).toHaveBeenCalledOnce();
		expect(getLastMapStations()).toEqual(stations);
		window.removeEventListener(MAP_STATIONS_EVENT, listener);
	});

	it('notifica la estación resaltada desde la lista y su limpieza', () => {
		const listener = vi.fn();
		window.addEventListener(STATION_FOCUS_EVENT, listener);

		dispatchStationFocus('s1');
		dispatchStationFocus(null);

		expect(listener).toHaveBeenCalledTimes(2);
		const ids = listener.mock.calls.map(
			([event]) => (event as CustomEvent<{ id: string | null }>).detail.id,
		);
		expect(ids).toEqual(['s1', null]);
		window.removeEventListener(STATION_FOCUS_EVENT, listener);
	});

	it('notifica el conjunto de marcas seleccionadas para filtrar', () => {
		const listener = vi.fn();
		window.addEventListener(MARCAS_EVENT, listener);

		dispatchMarcasChange(['repsol', 'otras']);
		dispatchMarcasChange([]);

		expect(listener).toHaveBeenCalledTimes(2);
		const events = listener.mock.calls.map(
			([event]) => (event as CustomEvent<{ marcas: string[] }>).detail.marcas,
		);
		expect(events).toEqual([
			['repsol', 'otras'],
			[],
		]);
		window.removeEventListener(MARCAS_EVENT, listener);
	});
});
