import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import LocationButton from './LocationButton';
import { LOCATION_EVENT } from '../lib/geolocation';

function geolocationMock(
	implementation: Partial<Geolocation> = {},
): { getCurrentPosition: ReturnType<typeof vi.fn> } {
	const getCurrentPosition = vi.fn();
	const geolocation = {
		getCurrentPosition,
		watchPosition: vi.fn(),
		clearWatch: vi.fn(),
		...implementation,
	} as Geolocation;
	vi.stubGlobal('navigator', { ...navigator, geolocation });
	return { getCurrentPosition };
}

function position(latitude: number, longitude: number) {
	return { coords: { latitude, longitude, accuracy: 10 } } as GeolocationPosition;
}

describe('LocationButton', () => {
	beforeEach(() => {
		vi.unstubAllGlobals();
		document.body.innerHTML = '<input id="explorer-search" type="search" />';
	});

	afterEach(() => {
		cleanup();
		vi.unstubAllGlobals();
	});

	it('no solicita la ubicación hasta que el usuario pulsa el botón', () => {
		const { getCurrentPosition } = geolocationMock();

		render(<LocationButton />);
		expect(getCurrentPosition).not.toHaveBeenCalled();

		fireEvent.click(screen.getByRole('button', { name: 'Usar mi ubicación' }));
		expect(getCurrentPosition).toHaveBeenCalledTimes(1);
	});

	it('notifica la ubicación válida y muestra confirmación al concederse el permiso', () => {
		geolocationMock();
		const listener = vi.fn();
		window.addEventListener(LOCATION_EVENT, listener);

		render(<LocationButton />);
		fireEvent.click(screen.getByRole('button', { name: 'Usar mi ubicación' }));

		const getCurrentPosition = navigator.geolocation
			.getCurrentPosition as unknown as ReturnType<typeof vi.fn>;
		const success = getCurrentPosition.mock.calls[0][0] as (pos: GeolocationPosition) => void;
		act(() => success(position(40.4168, -3.7038)));

		expect(listener).toHaveBeenCalledTimes(1);
		const event = listener.mock.calls[0][0] as CustomEvent<{ lat: number; lon: number }>;
		expect(event.detail).toEqual({ lat: 40.4168, lon: -3.7038 });
		expect(screen.getByRole('status')).toHaveTextContent(
			'Gasolineras actualizadas a tu ubicación.',
		);
	});

	it('marca el botón como ocupado mientras se espera la respuesta', () => {
		geolocationMock();

		render(<LocationButton />);
		fireEvent.click(screen.getByRole('button', { name: 'Usar mi ubicación' }));

		const button = screen.getByRole('button', { name: 'Obteniendo ubicación…' });
		expect(button).toBeDisabled();
		expect(button).toHaveAttribute('aria-busy', 'true');
	});

	it('rechaza coordenadas fuera de rango sin notificar y muestra error', () => {
		const { getCurrentPosition } = geolocationMock();
		const listener = vi.fn();
		window.addEventListener(LOCATION_EVENT, listener);

		render(<LocationButton />);
		fireEvent.click(screen.getByRole('button', { name: 'Usar mi ubicación' }));

		const success = getCurrentPosition.mock.calls[0][0] as (pos: GeolocationPosition) => void;
		act(() => success(position(120, -3.7)));

		expect(listener).not.toHaveBeenCalled();
		expect(screen.getByRole('alert')).toHaveTextContent('no es válida');
	});

	it('muestra la alternativa de búsqueda manual al denegarse el permiso', () => {
		const { getCurrentPosition } = geolocationMock();

		render(<LocationButton />);
		fireEvent.click(screen.getByRole('button', { name: 'Usar mi ubicación' }));

		const error = getCurrentPosition.mock.calls[0][1] as (err: { code: number }) => void;
		act(() => error({ code: 1 }));

		const alert = screen.getByRole('alert');
		expect(alert).toHaveTextContent('No podemos acceder a tu ubicación.');
		expect(alert).toHaveTextContent('Puedes buscar una ciudad, dirección o código postal.');
	});

	it('muestra un mensaje específico cuando la solicitud agota el tiempo', () => {
		const { getCurrentPosition } = geolocationMock();

		render(<LocationButton />);
		fireEvent.click(screen.getByRole('button', { name: 'Usar mi ubicación' }));

		const error = getCurrentPosition.mock.calls[0][1] as (err: { code: number }) => void;
		act(() => error({ code: 3 }));

		expect(screen.getByRole('alert')).toHaveTextContent('Tardamos demasiado');
	});

	it('muestra un mensaje cuando la ubicación no está disponible', () => {
		const { getCurrentPosition } = geolocationMock();

		render(<LocationButton />);
		fireEvent.click(screen.getByRole('button', { name: 'Usar mi ubicación' }));

		const error = getCurrentPosition.mock.calls[0][1] as (err: { code: number }) => void;
		act(() => error({ code: 2 }));

		expect(screen.getByRole('alert')).toHaveTextContent('No se pudo obtener la ubicación');
	});

	it('informa cuando el navegador no soporta geolocalización', () => {
		vi.stubGlobal('navigator', { ...navigator, geolocation: undefined });

		render(<LocationButton />);
		fireEvent.click(screen.getByRole('button', { name: 'Usar mi ubicación' }));

		expect(screen.getByRole('alert')).toHaveTextContent(
			'Este navegador no permite compartir la ubicación.',
		);
	});

	it('no lanza errores cuando la geolocalización está ausente del navegador', () => {
		const withoutGeolocation = { ...navigator } as Navigator;
		vi.stubGlobal('navigator', withoutGeolocation);

		render(<LocationButton />);
		fireEvent.click(screen.getByRole('button', { name: 'Usar mi ubicación' }));

		expect(screen.getByRole('alert')).toHaveTextContent(
			'Este navegador no permite compartir la ubicación.',
		);
	});

	it('el enlace de búsqueda manual enfoca el campo de ubicación', () => {
		const { getCurrentPosition } = geolocationMock();

		render(<LocationButton />);
		fireEvent.click(screen.getByRole('button', { name: 'Usar mi ubicación' }));

		const error = getCurrentPosition.mock.calls[0][1] as (err: { code: number }) => void;
		act(() => error({ code: 1 }));

		fireEvent.click(screen.getByRole('button', { name: 'Buscar por ciudad o código postal' }));
		expect(document.getElementById('explorer-search')).toHaveFocus();
	});

	it('permite reintentar tras un fallo', () => {
		const { getCurrentPosition } = geolocationMock();

		render(<LocationButton />);
		fireEvent.click(screen.getByRole('button', { name: 'Usar mi ubicación' }));
		const error = getCurrentPosition.mock.calls[0][1] as (err: { code: number }) => void;
		act(() => error({ code: 2 }));

		fireEvent.click(screen.getByRole('button', { name: 'Usar mi ubicación' }));
		expect(getCurrentPosition).toHaveBeenCalledTimes(2);
	});
});