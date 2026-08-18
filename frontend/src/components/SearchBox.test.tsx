import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import SearchBox, { SEARCH_DEBOUNCE_MS, SEARCH_MIN_LENGTH } from './SearchBox';
import { LOCATION_EVENT, type UserLocation } from '../lib/geolocation';

vi.mock('../config/runtime', () => ({
	apiUrl: (path: string) => `https://api.test${path}`,
}));

const SUGGESTIONS = [
	{
		id: '230445241',
		label: 'Madrid',
		fullName: 'Madrid, Comunidad de Madrid, España',
		tipo: 'city',
		latitud: 40.4168,
		longitud: -3.7038,
	},
	{
		id: '230445242',
		label: 'Madrid Centro',
		fullName: 'Madrid Centro, Comunidad de Madrid, España',
		tipo: 'suburb',
		latitud: 40.42,
		longitud: -3.705,
	},
];

function jsonResponse(data: unknown): Response {
	return {
		ok: true,
		status: 200,
		json: () => Promise.resolve(data),
	} as Response;
}

function typeInSearchbox(text: string) {
	fireEvent.change(screen.getByRole('combobox'), { target: { value: text } });
}

async function flushDebounce() {
	await act(async () => {
		await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS);
	});
}

describe('SearchBox — sugerencias con debounce', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.stubGlobal('fetch', vi.fn());
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it('busca con debounce y muestra las sugerencias', async () => {
		const fetchMock = vi.mocked(fetch).mockResolvedValue(jsonResponse(SUGGESTIONS));

		render(<SearchBox />);
		typeInSearchbox('madrid');
		expect(fetchMock).not.toHaveBeenCalled();

		await flushDebounce();

		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(fetchMock.mock.calls[0][0]).toBe('https://api.test/api/geocode/search?q=madrid');
		expect(screen.getByRole('listbox')).toBeVisible();
		expect(screen.getAllByRole('option')).toHaveLength(2);
		expect(screen.getByText('Madrid')).toBeVisible();
	});

	it('agrupa los cambios rápidos y solo consulta la última consulta', async () => {
		const fetchMock = vi.mocked(fetch).mockResolvedValue(jsonResponse(SUGGESTIONS));

		render(<SearchBox />);
		typeInSearchbox('ma');
		await act(async () => {
			await vi.advanceTimersByTimeAsync(100);
		});
		typeInSearchbox('madrid');
		await flushDebounce();

		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(fetchMock.mock.calls[0][0]).toBe('https://api.test/api/geocode/search?q=madrid');
	});

	it('no consulta con menos de 3 caracteres y muestra una pista', async () => {
		const fetchMock = vi.mocked(fetch);

		render(<SearchBox />);
		typeInSearchbox('ma');
		await flushDebounce();

		expect(fetchMock).not.toHaveBeenCalled();
		expect(screen.getByRole('status')).toHaveTextContent(
			`Escribe al menos ${SEARCH_MIN_LENGTH} caracteres para ver sugerencias.`,
		);
	});

	it('no consulta cuando se borra el campo', async () => {
		const fetchMock = vi.mocked(fetch);

		render(<SearchBox />);
		typeInSearchbox('madrid');
		typeInSearchbox('');
		await flushDebounce();

		expect(fetchMock).not.toHaveBeenCalled();
		expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
	});

	it('al elegir una sugerencia notifica la nueva ubicación a las otras islas', async () => {
		vi.mocked(fetch).mockResolvedValue(jsonResponse(SUGGESTIONS));

		render(<SearchBox />);
		typeInSearchbox('madrid');
		await flushDebounce();

		const listener = vi.fn((event: Event) => {
			void (event as CustomEvent<UserLocation>).detail;
		});
		window.addEventListener(LOCATION_EVENT, listener);

		// Desde la primera recomendación, una flecha y Enter eligen la segunda.
		fireEvent.keyDown(screen.getByRole('combobox'), { key: 'ArrowDown' });
		fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Enter' });

		expect(listener).toHaveBeenCalledTimes(1);
		const detail = vi.mocked(listener).mock.calls[0][0] as CustomEvent<UserLocation>;
		expect(detail.detail).toEqual({ lat: 40.42, lon: -3.705, source: 'search' });
		expect(screen.getByRole('status')).toHaveTextContent('Gasolineras actualizadas a Madrid Centro.');
		expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
		window.removeEventListener(LOCATION_EVENT, listener);
	});

	it('al pulsar Enter se selecciona la primera recomendación por defecto', async () => {
		const listener = vi.fn((event: Event) => {
			void (event as CustomEvent<UserLocation>).detail;
		});
		vi.mocked(fetch).mockResolvedValue(jsonResponse(SUGGESTIONS));
		window.addEventListener(LOCATION_EVENT, listener);

		render(<SearchBox />);
		typeInSearchbox('madrid');
		await flushDebounce();

		fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Enter' });

		expect(listener).toHaveBeenCalledTimes(1);
		const detail = vi.mocked(listener).mock.calls[0][0] as CustomEvent<UserLocation>;
		expect(detail.detail).toEqual({ lat: 40.4168, lon: -3.7038, source: 'search' });
		window.removeEventListener(LOCATION_EVENT, listener);
	});

	it('al pulsar Enter sin sugerencias abiertas no notifica ninguna ubicación', async () => {
		const listener = vi.fn();
		vi.mocked(fetch).mockResolvedValue(jsonResponse(SUGGESTIONS));
		window.addEventListener(LOCATION_EVENT, listener);

		render(<SearchBox />);

		fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Enter' });

		expect(listener).not.toHaveBeenCalled();
		window.removeEventListener(LOCATION_EVENT, listener);
	});

	it('selecciona con el ratón la opción pulsada', async () => {
		vi.mocked(fetch).mockResolvedValue(jsonResponse(SUGGESTIONS));

		render(<SearchBox />);
		typeInSearchbox('madrid');
		await flushDebounce();

		fireEvent.mouseDown(screen.getAllByRole('option')[1]);

		expect(screen.getByRole('status')).toHaveTextContent('Gasolineras actualizadas a Madrid Centro.');
	});
});

describe('SearchBox — estados sin resultados y errores', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.stubGlobal('fetch', vi.fn());
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it('muestra un mensaje claro cuando no hay coincidencias', async () => {
		vi.mocked(fetch).mockResolvedValue(jsonResponse([]));

		render(<SearchBox />);
		typeInSearchbox('zzz');
		await flushDebounce();

		expect(screen.getByRole('status')).toHaveTextContent('Sin resultados para «zzz»');
	});

	it('un fallo del geocodificador muestra error con reintento y no pierde el campo', async () => {
		vi.mocked(fetch).mockResolvedValueOnce({
			ok: false,
			status: 503,
			json: () => Promise.resolve({}),
		} as Response);

		render(<SearchBox />);
		typeInSearchbox('madrid');
		await flushDebounce();

		const alert = screen.getByRole('alert');
		expect(alert).toHaveTextContent('No se pudo buscar ahora. Revisa tu conexión e inténtalo de nuevo.');
		expect(screen.getByRole('combobox')).toHaveValue('madrid');

		vi.mocked(fetch).mockResolvedValue(jsonResponse(SUGGESTIONS));
		fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
		await act(async () => {
			await vi.advanceTimersByTimeAsync(0);
		});
		expect(screen.getAllByRole('option')).toHaveLength(2);
		expect(screen.getByRole('combobox')).toHaveValue('madrid');
	});

	it('un fallo de red muestra el mismo error recuperable', async () => {
		vi.mocked(fetch).mockRejectedValueOnce(new TypeError('Failed to fetch'));

		render(<SearchBox />);
		typeInSearchbox('madrid');
		await flushDebounce();

		expect(screen.getByRole('alert')).toHaveTextContent('No se pudo buscar ahora.');
	});

	it('Escape cierra la lista de sugerencias sin borrar el campo', async () => {
		vi.mocked(fetch).mockResolvedValue(jsonResponse(SUGGESTIONS));

		render(<SearchBox />);
		typeInSearchbox('madrid');
		await flushDebounce();
		expect(screen.getByRole('listbox')).toBeVisible();

		fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Escape' });

		expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
		expect(screen.getByRole('combobox')).toHaveValue('madrid');
	});

	it('una respuesta tardía de una consulta obsoleta no pisa las sugerencias nuevas', async () => {
		let resolveFirst!: (response: Response) => void;
		const firstRequest = new Promise<Response>((resolve) => {
			resolveFirst = resolve;
		});
		vi.mocked(fetch)
			.mockImplementationOnce(() => firstRequest)
			.mockResolvedValueOnce(jsonResponse([SUGGESTIONS[1]]));

		render(<SearchBox />);
		typeInSearchbox('madrid');
		await flushDebounce();
		expect(screen.getByRole('status')).toHaveTextContent('Buscando…');

		typeInSearchbox('bilbao');
		await flushDebounce();
		expect(screen.getAllByRole('option')).toHaveLength(1);
		expect(screen.getByText('Madrid Centro')).toBeVisible();

		await act(async () => {
			resolveFirst(jsonResponse(SUGGESTIONS));
			await vi.advanceTimersByTimeAsync(0);
		});

		expect(screen.getAllByRole('option')).toHaveLength(1);
		expect(screen.queryByText('Madrid')).not.toBeInTheDocument();
	});
});