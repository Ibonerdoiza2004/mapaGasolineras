import { describe, expect, it, vi } from 'vitest';

import {
	describeLocationError,
	dispatchUserLocation,
	isValidCoordinates,
	LOCATION_EVENT,
	sortStationsByDistance,
} from './geolocation';

describe('isValidCoordinates', () => {
	it('acepta coordenadas dentro de los rangos geográficos', () => {
		expect(isValidCoordinates(0, 0)).toBe(true);
		expect(isValidCoordinates(90, 180)).toBe(true);
		expect(isValidCoordinates(-90, -180)).toBe(true);
		expect(isValidCoordinates(40.4168, -3.7038)).toBe(true);
	});

	it('rechaza latitudes fuera del rango [-90, 90]', () => {
		expect(isValidCoordinates(90.1, 0)).toBe(false);
		expect(isValidCoordinates(-90.1, 0)).toBe(false);
	});

	it('rechaza longitudes fuera del rango [-180, 180]', () => {
		expect(isValidCoordinates(0, 180.1)).toBe(false);
		expect(isValidCoordinates(0, -180.1)).toBe(false);
	});

	it('rechaza valores no finitos', () => {
		expect(isValidCoordinates(Number.NaN, 0)).toBe(false);
		expect(isValidCoordinates(0, Number.POSITIVE_INFINITY)).toBe(false);
		expect(isValidCoordinates(null as unknown as number, 0)).toBe(false);
	});
});

describe('describeLocationError', () => {
	it('mapea el código 1 a permiso denegado', () => {
		expect(describeLocationError(1)).toBe('denied');
	});

	it('mapea el código 3 a timeout', () => {
		expect(describeLocationError(3)).toBe('timeout');
	});

	it('mapea el resto de códigos a ubicación no disponible', () => {
		expect(describeLocationError(2)).toBe('unavailable');
		expect(describeLocationError(0)).toBe('unavailable');
		expect(describeLocationError(null)).toBe('unavailable');
		expect(describeLocationError(undefined)).toBe('unavailable');
	});
});

describe('dispatchUserLocation', () => {
	it('emite el evento de ubicación con las coordenadas', () => {
		const listener = vi.fn();
		window.addEventListener(LOCATION_EVENT, listener);

		dispatchUserLocation(40.4168, -3.7038);

		expect(listener).toHaveBeenCalledTimes(1);
		const event = listener.mock.calls[0][0] as CustomEvent<{ lat: number; lon: number }>;
		expect(event.type).toBe(LOCATION_EVENT);
		expect(event.detail).toEqual({ lat: 40.4168, lon: -3.7038 });
	});
});

describe('sortStationsByDistance', () => {
	const stations = [
		{ id: 'lejos', lat: 41.0, lon: -1.0 },
		{ id: 'cerca', lat: 40.42, lon: -3.7 },
		{ id: 'medio', lat: 40.5, lon: -3.5 },
	];

	it('ordena las estaciones de más cercana a más lejana', () => {
		const sorted = sortStationsByDistance(stations, 40.4168, -3.7038);
		expect(sorted.map((station) => station.id)).toEqual(['cerca', 'medio', 'lejos']);
	});

	it('no muta el array original', () => {
		const original = [...stations];
		sortStationsByDistance(stations, 40.4168, -3.7038);
		expect(stations).toEqual(original);
	});

	it('devuelve una lista vacía sin estaciones', () => {
		expect(sortStationsByDistance([], 0, 0)).toEqual([]);
	});

	it('devuelve la estación única sin cambios', () => {
		expect(sortStationsByDistance([stations[0]], 0, 0)).toEqual([stations[0]]);
	});
});