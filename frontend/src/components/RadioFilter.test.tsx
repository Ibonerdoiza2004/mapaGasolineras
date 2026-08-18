import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import RadioFilter from './RadioFilter';
import { RADIO_EVENT } from '../lib/explorerEvents';
import { LOCATION_CLEAR_EVENT, LOCATION_EVENT } from '../lib/geolocation';

const originalLocation = window.location.href;

beforeEach(() => {
	window.history.replaceState(null, '', '/explorar');
});

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
	window.history.replaceState(null, '', originalLocation);
});

function emitLocation() {
	act(() => {
		window.dispatchEvent(
			new CustomEvent(LOCATION_EVENT, { detail: { lat: 40.4168, lon: -3.7038, source: 'search' } }),
		);
	});
}

function scopeRadio() {
	return screen.getByRole('radio', { name: 'Radio de búsqueda' });
}

function mapScopeRadio() {
	return screen.getByRole('radio', { name: 'Área visible en el mapa' });
}

describe('RadioFilter — alcance de la búsqueda (mapa o radio)', () => {
	it('por defecto el alcance es el área visible y no muestra chips de kilómetros', () => {
		render(<RadioFilter />);

		expect(mapScopeRadio()).toHaveAttribute('aria-checked', 'true');
		expect(scopeRadio()).toHaveAttribute('aria-checked', 'false');
		expect(
			screen.queryByRole('radiogroup', { name: 'Radio en kilómetros' }),
		).not.toBeInTheDocument();
	});

	it('la opción de radio está deshabilitada sin una ubicación', () => {
		render(<RadioFilter />);

		expect(scopeRadio()).toBeDisabled();
	});

	it('sin ubicación no se puede cambiar al radio', () => {
		render(<RadioFilter />);

		act(() => {
			scopeRadio().click();
		});

		expect(scopeRadio()).toHaveAttribute('aria-checked', 'false');
		expect(
			screen.queryByRole('radiogroup', { name: 'Radio en kilómetros' }),
		).not.toBeInTheDocument();
	});

	it('al recibir una ubicación se activa el radio con 10 km por defecto', () => {
		const listener = vi.fn();
		window.addEventListener(RADIO_EVENT, listener);
		render(<RadioFilter />);

		emitLocation();

		expect(scopeRadio()).toHaveAttribute('aria-checked', 'true');
		const kmChips = screen.getAllByRole('radio', { name: /km/ });
		expect(kmChips.map((radio) => radio.textContent)).toEqual(['5 km', '10 km', '25 km', '50 km']);
		expect(screen.getByRole('radio', { name: '10 km' })).toHaveAttribute(
			'aria-checked',
			'true',
		);
		expect(new URL(window.location.href).searchParams.get('radio')).toBe('10');
		expect(listener).toHaveBeenCalledWith(expect.objectContaining({ detail: { radio: 10 } }));
		expect(screen.getByRole('status')).toHaveTextContent('Radio de búsqueda activado: 10 km');
		window.removeEventListener(RADIO_EVENT, listener);
	});

	it('recibir la ubicación en el modo radio mantiene el radio elegido', () => {
		window.history.replaceState(null, '', '/explorar?radio=50');
		const listener = vi.fn();
		window.addEventListener(RADIO_EVENT, listener);
		render(<RadioFilter />);

		emitLocation();

		expect(screen.getByRole('radio', { name: '50 km' })).toHaveAttribute(
			'aria-checked',
			'true',
		);
		// El radio ya estaba activo: la ubicación no añade otro evento de radio.
		expect(listener).not.toHaveBeenCalledWith(expect.objectContaining({ detail: { radio: 10 } }));
		window.removeEventListener(RADIO_EVENT, listener);
	});

	it('al elegir un radio lo refleja en la URL, notifica y anuncia', () => {
		const listener = vi.fn();
		window.addEventListener(RADIO_EVENT, listener);
		render(<RadioFilter />);
		emitLocation();

		act(() => {
			screen.getByRole('radio', { name: '50 km' }).click();
		});

		expect(screen.getByRole('radio', { name: '50 km' })).toHaveAttribute(
			'aria-checked',
			'true',
		);
		expect(new URL(window.location.href).searchParams.get('radio')).toBe('50');
		expect(listener).toHaveBeenCalledWith(expect.objectContaining({ detail: { radio: 50 } }));
		expect(screen.getByRole('status')).toHaveTextContent('Radio: 50 km');
		window.removeEventListener(RADIO_EVENT, listener);
	});

	it('volver al área visible quita el parámetro, notifica null, oculta los chips y descarta la ubicación', () => {
		window.history.replaceState(null, '', '/explorar?radio=25');
		const listener = vi.fn();
		const clearListener = vi.fn();
		window.addEventListener(RADIO_EVENT, listener);
		window.addEventListener(LOCATION_CLEAR_EVENT, clearListener);
		render(<RadioFilter />);
		emitLocation();

		act(() => {
			mapScopeRadio().click();
		});

		expect(mapScopeRadio()).toHaveAttribute('aria-checked', 'true');
		expect(new URL(window.location.href).searchParams.get('radio')).toBeNull();
		expect(listener).toHaveBeenCalledWith(expect.objectContaining({ detail: { radio: null } }));
		expect(clearListener).toHaveBeenCalled();
		expect(
			screen.queryByRole('radiogroup', { name: 'Radio en kilómetros' }),
		).not.toBeInTheDocument();
		window.removeEventListener(RADIO_EVENT, listener);
		window.removeEventListener(LOCATION_CLEAR_EVENT, clearListener);
	});

	it('notifica el valor restaurado desde la URL al hidratarse', async () => {
		window.history.replaceState(null, '', '/explorar?radio=50');
		const listener = vi.fn();
		window.addEventListener(RADIO_EVENT, listener);

		render(<RadioFilter />);

		await vi.waitFor(() => {
			expect(scopeRadio()).toHaveAttribute('aria-checked', 'true');
		});
		expect(screen.getByRole('radio', { name: '50 km' })).toHaveAttribute(
			'aria-checked',
			'true',
		);
		expect(listener).toHaveBeenCalledWith(expect.objectContaining({ detail: { radio: 50 } }));
		window.removeEventListener(RADIO_EVENT, listener);
	});

	it('un radio inválido en la URL deja el alcance en el mapa', async () => {
		window.history.replaceState(null, '', '/explorar?radio=7');
		const listener = vi.fn();
		window.addEventListener(RADIO_EVENT, listener);

		render(<RadioFilter />);

		await vi.waitFor(() => {
			expect(mapScopeRadio()).toHaveAttribute('aria-checked', 'true');
		});
		expect(listener).toHaveBeenCalledWith(expect.objectContaining({ detail: { radio: null } }));
		window.removeEventListener(RADIO_EVENT, listener);
	});

	it('sin ubicación las flechas del alcance no activan el radio', () => {
		render(<RadioFilter />);
		const group = screen.getByRole('radiogroup', { name: 'Alcance' });

		act(() => {
			group.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
		});

		expect(mapScopeRadio()).toHaveAttribute('aria-checked', 'true');
	});

	it('navega los kilómetros con las flechas y Home/End como radiogroup', () => {
		render(<RadioFilter />);
		emitLocation();
		const group = screen.getByRole('radiogroup', { name: 'Radio en kilómetros' });

		act(() => {
			group.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
		});
		expect(screen.getByRole('radio', { name: '25 km' })).toHaveAttribute('aria-checked', 'true');

		act(() => {
			group.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
		});
		expect(screen.getByRole('radio', { name: '50 km' })).toHaveAttribute('aria-checked', 'true');

		act(() => {
			group.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
		});
		expect(screen.getByRole('radio', { name: '5 km' })).toHaveAttribute('aria-checked', 'true');
	});

	it('rechaza seleccionar dos veces el mismo valor sin duplicar eventos', () => {
		render(<RadioFilter />);
		emitLocation();
		const listener = vi.fn();
		window.addEventListener(RADIO_EVENT, listener);

		act(() => {
			screen.getByRole('radio', { name: '10 km' }).click();
		});

		expect(listener).not.toHaveBeenCalled();
		window.removeEventListener(RADIO_EVENT, listener);
	});
});
