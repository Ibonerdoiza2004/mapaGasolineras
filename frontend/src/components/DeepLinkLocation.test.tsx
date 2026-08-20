import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { LOCATION_EVENT } from '../lib/geolocation';
import DeepLinkLocation from './DeepLinkLocation';

describe('DeepLinkLocation', () => {
	const originalLocation = window.location;
	const originalHistoryReplaceState = window.history.replaceState;

	function setSearch(search: string) {
		Object.defineProperty(window, 'location', {
			configurable: true,
			value: new URL(`http://localhost/${search}`),
		});
	}

	function captureLocationEvent() {
		let detail: { lat: number; lon: number } | null = null;
		const listener = vi.fn((event: Event) => {
			detail = (event as CustomEvent<{ lat: number; lon: number }>).detail;
		});
		window.addEventListener(LOCATION_EVENT, listener);
		return { listener, get detail() {
			return detail;
		} };
	}

	beforeEach(() => {
		window.history.replaceState = vi.fn();
	});

	afterEach(() => {
		cleanup();
		Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
		window.history.replaceState = originalHistoryReplaceState;
	});

	it('dispara la ubicación con coordenadas válidas dentro de España', () => {
		setSearch('?lugar=Albacete&lat=38.994&lon=-1.858');
		const captured = captureLocationEvent();

		render(<DeepLinkLocation />);

		expect(captured.listener).toHaveBeenCalledTimes(1);
		expect(captured.detail).toEqual({ lat: 38.994, lon: -1.858, source: 'search' });
	});

	it('limpia los parámetros de aterrizaje tras aplicarlos', () => {
		setSearch('?lugar=Albacete&lat=38.994&lon=-1.858');
		render(<DeepLinkLocation />);

		expect(window.history.replaceState).toHaveBeenCalledWith(
			null,
			'',
			expect.not.stringContaining('lat=') as unknown as string,
		);
		const url = (window.history.replaceState as ReturnType<typeof vi.fn>).mock.calls[0][2] as string;
		expect(url).not.toContain('lat=');
		expect(url).not.toContain('lon=');
		expect(url).not.toContain('lugar=');
	});

	it('no dispara ubicación si faltan las coordenadas', () => {
		setSearch('?lugar=Albacete');
		const { listener } = captureLocationEvent();

		render(<DeepLinkLocation />);

		expect(listener).not.toHaveBeenCalled();
	});

	it('no dispara ubicación con coordenadas fuera de España', () => {
		setSearch('?lat=52.5&lon=13.4');
		const { listener } = captureLocationEvent();

		render(<DeepLinkLocation />);

		expect(listener).not.toHaveBeenCalled();
	});

	it('no dispara ubicación con coordenadas no numéricas', () => {
		setSearch('?lat=abc&lon=-1.858');
		const { listener } = captureLocationEvent();

		render(<DeepLinkLocation />);

		expect(listener).not.toHaveBeenCalled();
	});

	it('solo aplica el aterrizaje una vez', () => {
		setSearch('?lat=38.994&lon=-1.858');
		const { listener } = captureLocationEvent();

		const { rerender } = render(<DeepLinkLocation />);
		rerender(<DeepLinkLocation />);

		expect(listener).toHaveBeenCalledTimes(1);
	});
});