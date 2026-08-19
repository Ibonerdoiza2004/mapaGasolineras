import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import SortFilter from './SortFilter';
import { ORDEN_EVENT } from '../lib/explorerEvents';
import { dispatchUserLocation, LOCATION_EVENT, resetLastLocation } from '../lib/geolocation';

const originalLocation = window.location.href;

beforeEach(() => {
	resetLastLocation();
	window.history.replaceState(null, '', '/explorar');
});

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
	window.history.replaceState(null, '', originalLocation);
});

describe('SortFilter — ordenación de resultados', () => {
	it('por defecto ordena por precio y bloquea la cercanía sin ubicación', () => {
		render(<SortFilter />);

		expect(screen.getByRole('radio', { name: 'Más barato' })).toHaveAttribute(
			'aria-checked',
			'true',
		);
		expect(screen.getByRole('radio', { name: 'Más cercano' })).toBeDisabled();
		expect(screen.getByRole('radio', { name: 'Más cercano' })).toHaveAttribute(
			'aria-disabled',
			'true',
		);
		expect(screen.getByRole('radio', { name: 'Más cercano' })).toHaveAttribute(
			'title',
			'Activa tu ubicación o busca un lugar para ordenar por cercanía',
		);
	});

	it('habilita la cercanía al marcar una ubicación', () => {
		render(<SortFilter />);
		expect(screen.getByRole('radio', { name: 'Más cercano' })).toBeDisabled();

		act(() => {
			window.dispatchEvent(
				new CustomEvent(LOCATION_EVENT, { detail: { lat: 40.4168, lon: -3.7038, source: 'search' } }),
			);
		});

		expect(screen.getByRole('radio', { name: 'Más cercano' })).toBeEnabled();
	});

	it('al elegir un orden lo refleja en la URL, notifica y anuncia', () => {
		dispatchUserLocation(40.4168, -3.7038, 'search');
		const listener = vi.fn();
		window.addEventListener(ORDEN_EVENT, listener);
		render(<SortFilter />);

		act(() => {
			screen.getByRole('radio', { name: 'Más cercano' }).click();
		});

		expect(screen.getByRole('radio', { name: 'Más cercano' })).toHaveAttribute(
			'aria-checked',
			'true',
		);
		expect(new URL(window.location.href).searchParams.get('orden')).toBe('distancia');
		expect(listener).toHaveBeenCalledWith(
			expect.objectContaining({ detail: { orden: 'distancia' } }),
		);
		expect(screen.getByRole('status')).toHaveTextContent('Ordenar por Más cercano');
		window.removeEventListener(ORDEN_EVENT, listener);
	});

	it('notifica el orden restaurado desde la URL al hidratarse', async () => {
		dispatchUserLocation(40.4168, -3.7038, 'search');
		window.history.replaceState(null, '', '/explorar?orden=distancia');
		const listener = vi.fn();
		window.addEventListener(ORDEN_EVENT, listener);

		render(<SortFilter />);

		await vi.waitFor(() => {
			expect(screen.getByRole('radio', { name: 'Más cercano' })).toHaveAttribute(
				'aria-checked',
				'true',
			);
		});
		expect(listener).toHaveBeenCalledWith(
			expect.objectContaining({ detail: { orden: 'distancia' } }),
		);
		window.removeEventListener(ORDEN_EVENT, listener);
	});

	it('un orden por cercanía en la URL sin ubicación fuerza el precio', async () => {
		window.history.replaceState(null, '', '/explorar?orden=distancia');
		const listener = vi.fn();
		window.addEventListener(ORDEN_EVENT, listener);

		render(<SortFilter />);

		await vi.waitFor(() => {
			expect(screen.getByRole('radio', { name: 'Más barato' })).toHaveAttribute(
				'aria-checked',
				'true',
			);
		});
		expect(screen.getByRole('radio', { name: 'Más cercano' })).toBeDisabled();
		expect(new URL(window.location.href).searchParams.get('orden')).toBe('precio');
		expect(listener).toHaveBeenCalledWith(
			expect.objectContaining({ detail: { orden: 'precio' } }),
		);
		window.removeEventListener(ORDEN_EVENT, listener);
	});

	it('un orden inválido en la URL deja el valor por defecto', async () => {
		window.history.replaceState(null, '', '/explorar?orden=alfabetico');
		const listener = vi.fn();
		window.addEventListener(ORDEN_EVENT, listener);

		render(<SortFilter />);

		await vi.waitFor(() => {
			expect(screen.getByRole('radio', { name: 'Más barato' })).toHaveAttribute(
				'aria-checked',
				'true',
			);
		});
		expect(listener).toHaveBeenCalledWith(
			expect.objectContaining({ detail: { orden: 'precio' } }),
		);
		window.removeEventListener(ORDEN_EVENT, listener);
	});

	it('navega con las flechas y Home/End como radiogroup', () => {
		dispatchUserLocation(40.4168, -3.7038, 'search');
		render(<SortFilter />);
		const group = screen.getByRole('radiogroup', { name: 'Ordenar resultados' });

		act(() => {
			group.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
		});
		expect(screen.getByRole('radio', { name: 'Más cercano' })).toHaveAttribute(
			'aria-checked',
			'true',
		);

		act(() => {
			group.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
		});
		expect(screen.getByRole('radio', { name: 'Más cercano' })).toHaveAttribute(
			'aria-checked',
			'true',
		);

		act(() => {
			group.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
		});
		expect(screen.getByRole('radio', { name: 'Más barato' })).toHaveAttribute(
			'aria-checked',
			'true',
		);
	});

	it('sin ubicación las flechas se quedan en el único orden disponible', () => {
		render(<SortFilter />);
		const group = screen.getByRole('radiogroup', { name: 'Ordenar resultados' });

		act(() => {
			group.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
		});
		expect(screen.getByRole('radio', { name: 'Más barato' })).toHaveAttribute(
			'aria-checked',
			'true',
		);
	});

	it('rechaza seleccionar dos veces el mismo valor sin duplicar eventos', () => {
		render(<SortFilter />);
		const listener = vi.fn();
		window.addEventListener(ORDEN_EVENT, listener);

		act(() => {
			screen.getByRole('radio', { name: 'Más barato' }).click();
		});

		expect(listener).not.toHaveBeenCalled();
		window.removeEventListener(ORDEN_EVENT, listener);
	});
});
