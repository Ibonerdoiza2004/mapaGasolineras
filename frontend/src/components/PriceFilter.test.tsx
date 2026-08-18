import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import PriceFilter from './PriceFilter';
import { PRICE_FILTER_EVENT, PRICE_RANGE_EVENT } from '../lib/explorerEvents';

function emitRange(min: number, max: number) {
	act(() => {
		window.dispatchEvent(
			new CustomEvent(PRICE_RANGE_EVENT, { detail: { range: { min, max } } }),
		);
	});
}

describe('PriceFilter — slider de rango de precios', () => {
	afterEach(() => {
		document.body.innerHTML = '';
	});

	it('no se muestra hasta recibir el rango del dataset', () => {
		render(<PriceFilter />);
		expect(screen.queryByRole('slider')).toBeNull();
	});

	it('muestra dos asas con los extremos del rango del dataset', () => {
		render(<PriceFilter />);
		emitRange(1.4, 1.8);

		expect(screen.getByRole('slider', { name: 'Precio mínimo' })).toHaveValue('1.4');
		expect(screen.getByRole('slider', { name: 'Precio máximo' })).toHaveValue('1.8');
		expect(screen.getByText(/1,400 €\/l – 1,800 €\/l/)).toBeInTheDocument();
	});

	it('al mover el mínimo notifica el filtro sin pasarse del máximo', () => {
		const listener = vi.fn();
		window.addEventListener(PRICE_FILTER_EVENT, listener);
		render(<PriceFilter />);
		emitRange(1.4, 1.8);

		fireEvent.change(screen.getByRole('slider', { name: 'Precio mínimo' }), {
			target: { value: '1.6' },
		});

		expect(listener).toHaveBeenCalledWith(
			expect.objectContaining({ detail: { min: 1.6, max: 1.8 } }),
		);
		window.removeEventListener(PRICE_FILTER_EVENT, listener);
	});

	it('al mover el máximo por debajo del mínimo lo ajusta al mínimo', () => {
		const listener = vi.fn();
		window.addEventListener(PRICE_FILTER_EVENT, listener);
		render(<PriceFilter />);
		emitRange(1.4, 1.8);

		fireEvent.change(screen.getByRole('slider', { name: 'Precio máximo' }), {
			target: { value: '1.3' },
		});

		expect(listener).toHaveBeenCalledWith(
			expect.objectContaining({ detail: { min: 1.4, max: 1.401 } }),
		);
		window.removeEventListener(PRICE_FILTER_EVENT, listener);
	});

	it('mantiene la selección dentro del nuevo rango al cambiar el dataset', () => {
		render(<PriceFilter />);
		emitRange(1.4, 1.8);
		fireEvent.change(screen.getByRole('slider', { name: 'Precio mínimo' }), {
			target: { value: '1.5' },
		});

		emitRange(1.2, 1.6);

		expect(screen.getByRole('slider', { name: 'Precio mínimo' })).toHaveValue('1.5');
		expect(screen.getByRole('slider', { name: 'Precio máximo' })).toHaveValue('1.6');
	});

	it('se oculta si el nuevo rango es inválido', () => {
		render(<PriceFilter />);
		emitRange(1.4, 1.8);

		act(() => {
			window.dispatchEvent(
				new CustomEvent(PRICE_RANGE_EVENT, { detail: { range: { min: 2, max: 1 } } }),
			);
		});

		expect(screen.queryByRole('slider')).toBeNull();
	});
});
