import { afterEach, describe, expect, it, vi } from 'vitest';

import { formatDistance, formatPrice, formatUpdateDate, isPriceFresh } from './stations';

vi.mock('../config/runtime', () => ({
	apiUrl: (path: string) => 'https://api.test' + path,
}));

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe('stations — formato de precios, distancias y fechas', () => {
	it('formatea el precio con tres decimales y coma española', () => {
		expect(formatPrice(1.459)).toBe('1,459 €/l');
		expect(formatPrice(1.7)).toBe('1,700 €/l');
		expect(formatPrice(0)).toBe('0,000 €/l');
	});

	it('formatea la distancia con un decimal como máximo', () => {
		expect(formatDistance(1.25)).toBe('1,3 km');
		expect(formatDistance(2)).toBe('2 km');
		expect(formatDistance(0.5)).toBe('0,5 km');
	});

	it('formatea la fecha de actualización en hora local', () => {
		expect(formatUpdateDate('2026-08-17T10:00:00Z')).toMatch(/17 ago/);
		expect(formatUpdateDate('20/08/2026 0:35:37')).toMatch(/20 ago/);
	});

	it('devuelve null para fechas ausentes o malformadas', () => {
		expect(formatUpdateDate(null)).toBeNull();
		expect(formatUpdateDate(undefined)).toBeNull();
		expect(formatUpdateDate('')).toBeNull();
		expect(formatUpdateDate('no-es-una-fecha')).toBeNull();
	});

	it('considera fresco un precio actualizado recientemente', () => {
		expect(isPriceFresh(new Date().toISOString())).toBe(true);
		expect(isPriceFresh(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString())).toBe(true);
	});

	it('considera caducado un precio con más de una semana', () => {
		expect(isPriceFresh(new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString())).toBe(false);
	});

	it('considera no fresco una fecha ausente, malformada o futura', () => {
		expect(isPriceFresh(null)).toBe(false);
		expect(isPriceFresh(undefined)).toBe(false);
		expect(isPriceFresh('')).toBe(false);
		expect(isPriceFresh('no-es-una-fecha')).toBe(false);
		expect(isPriceFresh(new Date(Date.now() + 60 * 1000).toISOString())).toBe(false);
	});
});

describe('stations — capa de datos', () => {
	it('consulta el endpoint de cercanía con todos los parámetros', async () => {
		const { fetchNearbyStations } = await import('./stations');
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: () => Promise.resolve([]),
		});
		vi.stubGlobal('fetch', fetchMock);

		await fetchNearbyStations({
			lat: 40.4168,
			lon: -3.7038,
			radio: 10,
			combustible: 'GASOLINA_95',
			orden: 'precio',
		});

		const [url] = fetchMock.mock.calls[0];
		expect(String(url)).toContain('/api/stations/nearby?');
		expect(String(url)).toContain('lat=40.4168');
		expect(String(url)).toContain('lon=-3.7038');
		expect(String(url)).toContain('radio=10');
		expect(String(url)).toContain('combustible=GASOLINA_95');
		expect(String(url)).toContain('orden=precio');
		// Con radio se devuelven todas las del rango: no se envía límite.
		expect(String(url)).not.toContain('limit=');
	});

	it('con viewport envía el límite de resultados', async () => {
		const { fetchNearbyStations } = await import('./stations');
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: () => Promise.resolve([]),
		});
		vi.stubGlobal('fetch', fetchMock);

		await fetchNearbyStations({
			lat: 40.4168,
			lon: -3.7038,
			radio: null,
			bounds: { minLat: 40.0, maxLat: 41.0, minLon: -4.0, maxLon: -3.5 },
			combustible: 'DIESEL',
			orden: 'distancia',
		});

		const [url] = fetchMock.mock.calls[0];
		expect(String(url)).toContain('limit=500');
		expect(String(url)).toContain('minLat=40');
	});

	it('lanza error cuando la respuesta no es correcta', async () => {
		const { fetchNearbyStations } = await import('./stations');
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));

		await expect(
			fetchNearbyStations({
				lat: 40.4168,
				lon: -3.7038,
				radio: 10,
				combustible: 'DIESEL',
				orden: 'precio',
			}),
		).rejects.toThrow('nearby 503');
	});

	it('sin radio omite el parámetro (todas las estaciones)', async () => {
		const { fetchNearbyStations } = await import('./stations');
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: () => Promise.resolve([]),
		});
		vi.stubGlobal('fetch', fetchMock);

		await fetchNearbyStations({
			lat: 40.4168,
			lon: -3.7038,
			radio: null,
			combustible: 'DIESEL',
			orden: 'precio',
		});

		const [url] = fetchMock.mock.calls[0];
		expect(String(url)).not.toContain('radio=');
		expect(String(url)).not.toContain('minLat=');
		expect(String(url)).toContain('combustible=DIESEL');
	});

	it('sin radio pero con viewport envía el rectángulo del mapa', async () => {
		const { fetchNearbyStations } = await import('./stations');
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: () => Promise.resolve([]),
		});
		vi.stubGlobal('fetch', fetchMock);

		await fetchNearbyStations({
			lat: 40.4168,
			lon: -3.7038,
			radio: null,
			bounds: { minLat: 39.5, maxLat: 41.0, minLon: -4.2, maxLon: -3.2 },
			combustible: 'GASOLINA_95',
			orden: 'distancia',
		});

		const [url] = fetchMock.mock.calls[0];
		expect(String(url)).not.toContain('radio=');
		expect(String(url)).toContain('minLat=39.5');
		expect(String(url)).toContain('maxLat=41');
		expect(String(url)).toContain('minLon=-4.2');
		expect(String(url)).toContain('maxLon=-3.2');
	});

	it('con radio no envía el viewport aunque se pase', async () => {
		const { fetchNearbyStations } = await import('./stations');
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: () => Promise.resolve([]),
		});
		vi.stubGlobal('fetch', fetchMock);

		await fetchNearbyStations({
			lat: 40.4168,
			lon: -3.7038,
			radio: 5,
			bounds: { minLat: 39.5, maxLat: 41.0, minLon: -4.2, maxLon: -3.2 },
			combustible: 'DIESEL',
			orden: 'precio',
		});

		const [url] = fetchMock.mock.calls[0];
		expect(String(url)).toContain('radio=5');
		expect(String(url)).not.toContain('minLat=');
	});

	it('envía las marcas seleccionadas separadas por comas', async () => {
		const { fetchNearbyStations } = await import('./stations');
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: () => Promise.resolve([]),
		});
		vi.stubGlobal('fetch', fetchMock);

		await fetchNearbyStations({
			lat: 40.4168,
			lon: -3.7038,
			radio: 10,
			combustible: 'GASOLINA_95',
			orden: 'precio',
			marcas: ['repsol', 'otras'],
		});

		const [url] = fetchMock.mock.calls[0];
		expect(String(url)).toContain('marcas=repsol%2Cotras');
	});

	it('sin marcas no envía el parámetro de filtro', async () => {
		const { fetchNearbyStations } = await import('./stations');
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: () => Promise.resolve([]),
		});
		vi.stubGlobal('fetch', fetchMock);

		await fetchNearbyStations({
			lat: 40.4168,
			lon: -3.7038,
			radio: 10,
			combustible: 'GASOLINA_95',
			orden: 'precio',
			marcas: [],
		});

		const [url] = fetchMock.mock.calls[0];
		expect(String(url)).not.toContain('marcas=');
	});

	it('obtiene el catálogo de marcas con sus conteos', async () => {
		const { fetchBrands } = await import('./stations');
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: () =>
				Promise.resolve([
					{ code: 'repsol', label: 'Repsol', count: 42 },
					{ code: 'otras', label: 'Otras marcas', count: 91 },
				]),
		});
		vi.stubGlobal('fetch', fetchMock);

		const brands = await fetchBrands();

		expect(fetchMock.mock.calls[0][0]).toContain('/api/stations/brands');
		expect(brands).toHaveLength(2);
		expect(brands[0].code).toBe('repsol');
		expect(brands[1].count).toBe(91);
	});

	it('devuelve lista vacía si el catálogo de marcas falla', async () => {
		const { fetchBrands } = await import('./stations');
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));

		const brands = await fetchBrands();

		expect(brands).toEqual([]);
	});
});
