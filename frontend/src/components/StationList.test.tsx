import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import StationList from './StationList';
import {
	dispatchRadioChange,
	dispatchViewportChange,
	FUEL_EVENT,
	MARCAS_EVENT,
	ORDEN_EVENT,
	PRICE_FILTER_EVENT,
	RADIO_EVENT,
	resetLastRadio,
	resetLastViewport,
	COMPARE_EVENT,
	STATION_DETAIL_EVENT,
	STATION_FOCUS_EVENT,
	STATION_SELECT_EVENT,
	STATIONS_EVENT,
	VIEWPORT_EVENT,
} from '../lib/explorerEvents';
import { dispatchUserLocation, LOCATION_EVENT, resetLastLocation } from '../lib/geolocation';
import type { NearbyStation } from '../lib/stations';
import { MOBILE_MEDIA_QUERY } from '../lib/useMediaQuery';

vi.mock('../config/runtime', () => ({
	apiUrl: (path: string) => 'https://api.test' + path,
}));

function station(overrides: Partial<NearbyStation> = {}): NearbyStation {
	return {
		id: 's1',
		rotulo: 'Estación Norte',
		direccion: 'Av. de la Industria, 24',
		localidad: 'Madrid',
		provincia: 'Madrid',
		latitud: 40.426,
		longitud: -3.7038,
		distanciaKm: 1.2,
		precio: 1.459,
		ahorro: 0,
		fechaActualizacion: new Date().toISOString(),
		...overrides,
	};
}

function jsonResponse(body: unknown) {
	return {
		ok: true,
		status: 200,
		json: () => Promise.resolve(body),
	} as Response;
}

function emitLocation(lat: number, lon: number) {
	act(() => {
		window.dispatchEvent(
			new CustomEvent(LOCATION_EVENT, { detail: { lat, lon } }),
		);
	});
}

function emitFuel(combustible: string) {
	act(() => {
		window.dispatchEvent(new CustomEvent(FUEL_EVENT, { detail: { combustible } }));
	});
}

function emitRadio(radio: number | null) {
	act(() => {
		window.dispatchEvent(new CustomEvent(RADIO_EVENT, { detail: { radio } }));
	});
}

function emitOrden(orden: string) {
	act(() => {
		window.dispatchEvent(new CustomEvent(ORDEN_EVENT, { detail: { orden } }));
	});
}

function emitMarcas(marcas: string[]) {
	act(() => {
		window.dispatchEvent(new CustomEvent(MARCAS_EVENT, { detail: { marcas } }));
	});
}

function emitViewport() {
	act(() => {
		window.dispatchEvent(
			new CustomEvent(VIEWPORT_EVENT, {
				detail: { bounds: { minLat: 36.5, maxLat: 43.8, minLon: -9.5, maxLon: 3.5 } },
			}),
		);
	});
}

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
	resetLastViewport();
	resetLastRadio();
	resetLastLocation();
	window.history.replaceState(null, '', '/explorar');
	document.body.innerHTML = '';
});

describe('StationList — listado de estaciones cercanas', () => {
	it('con viewport y sin ubicación consulta las estaciones del área visible del mapa', async () => {
		const fetchMock = vi.fn().mockResolvedValue(jsonResponse([station()]));
		vi.stubGlobal('fetch', fetchMock);

		render(<StationList />);
		emitViewport();

		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
		const [url] = fetchMock.mock.calls[0];
		expect(String(url)).toContain('/api/stations/nearby?');
		expect(String(url)).not.toContain('radio=');
		expect(String(url)).toContain('minLat=36.5');
		expect(String(url)).toContain('maxLat=43.8');
		expect(String(url)).toContain('minLon=-9.5');
		expect(String(url)).toContain('maxLon=3.5');
		// Sin ubicación la referencia es el centro del rectángulo visible.
		expect(String(url)).toContain('lat=40.15');
		expect(String(url)).toContain('lon=-3');
	});

	it('recupera el viewport emitido antes de hidratarse', async () => {
		const fetchMock = vi.fn().mockResolvedValue(jsonResponse([station()]));
		vi.stubGlobal('fetch', fetchMock);

		// El mapa emitió su viewport antes de que la isla registrara el listener.
		dispatchViewportChange({ minLat: 36.5, maxLat: 43.8, minLon: -9.5, maxLon: 3.5 });
		render(<StationList />);

		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
		const [url] = fetchMock.mock.calls[0];
		expect(String(url)).toContain('minLat=36.5');
	});

	it('recupera el radio y la ubicación emitidos antes de hidratarse (deep-link)', async () => {
		const fetchMock = vi.fn().mockResolvedValue(jsonResponse([station()]));
		vi.stubGlobal('fetch', fetchMock);

		// Un aterrizaje desde una landing de municipio emite la ubicación y
		// activa el radio antes de que esta isla se hidrate: sin recuperar el
		// último valor se quedaría consultando el área visible (toda España).
		dispatchUserLocation(40.4168, -3.7038);
		dispatchRadioChange(10);

		render(<StationList />);

		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
		const [url] = fetchMock.mock.calls[0];
		expect(String(url)).toContain('radio=10');
		expect(String(url)).toContain('lat=40.4168');
		expect(String(url)).toContain('lon=-3.7038');
		expect(String(url)).not.toContain('minLat=');
	});

	it('sin viewport no consulta con «todas» aunque haya ubicación', async () => {
		const fetchMock = vi.fn().mockResolvedValue(jsonResponse([station()]));
		vi.stubGlobal('fetch', fetchMock);

		render(<StationList />);
		emitLocation(40.4168, -3.7038);
		await new Promise((resolve) => setTimeout(resolve, 50));

		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('con ubicación consulta las estaciones del viewport del mapa por defecto', async () => {
		const fetchMock = vi.fn().mockResolvedValue(
			jsonResponse([
				station(),
				station({
					id: 's2',
					rotulo: 'Gasolinera Centro',
					direccion: 'Calle Mayor, 108',
					precio: 1.479,
					ahorro: 0.02,
					distanciaKm: 2.4,
				}),
			])
		);
		vi.stubGlobal('fetch', fetchMock);

		render(<StationList />);
		emitViewport();
		emitLocation(40.4168, -3.7038);

		await waitFor(() =>
			expect(screen.getByRole('list', { name: 'Lista de gasolineras cercanas' })).toBeInTheDocument(),
		);

		const [url] = fetchMock.mock.calls.at(-1) as [string];
		expect(String(url)).toContain('/api/stations/nearby?');
		// Con ubicación marcada, la referencia es la ubicación, no el centro
		// del mapa (mover el mapa no cambia el punto de referencia).
		expect(String(url)).toContain('lat=40.4168');
		expect(String(url)).toContain('lon=-3.7038');
		expect(String(url)).not.toContain('radio=');
		expect(String(url)).toContain('minLat=36.5');
		expect(String(url)).toContain('maxLat=43.8');
		expect(String(url)).toContain('minLon=-9.5');
		expect(String(url)).toContain('maxLon=3.5');
		expect(String(url)).toContain('combustible=DIESEL');
		expect(String(url)).toContain('orden=precio');

		expect(screen.getByRole('heading', { name: 'Estación Norte' })).toBeInTheDocument();
		expect(screen.getByText('1,459 €/l')).toBeInTheDocument();
		expect(screen.getByText('1,2 km')).toBeInTheDocument();
		expect(screen.getByText('Av. de la Industria, 24')).toBeInTheDocument();
		expect(screen.getByText('2,4 km')).toBeInTheDocument();
	});

	it('un cambio de viewport vuelve a consultar con los nuevos límites', async () => {
		const fetchMock = vi.fn().mockResolvedValue(jsonResponse([station()]));
		vi.stubGlobal('fetch', fetchMock);

		render(<StationList />);
		emitLocation(40.4168, -3.7038);
		emitViewport();
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

		act(() => {
			window.dispatchEvent(
				new CustomEvent(VIEWPORT_EVENT, {
					detail: { bounds: { minLat: 39.0, maxLat: 41.0, minLon: -4.0, maxLon: -3.0 } },
				}),
			);
		});
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

		const [url] = fetchMock.mock.calls[1];
		expect(String(url)).toContain('minLat=39');
		expect(String(url)).toContain('maxLat=41');
	});

	it('un viewport inválido en el evento se ignora', async () => {
		const fetchMock = vi.fn().mockResolvedValue(jsonResponse([station()]));
		vi.stubGlobal('fetch', fetchMock);

		render(<StationList />);
		emitLocation(40.4168, -3.7038);
		emitViewport();
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

		act(() => {
			window.dispatchEvent(
				new CustomEvent(VIEWPORT_EVENT, { detail: { bounds: { minLat: 60, maxLat: 30, minLon: -4, maxLon: -3 } } }),
			);
			window.dispatchEvent(new CustomEvent(VIEWPORT_EVENT, { detail: {} }));
		});
		await new Promise((resolve) => setTimeout(resolve, 50));

		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it('marca la mejor opción y muestra el ahorro del resto', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(
				jsonResponse([
					station(),
					station({ id: 's2', rotulo: 'Gasolinera Centro', precio: 1.479, ahorro: 0.02 }),
				]),
			),
		);

		render(<StationList />);
		emitLocation(40.4168, -3.7038);
		emitViewport();

		await waitFor(() => expect(screen.getByText('Mejor opción')).toBeInTheDocument());
		expect(screen.getByRole('heading', { name: 'Estación Norte' }).closest('li')).toHaveClass(
			'station-card--featured',
		);
		expect(screen.getByText(/Cuesta 0,020 €\/l más que la mejor opción/)).toBeInTheDocument();
	});

	it('una estación sin precio del combustible muestra «Precio no disponible» y nunca es mejor opción', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(
				jsonResponse([
					station({ id: 's2', rotulo: 'Sin precio', precio: null, ahorro: null }),
					station(),
				]),
			),
		);

		render(<StationList />);
		emitLocation(40.4168, -3.7038);
		emitViewport();

		await waitFor(() => expect(screen.getByText('Precio no disponible')).toBeInTheDocument());
		expect(screen.getByRole('heading', { name: 'Sin precio' }).closest('li')).not.toHaveClass(
			'station-card--featured',
		);
		expect(screen.getAllByText('Mejor opción')).toHaveLength(1);
	});

	it('un precio caducado no se presenta como mejor opción', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(
				jsonResponse([
					station({
						id: 's2',
						rotulo: 'Precio antiguo',
						precio: 1.459,
						ahorro: 0,
						fechaActualizacion: '2026-01-01T10:00:00Z',
					}),
					station({ id: 's3', rotulo: 'Reciente', precio: 1.5, ahorro: 0.041 }),
				]),
			),
		);

		render(<StationList />);
		emitLocation(40.4168, -3.7038);
		emitViewport();

		await waitFor(() =>
			expect(screen.getByRole('heading', { name: 'Precio antiguo' })).toBeInTheDocument(),
		);
		expect(screen.getByRole('heading', { name: 'Precio antiguo' }).closest('li')).not.toHaveClass(
			'station-card--featured',
		);
		expect(screen.queryByText('Mejor opción')).toBeNull();
	});

	it('un precio no positivo nunca se presenta como mejor opción', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(
				jsonResponse([
					station({
						id: 's2',
						rotulo: 'Precio negativo',
						precio: -1,
						ahorro: 0,
					}),
				]),
			),
		);

		render(<StationList />);
		emitLocation(40.4168, -3.7038);
		emitViewport();

		await waitFor(() =>
			expect(screen.getByRole('heading', { name: 'Precio negativo' })).toBeInTheDocument(),
		);
		expect(screen.getByRole('heading', { name: 'Precio negativo' }).closest('li')).not.toHaveClass(
			'station-card--featured',
		);
		expect(screen.queryByText('Mejor opción')).toBeNull();
	});

	it('la etiqueta de mejor opción explica el criterio usado', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse([station()])));

		render(<StationList />);
		emitLocation(40.4168, -3.7038);
		emitViewport();

		await waitFor(() => expect(screen.getByText('Mejor opción')).toBeInTheDocument());
		expect(screen.getByText('Mejor opción')).toHaveAttribute(
			'title',
			'Precio más bajo de los resultados mostrados',
		);
	});

	it('un cambio de combustible vuelve a consultar con el nuevo valor', async () => {
		const fetchMock = vi.fn().mockResolvedValue(jsonResponse([station()]));
		vi.stubGlobal('fetch', fetchMock);

		render(<StationList />);
		emitLocation(40.4168, -3.7038);
		emitViewport();
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

		emitFuel('GASOLINA_98');
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

		const [url] = fetchMock.mock.calls[1];
		expect(String(url)).toContain('combustible=GASOLINA_98');
	});

	it('al cambiar una opción la lista queda visible mientras se refresca (sin parpadeo)', async () => {
		let resolveSecond: (value: Response) => void = () => {};
		const second = new Promise<Response>((resolve) => {
			resolveSecond = resolve;
		});
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(
				jsonResponse([station({ id: 's1' }), station({ id: 's2', rotulo: 'Estación Sur' })]),
			)
			.mockImplementationOnce(() => second);
		vi.stubGlobal('fetch', fetchMock);

		render(<StationList />);
		emitViewport();
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
		expect(document.querySelectorAll('.station-card')).toHaveLength(2);

		// La nueva consulta queda pendiente: la lista anterior sigue visible.
		emitFuel('GASOLINA_98');
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
		expect(document.querySelectorAll('.station-card')).toHaveLength(2);
		const list = screen.getByRole('list');
		expect(list).toHaveAttribute('aria-busy', 'true');
		expect(list.className).toContain('explorer__stations--refreshing');

		// Al llegar la respuesta se sustituye la lista y se quita el estado.
		await act(async () => {
			resolveSecond(jsonResponse([station({ id: 's3', rotulo: 'Nueva' })]));
		});
		await waitFor(() => expect(document.querySelectorAll('.station-card')).toHaveLength(1));
		expect(screen.getByText('Nueva')).toBeInTheDocument();
		expect(screen.getByRole('list')).toHaveAttribute('aria-busy', 'false');
		expect(screen.getByRole('list').className).not.toContain('explorer__stations--refreshing');
	});

	it('un fallo durante el refresco conserva los resultados visibles', async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(jsonResponse([station()]))
			.mockRejectedValueOnce(new Error('red caída'));
		vi.stubGlobal('fetch', fetchMock);

		render(<StationList />);
		emitViewport();
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
		expect(document.querySelectorAll('.station-card')).toHaveLength(1);

		emitFuel('GASOLINA_98');
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
		await waitFor(() => expect(screen.getByRole('list')).toHaveAttribute('aria-busy', 'false'));

		// Sin mensaje de error: la lista anterior no desaparece.
		expect(document.querySelectorAll('.station-card')).toHaveLength(1);
		expect(screen.queryByText(/No se pudieron cargar/)).not.toBeInTheDocument();
	});

	it('un combustible inválido en el evento se ignora', async () => {
		const fetchMock = vi.fn().mockResolvedValue(jsonResponse([station()]));
		vi.stubGlobal('fetch', fetchMock);

		render(<StationList />);
		emitLocation(40.4168, -3.7038);
		emitViewport();
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

		emitFuel('HIDROGENO');
		await new Promise((resolve) => setTimeout(resolve, 50));

		expect(fetchMock).toHaveBeenCalledTimes(1);
		const [url] = fetchMock.mock.calls[0];
		expect(String(url)).toContain('combustible=DIESEL');
	});

	it('un cambio de radio vuelve a consultar con el nuevo valor', async () => {
		const fetchMock = vi.fn().mockResolvedValue(jsonResponse([station()]));
		vi.stubGlobal('fetch', fetchMock);

		render(<StationList />);
		emitLocation(40.4168, -3.7038);
		emitViewport();
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
		expect(String(fetchMock.mock.calls[0][0])).not.toContain('radio=');

		emitRadio(50);
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

		const [url] = fetchMock.mock.calls[1];
		expect(String(url)).toContain('radio=50');
	});

	it('un radio inválido en el evento se ignora', async () => {
		const fetchMock = vi.fn().mockResolvedValue(jsonResponse([station()]));
		vi.stubGlobal('fetch', fetchMock);

		render(<StationList />);
		emitLocation(40.4168, -3.7038);
		emitViewport();
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

		emitRadio(7);
		await new Promise((resolve) => setTimeout(resolve, 50));

		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it('un cambio de orden vuelve a consultar con el nuevo criterio', async () => {
		const fetchMock = vi.fn().mockResolvedValue(jsonResponse([station()]));
		vi.stubGlobal('fetch', fetchMock);

		render(<StationList />);
		emitLocation(40.4168, -3.7038);
		emitViewport();
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
		expect(String(fetchMock.mock.calls[0][0])).toContain('orden=precio');

		emitOrden('distancia');
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

		const [url] = fetchMock.mock.calls[1];
		expect(String(url)).toContain('orden=distancia');
	});

	it('un orden inválido en el evento se ignora', async () => {
		const fetchMock = vi.fn().mockResolvedValue(jsonResponse([station()]));
		vi.stubGlobal('fetch', fetchMock);

		render(<StationList />);
		emitLocation(40.4168, -3.7038);
		emitViewport();
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

		emitOrden('alfabetico');
		await new Promise((resolve) => setTimeout(resolve, 50));

		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it('recupera el orden desde la URL al hidratarse', async () => {
		const fetchMock = vi.fn().mockResolvedValue(jsonResponse([station()]));
		vi.stubGlobal('fetch', fetchMock);

		window.history.replaceState(null, '', '/explorar?orden=distancia');
		render(<StationList />);
		emitViewport();
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

		expect(String(fetchMock.mock.calls[0][0])).toContain('orden=distancia');
	});

	it('sin resultados muestra el estado vacío con el combustible consultado', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse([])));

		render(<StationList />);
		emitLocation(40.4168, -3.7038);
		emitViewport();

		await waitFor(() =>
			expect(screen.getByRole('status')).toHaveTextContent(
				'No hay gasolineras con precios de Diésel.',
			),
		);
	});

	it('al mover el mapa con estado vacío conserva el mensaje sin mostrar el esqueleto', async () => {
		const fetchMock = vi.fn().mockResolvedValue(jsonResponse([]));
		vi.stubGlobal('fetch', fetchMock);

		render(<StationList />);
		emitLocation(40.4168, -3.7038);
		emitViewport();
		await waitFor(() =>
			expect(screen.getByText(/No hay gasolineras con precios de Diésel/)).toBeInTheDocument(),
		);

		// La siguiente consulta (por el cambio de viewport) queda pendiente:
		// mientras tanto el panel debe conservar el mensaje de vacío, sin
		// mostrar el esqueleto de carga que provocaba el parpadeo.
		let resolveSecond!: (value: Response) => void;
		fetchMock.mockImplementationOnce(
			() => new Promise<Response>((resolve) => { resolveSecond = resolve; }),
		);

		act(() => {
			window.dispatchEvent(
				new CustomEvent(VIEWPORT_EVENT, {
					detail: { bounds: { minLat: 39.0, maxLat: 41.0, minLon: -4.0, maxLon: -3.0 } },
				}),
			);
		});

		expect(document.querySelectorAll('.station-card--skeleton')).toHaveLength(0);
		expect(screen.getByText(/No hay gasolineras con precios de Diésel/)).toBeInTheDocument();

		await act(async () => {
			resolveSecond(jsonResponse([]) as Response);
		});
	});

	it('el estado vacío menciona el radio cuando está acotado', async () => {
		const fetchMock = vi.fn().mockResolvedValue(jsonResponse([]));
		vi.stubGlobal('fetch', fetchMock);

		render(<StationList />);
		emitLocation(40.4168, -3.7038);
		emitViewport();
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

		emitRadio(5);
		await waitFor(() =>
			expect(screen.getByRole('status')).toHaveTextContent(
				'No hay gasolineras con precios de Diésel en este radio.',
			),
		);
	});

	it('un fallo del backend muestra error recuperable y Reintentar vuelve a consultar', async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce({ ok: false, status: 503 } as Response)
			.mockResolvedValue(jsonResponse([station()]));
		vi.stubGlobal('fetch', fetchMock);

		render(<StationList />);
		emitLocation(40.4168, -3.7038);
		emitViewport();

		await waitFor(() =>
			expect(screen.getByRole('alert')).toHaveTextContent('No se pudieron cargar las gasolineras.'),
		);

		act(() => {
			screen.getByRole('button', { name: 'Reintentar' }).click();
		});

		await waitFor(() =>
			expect(screen.getByRole('heading', { name: 'Estación Norte' })).toBeInTheDocument(),
		);
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it('la respuesta obsoleta de una consulta anterior no pisa la última', async () => {
		let resolveFirst: (value: Response) => void = () => {};
		const first = new Promise<Response>((resolve) => {
			resolveFirst = resolve;
		});
		const fetchMock = vi
			.fn()
			.mockImplementationOnce(() => first)
			.mockResolvedValueOnce(jsonResponse([station({ id: 'nueva', rotulo: 'Última consulta' })]));
		vi.stubGlobal('fetch', fetchMock);

		render(<StationList />);
		emitLocation(40.4168, -3.7038);
		emitViewport();
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

		emitFuel('GASOLINA_95');
		await waitFor(() =>
			expect(screen.getByRole('heading', { name: 'Última consulta' })).toBeInTheDocument(),
		);

		await act(async () => {
			resolveFirst(jsonResponse([station()]));
			await first;
		});

		expect(screen.getByRole('heading', { name: 'Última consulta' })).toBeInTheDocument();
		expect(screen.queryByRole('heading', { name: 'Estación Norte' })).not.toBeInTheDocument();
	});

	it('al alcanzar el límite de resultados avisa de que solo muestra las mejores opciones', async () => {
		const results = Array.from({ length: 500 }, (_, i) =>
			station({ id: `s${i}`, rotulo: `Estación ${i}` }),
		);
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(results)));

		render(<StationList />);
		emitLocation(40.4168, -3.7038);
		emitViewport();

		await waitFor(() =>
			expect(
				screen.getByText(/mostrando las 500 mejores opciones/i),
			).toBeInTheDocument(),
		);
		expect(document.querySelectorAll('.station-card')).toHaveLength(500);
	}, 30000);

	it('sin alcanzar el límite no muestra la nota', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse([station()])));

		render(<StationList />);
		emitLocation(40.4168, -3.7038);
		emitViewport();

		await waitFor(() =>
			expect(screen.getByRole('heading', { name: 'Estación Norte' })).toBeInTheDocument(),
		);
		expect(screen.queryByText(/mostrando las mejores/i)).toBeNull();
	});

	it('muestra el esqueleto de carga mientras llega la primera consulta', async () => {
		let resolveFirst: (value: Response) => void = () => {};
		const first = new Promise<Response>((resolve) => {
			resolveFirst = resolve;
		});
		const fetchMock = vi.fn().mockImplementationOnce(() => first);
		vi.stubGlobal('fetch', fetchMock);

		render(<StationList />);
		emitViewport();

		// Antes de responder: esqueleto decorativo y anuncio de búsqueda.
		await waitFor(() =>
			expect(document.querySelectorAll('.station-card--skeleton')).toHaveLength(3),
		);
		expect(screen.getByRole('status', { hidden: true })).toHaveTextContent('Buscando gasolineras');
		expect(screen.queryByRole('heading', { name: 'Estación Norte' })).not.toBeInTheDocument();

		await act(async () => {
			resolveFirst(jsonResponse([station()]));
			await first;
		});

		await waitFor(() =>
			expect(screen.getByRole('heading', { name: 'Estación Norte' })).toBeInTheDocument(),
		);
		expect(document.querySelectorAll('.station-card--skeleton')).toHaveLength(0);
	});

	it('con radio no acota los resultados ni muestra la nota del límite', async () => {
		const results = Array.from({ length: 300 }, (_, i) =>
			station({ id: `s${i}`, rotulo: `Estación ${i}` }),
		);
		const fetchMock = vi.fn().mockResolvedValue(jsonResponse(results));
		vi.stubGlobal('fetch', fetchMock);

		render(<StationList />);
		emitRadio(10);
		emitLocation(40.4168, -3.7038);

		await waitFor(() => expect(document.querySelectorAll('.station-card')).toHaveLength(300));
		expect(screen.queryByText(/mostrando las 200 mejores/i)).toBeNull();
		const [url] = fetchMock.mock.calls[0];
		expect(String(url)).not.toContain('limit=');
	});

	it('difunde los resultados al mapa y actualiza el contador', async () => {
		const results = [station(), station({ id: 's2', rotulo: 'Gasolinera Centro' })];
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(results)));
		document.body.innerHTML = `
			<details class="explorer__sidebar" open>
				<summary><span><strong>Gasolineras cercanas</strong><small>12 resultados</small></span></summary>
				<span class="explorer__result-count" aria-label="12 resultados">12</span>
			</details>
		`;
		const listener = vi.fn();
		window.addEventListener(STATIONS_EVENT, listener);

		render(<StationList />);
		emitLocation(40.4168, -3.7038);
		emitViewport();

		await waitFor(() =>
			expect(
				document.querySelector('.explorer__result-count')?.textContent,
			).toBe('2'),
		);

		expect(listener).toHaveBeenCalledOnce();
		const event = listener.mock.calls[0][0] as CustomEvent<{ stations: NearbyStation[] }>;
		expect(event.detail.stations).toHaveLength(2);
		expect(document.querySelector('.explorer__sidebar summary small')?.textContent).toBe(
			'2 resultados',
		);
		window.removeEventListener(STATIONS_EVENT, listener);
	});

	it('hacer clic en una tarjeta despliega las acciones de añadir al comparador y ver ficha', async () => {
		vi.stubGlobal(
			'fetch',
			vi
				.fn()
				.mockResolvedValue(
					jsonResponse([station(), station({ id: 's2', rotulo: 'Gasolinera Sur' })]),
				),
		);
		const listener = vi.fn();
		window.addEventListener(STATION_SELECT_EVENT, listener);

		render(<StationList />);
		emitViewport();
		const card = (await screen.findByRole('heading', { name: 'Estación Norte' })).closest(
			'li',
		) as HTMLElement;
		const trigger = card.querySelector('.station-card__trigger') as HTMLElement;

		fireEvent.click(card);

		expect(trigger).toHaveAttribute('aria-expanded', 'true');
		expect(within(card).getByRole('button', { name: 'Añadir al comparador' })).toBeInTheDocument();
		expect(within(card).getByRole('button', { name: 'Ver ficha' })).toBeInTheDocument();
		// El clic en la tarjeta ya no añade directamente al comparador.
		expect(listener).not.toHaveBeenCalled();
		window.removeEventListener(STATION_SELECT_EVENT, listener);
	});

	it('resalta en el mapa la estación pulsada aunque no esté en el comparador', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(jsonResponse([station(), station({ id: 's2', rotulo: 'Gasolinera Sur' })])),
		);
		const listener = vi.fn();
		window.addEventListener(STATION_FOCUS_EVENT, listener);

		render(<StationList />);
		emitViewport();
		const card = (await screen.findByRole('heading', { name: 'Estación Norte' })).closest(
			'li',
		) as HTMLElement;
		const trigger = card.querySelector('.station-card__trigger') as HTMLElement;

		fireEvent.click(card);

		expect(listener).toHaveBeenCalledOnce();
		const first = listener.mock.calls[0][0] as CustomEvent<{ id: string | null }>;
		expect(first.detail.id).toBe('s1');
		expect(trigger).toHaveAttribute('aria-current', 'true');
		expect(card).toHaveClass('station-card--focused');
		// Sin añadirla al comparador, sigue marcada solo como foco.
		expect(card).not.toHaveClass('station-card--selected');

		fireEvent.click(card);

		expect(listener).toHaveBeenCalledTimes(2);
		const second = listener.mock.calls[1][0] as CustomEvent<{ id: string | null }>;
		expect(second.detail.id).toBeNull();
		expect(trigger).not.toHaveAttribute('aria-current');
		expect(card).not.toHaveClass('station-card--focused');
		window.removeEventListener(STATION_FOCUS_EVENT, listener);
	});

	it('mantiene marcada la estación del comparador aunque se limpie el foco', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(jsonResponse([station(), station({ id: 's2', rotulo: 'Gasolinera Sur' })])),
		);

		render(<StationList />);
		emitViewport();
		const card = (await screen.findByRole('heading', { name: 'Estación Norte' })).closest(
			'li',
		) as HTMLElement;

		act(() => {
			window.dispatchEvent(new CustomEvent(COMPARE_EVENT, { detail: { ids: ['s1'], added: null } }));
		});
		expect(card).toHaveClass('station-card--selected');

		// Se pulsa la tarjeta (marca el foco) y se vuelve a pulsar (lo limpia).
		fireEvent.click(card);
		expect(card).toHaveClass('station-card--selected');
		expect(card).toHaveClass('station-card--focused');

		fireEvent.click(card);
		expect(card).not.toHaveClass('station-card--focused');
		// Sigue resaltada porque pertenece al comparador.
		expect(card).toHaveClass('station-card--selected');
	});

	it('despliega las acciones con el teclado (Enter) y las contrae de nuevo', async () => {
		vi.stubGlobal(
			'fetch',
			vi
				.fn()
				.mockResolvedValue(
					jsonResponse([station(), station({ id: 's2', rotulo: 'Gasolinera Sur' })]),
				),
		);

		render(<StationList />);
		emitViewport();
		const card = (await screen.findByRole('heading', { name: 'Gasolinera Sur' })).closest(
			'li',
		) as HTMLElement;
		const trigger = card.querySelector('.station-card__trigger') as HTMLElement;

		fireEvent.click(trigger);
		expect(trigger).toHaveAttribute('aria-expanded', 'true');
		expect(within(card).getByRole('button', { name: 'Añadir al comparador' })).toBeInTheDocument();

		fireEvent.click(trigger);
		expect(trigger).toHaveAttribute('aria-expanded', 'false');
		expect(within(card).queryByRole('button', { name: 'Añadir al comparador' })).toBeNull();
	});

	it('«Añadir al comparador» notifica la estación y cambia la etiqueta a «Quitar»', async () => {
		vi.stubGlobal(
			'fetch',
			vi
				.fn()
				.mockResolvedValue(
					jsonResponse([station(), station({ id: 's2', rotulo: 'Gasolinera Sur' })]),
				),
		);
		const listener = vi.fn();
		window.addEventListener(STATION_SELECT_EVENT, listener);

		render(<StationList />);
		emitViewport();
		const card = (await screen.findByRole('heading', { name: 'Estación Norte' })).closest(
			'li',
		) as HTMLElement;

		fireEvent.click(card);
		fireEvent.click(within(card).getByRole('button', { name: 'Añadir al comparador' }));

		expect(listener).toHaveBeenCalled();
		const event = listener.mock.calls[0][0] as CustomEvent<{ id: string }>;
		expect(event.detail.id).toBe('s1');

		act(() => {
			window.dispatchEvent(new CustomEvent(COMPARE_EVENT, { detail: { ids: ['s1'], added: null } }));
		});
		expect(within(card).getByRole('button', { name: 'Quitar del comparador' })).toBeInTheDocument();
		window.removeEventListener(STATION_SELECT_EVENT, listener);
	});

	it('«Ver ficha» notifica el detalle de la estación', async () => {
		vi.stubGlobal(
			'fetch',
			vi
				.fn()
				.mockResolvedValue(
					jsonResponse([station(), station({ id: 's2', rotulo: 'Gasolinera Sur' })]),
				),
		);
		const listener = vi.fn();
		window.addEventListener(STATION_DETAIL_EVENT, listener);

		render(<StationList />);
		emitViewport();
		const card = (await screen.findByRole('heading', { name: 'Estación Norte' })).closest(
			'li',
		) as HTMLElement;

		fireEvent.click(card);
		fireEvent.click(within(card).getByRole('button', { name: 'Ver ficha' }));

		expect(listener).toHaveBeenCalled();
		const event = listener.mock.calls[0][0] as CustomEvent<{ id: string }>;
		expect(event.detail.id).toBe('s1');
		window.removeEventListener(STATION_DETAIL_EVENT, listener);
	});

	it('recibe las estaciones añadidas al panel de comparar y las resalta', async () => {
		vi.stubGlobal(
			'fetch',
			vi
				.fn()
				.mockResolvedValue(
					jsonResponse([station(), station({ id: 's2', rotulo: 'Gasolinera Sur' })]),
				),
		);

		render(<StationList />);
		emitViewport();
		await screen.findByRole('heading', { name: 'Estación Norte' });

		act(() => {
			window.dispatchEvent(
				new CustomEvent(COMPARE_EVENT, { detail: { ids: ['s2'], added: null } }),
			);
		});

		expect(screen.getByRole('heading', { name: 'Gasolinera Sur' }).closest('li')).toHaveClass(
			'station-card--selected',
		);
		expect(screen.getByRole('heading', { name: 'Estación Norte' }).closest('li')).not.toHaveClass(
			'station-card--selected',
		);
	});

	it('un cambio de marcas vuelve a consultar con el filtro aplicado', async () => {
		const fetchMock = vi.fn().mockResolvedValue(jsonResponse([station()]));
		vi.stubGlobal('fetch', fetchMock);

		render(<StationList />);
		emitViewport();
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
		expect(String(fetchMock.mock.calls[0][0])).not.toContain('marcas=');

		emitMarcas(['repsol', 'otras']);

		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
		const [url] = fetchMock.mock.calls[1];
		expect(String(url)).toContain('marcas=repsol%2Cotras');
	});

	it('ignora un evento de marcas sin lista', async () => {
		const fetchMock = vi.fn().mockResolvedValue(jsonResponse([station()]));
		vi.stubGlobal('fetch', fetchMock);

		render(<StationList />);
		emitViewport();
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

		act(() => {
			window.dispatchEvent(new CustomEvent(MARCAS_EVENT, { detail: { marcas: 'repsol' } }));
		});

		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it('filtra los resultados por el rango de precios elegido', async () => {
		// El mock responde según la URL: el rango de precios del dataset, la
		// consulta filtrada (solo la barata) o la consulta sin filtrar.
		const fetchMock = vi.fn().mockImplementation((url: string) => {
			const requestUrl = String(url);
			if (requestUrl.includes('price-range')) {
				return jsonResponse({ min: 1.4, max: 1.9 });
			}
			if (requestUrl.includes('minPrecio=1')) {
				return jsonResponse([station({ id: 's1', rotulo: 'Barata', precio: 1.4, ahorro: 0 })]);
			}
			return jsonResponse([
				station({ id: 's1', rotulo: 'Barata', precio: 1.4, ahorro: 0 }),
				station({ id: 's2', rotulo: 'Cara', precio: 1.9, ahorro: 0.5 }),
			]);
		});
		vi.stubGlobal('fetch', fetchMock);

		render(<StationList />);
		emitViewport();
		await screen.findByRole('heading', { name: 'Barata' });
		expect(screen.getByRole('heading', { name: 'Cara' })).toBeInTheDocument();

		act(() => {
			window.dispatchEvent(new CustomEvent(PRICE_FILTER_EVENT, { detail: { min: 1.0, max: 1.5 } }));
		});

		await waitFor(() =>
			expect(String(fetchMock.mock.calls.at(-1)?.[0])).toContain('minPrecio=1'),
		);
		expect(String(fetchMock.mock.calls.at(-1)?.[0])).toContain('maxPrecio=1.5');
		await waitFor(() =>
			expect(screen.queryByRole('heading', { name: 'Cara' })).not.toBeInTheDocument(),
		);
		expect(screen.getByRole('heading', { name: 'Barata' })).toBeInTheDocument();
	});

	it('publica al mapa solo las estaciones del rango de precios', async () => {
		const fetchMock = vi.fn().mockImplementation((url: string) => {
			const requestUrl = String(url);
			if (requestUrl.includes('price-range')) {
				return jsonResponse({ min: 1.4, max: 1.9 });
			}
			if (requestUrl.includes('minPrecio=1')) {
				return jsonResponse([station({ id: 's1', rotulo: 'Barata', precio: 1.4, ahorro: 0 })]);
			}
			return jsonResponse([
				station({ id: 's1', rotulo: 'Barata', precio: 1.4, ahorro: 0 }),
				station({ id: 's2', rotulo: 'Cara', precio: 1.9, ahorro: 0.5 }),
			]);
		});
		vi.stubGlobal('fetch', fetchMock);
		const listener = vi.fn();
		window.addEventListener(STATIONS_EVENT, listener);

		render(<StationList />);
		emitViewport();
		await screen.findByRole('heading', { name: 'Barata' });
		listener.mockClear();

		act(() => {
			window.dispatchEvent(new CustomEvent(PRICE_FILTER_EVENT, { detail: { min: 1.0, max: 1.5 } }));
		});

		await waitFor(() =>
			expect(
				(listener.mock.calls.at(-1)?.[0] as CustomEvent<{ stations: NearbyStation[] }>).detail
					.stations,
			).toEqual([expect.objectContaining({ id: 's1' })]),
		);
		window.removeEventListener(STATIONS_EVENT, listener);
	});

	it('avisa cuando el rango de precios excluye todas las estaciones', async () => {
		const fetchMock = vi.fn().mockImplementation((url: string) => {
			const requestUrl = String(url);
			if (requestUrl.includes('price-range')) {
				return jsonResponse({ min: 1.4, max: 1.9 });
			}
			if (requestUrl.includes('minPrecio=5')) {
				return jsonResponse([]);
			}
			return jsonResponse([
				station({ id: 's1', rotulo: 'Barata', precio: 1.4, ahorro: 0 }),
				station({ id: 's2', rotulo: 'Cara', precio: 1.9, ahorro: 0.5 }),
			]);
		});
		vi.stubGlobal('fetch', fetchMock);

		render(<StationList />);
		emitViewport();
		await screen.findByRole('heading', { name: 'Barata' });

		act(() => {
			window.dispatchEvent(new CustomEvent(PRICE_FILTER_EVENT, { detail: { min: 5.0, max: 6.0 } }));
		});

		await waitFor(() =>
			expect(screen.getByText(/Ninguna gasolinera en ese rango de precios/)).toBeInTheDocument(),
		);
	});

	it('marca la fecha de actualización cuando el precio es antiguo', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(
				jsonResponse([
					station({
						id: 's2',
						rotulo: 'Antigua',
						precio: 1.5,
						ahorro: 0,
						fechaActualizacion: '2026-01-01T10:00:00Z',
					}),
					station(),
				]),
			),
		);

		render(<StationList />);
		emitViewport();
		await screen.findByRole('heading', { name: 'Antigua' });

	const staleDate = screen
		.getByRole('heading', { name: 'Antigua' })
		.closest('li')!.querySelector('.station-card__stale');
	expect(staleDate).not.toBeNull();
	expect(staleDate).toHaveTextContent('Actualizado');
	const freshDate = screen
		.getByRole('heading', { name: 'Estación Norte' })
		.closest('li')!.querySelector('.station-card__stale');
	expect(freshDate).toBeNull();
	});

	it('avisa cuando un refresco falla y se conservan los datos en caché', async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(jsonResponse([station()]))
			.mockRejectedValueOnce(new Error('red caída'));
		vi.stubGlobal('fetch', fetchMock);

		render(<StationList />);
		emitViewport();
		await screen.findByRole('heading', { name: 'Estación Norte' });

		// Un cambio de contexto dispara un refresco que falla: la lista se
		// conserva y aparece el aviso de datos no actualizados.
		emitFuel('GASOLINA_98');
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
		await waitFor(() =>
			expect(screen.getByText(/No se pudo actualizar los precios/)).toBeInTheDocument(),
		);
		expect(screen.getByRole('heading', { name: 'Estación Norte' })).toBeInTheDocument();
	});
});

describe('StationList — comportamiento móvil', () => {
	function mockMobile() {
		vi.stubGlobal('matchMedia', (query: string) => ({
			matches: query === MOBILE_MEDIA_QUERY,
			media: query,
			onchange: null,
			addListener: () => undefined,
			removeListener: () => undefined,
			addEventListener: () => undefined,
			removeEventListener: () => undefined,
			dispatchEvent: () => false,
		}));
	}

	it('en móvil el tap de una tarjeta abre la ficha directamente, sin desplegar acciones', async () => {
		mockMobile();
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse([station()])));
		const detailListener = vi.fn();
		window.addEventListener(STATION_DETAIL_EVENT, detailListener);
		const focusListener = vi.fn();
		window.addEventListener(STATION_FOCUS_EVENT, focusListener);

		render(<StationList />);
		emitViewport();
		const card = (await screen.findByRole('heading', { name: 'Estación Norte' })).closest(
			'li',
		) as HTMLElement;
		const trigger = card.querySelector('.station-card__trigger') as HTMLElement;

		fireEvent.click(card);

		// No despliega las acciones de comparador ni marca el foco persistente.
		expect(trigger).toHaveAttribute('aria-expanded', 'false');
		expect(within(card).queryByRole('button', { name: 'Añadir al comparador' })).toBeNull();
		expect(within(card).queryByRole('button', { name: 'Ver ficha' })).toBeNull();
		expect(detailListener).toHaveBeenCalledOnce();
		const event = detailListener.mock.calls[0][0] as CustomEvent<{ id: string }>;
		expect(event.detail.id).toBe('s1');
		expect(focusListener).toHaveBeenCalledWith(
			expect.objectContaining({ detail: { id: 's1' } }),
		);

		window.removeEventListener(STATION_DETAIL_EVENT, detailListener);
		window.removeEventListener(STATION_FOCUS_EVENT, focusListener);
	});
});
