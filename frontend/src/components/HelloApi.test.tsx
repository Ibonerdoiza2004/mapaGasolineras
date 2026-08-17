import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import HelloApi from './HelloApi';

vi.mock('../config/runtime', () => ({
	apiUrl: (path: string) => `https://api.test${path}`,
}));

function mockFetchResponse(overrides: Partial<Response> = {}) {
	const fetchMock = vi.fn().mockResolvedValue({
		ok: true,
		status: 200,
		text: () => Promise.resolve('Hello World'),
		...overrides,
	});
	vi.stubGlobal('fetch', fetchMock);
	return fetchMock;
}

describe('HelloApi', () => {
	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	it('muestra el estado de carga y después el mensaje recibido', async () => {
		const fetchMock = mockFetchResponse();
		render(<HelloApi />);

		expect(screen.getByRole('status')).toHaveTextContent('Conectando');

		await waitFor(() => {
			expect(screen.getByRole('status')).toHaveTextContent('Mensaje del backend: Hello World');
		});
		expect(fetchMock).toHaveBeenCalledWith('https://api.test/api/hello');
	});

	it('muestra un error cuando el backend responde con un estado no válido', async () => {
		mockFetchResponse({ ok: false, status: 503, text: () => Promise.resolve('') });
		render(<HelloApi />);

		await waitFor(() => {
			expect(screen.getByRole('alert')).toHaveTextContent('No se pudo conectar');
		});
	});

	it('muestra un error cuando la petición falla', async () => {
		vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('red caída')));
		render(<HelloApi />);

		await waitFor(() => {
			expect(screen.getByRole('alert')).toHaveTextContent('No se pudo conectar');
		});
	});

	it('reintenta y se recupera cuando el backend vuelve a estar disponible', async () => {
		vi.useFakeTimers();
		const fetchMock = vi
			.fn()
			.mockRejectedValueOnce(new Error('red caída'))
			.mockResolvedValueOnce({
				ok: true,
				status: 200,
				text: () => Promise.resolve('Hello World'),
			});
		vi.stubGlobal('fetch', fetchMock);
		render(<HelloApi />);

		await act(async () => {
			await vi.advanceTimersByTimeAsync(0);
		});
		expect(screen.getByRole('alert')).toHaveTextContent('No se pudo conectar');

		await act(async () => {
			await vi.advanceTimersByTimeAsync(5_000);
		});
		expect(screen.getByRole('status')).toHaveTextContent('Mensaje del backend: Hello World');
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});
});
