import { afterEach, describe, expect, it, vi } from 'vitest';

import { getUrlParam, setUrlParam } from './urlState';

const originalLocation = window.location.href;
const originalReplaceState = window.history.replaceState;

afterEach(() => {
	window.history.replaceState(null, '', originalLocation);
	vi.restoreAllMocks();
});

describe('urlState — parámetros de la URL', () => {
	it('lee un parámetro presente', () => {
		window.history.replaceState(null, '', '/explorar?combustible=GASOLINA_98&radio=10');

		expect(getUrlParam('combustible')).toBe('GASOLINA_98');
		expect(getUrlParam('radio')).toBe('10');
	});

	it('devuelve null para un parámetro ausente', () => {
		window.history.replaceState(null, '', '/explorar');

		expect(getUrlParam('combustible')).toBeNull();
	});

	it('escribe un parámetro nuevo conservando los existentes', () => {
		window.history.replaceState(null, '', '/explorar?radio=25');

		setUrlParam('combustible', 'GASOLINA_95');

		const url = new URL(window.location.href);
		expect(url.searchParams.get('combustible')).toBe('GASOLINA_95');
		expect(url.searchParams.get('radio')).toBe('25');
	});

	it('sustituye el valor de un parámetro existente', () => {
		window.history.replaceState(null, '', '/explorar?combustible=DIESEL');

		setUrlParam('combustible', 'GASOLINA_98');

		const url = new URL(window.location.href);
		expect(url.searchParams.get('combustible')).toBe('GASOLINA_98');
		expect(url.searchParams.size).toBe(1);
	});

	it('un valor null elimina el parámetro (sin filtro)', () => {
		window.history.replaceState(null, '', '/explorar?radio=10&combustible=DIESEL');

		setUrlParam('radio', null);

		const url = new URL(window.location.href);
		expect(url.searchParams.get('radio')).toBeNull();
		expect(url.searchParams.get('combustible')).toBe('DIESEL');
	});

	it('usa replaceState, no pushState, para no ensuciar el historial', () => {
		const replaceState = vi.spyOn(window.history, 'replaceState');

		setUrlParam('combustible', 'DIESEL');

		expect(replaceState).toHaveBeenCalledOnce();
		expect(originalReplaceState).toBeDefined();
	});

	it('devuelve null sin window (renderizado del lado del servidor)', () => {
		const originalWindow = globalThis.window;
		Object.defineProperty(globalThis, 'window', { value: undefined, configurable: true });

		try {
			expect(getUrlParam('combustible')).toBeNull();
		} finally {
			Object.defineProperty(globalThis, 'window', {
				value: originalWindow,
				configurable: true,
			});
		}
	});
});