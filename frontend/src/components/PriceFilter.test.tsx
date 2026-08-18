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

	it('el máximo llevado al extremo izquierdo puede volver a la derecha', () => {
		render(<PriceFilter />);
		emitRange(1.4, 1.8);

		// Se arrastra el máximo hasta la izquierda del todo: queda pegado al
		// mínimo y la asa activa pasa a ser la del máximo.
		fireEvent.change(screen.getByRole('slider', { name: 'Precio máximo' }), {
			target: { value: '1.4' },
		});
		expect(screen.getByRole('slider', { name: 'Precio máximo' })).toHaveValue('1.401');
		expect(screen.getByRole('slider', { name: 'Precio mínimo' })).toHaveValue('1.4');

		// La asa del máximo queda por encima de la del mínimo para poder
		// agarrarla de nuevo aunque estén solapadas.
		expect(screen.getByRole('slider', { name: 'Precio máximo' })).toHaveStyle('z-index: 4');

		// Se arrastra el máximo de vuelta a la derecha y sí se mueve.
		fireEvent.change(screen.getByRole('slider', { name: 'Precio máximo' }), {
			target: { value: '1.6' },
		});
		expect(screen.getByRole('slider', { name: 'Precio máximo' })).toHaveValue('1.6');
		expect(screen.getByRole('slider', { name: 'Precio mínimo' })).toHaveValue('1.4');
	});

	it('el mínimo llevado al extremo derecho conserva su asa por encima para volver', () => {
		render(<PriceFilter />);
		emitRange(1.4, 1.8);

		fireEvent.change(screen.getByRole('slider', { name: 'Precio mínimo' }), {
			target: { value: '1.8' },
		});
		expect(screen.getByRole('slider', { name: 'Precio mínimo' })).toHaveValue('1.799');
		expect(screen.getByRole('slider', { name: 'Precio máximo' })).toHaveValue('1.8');

		// Tras mover el mínimo, su asa queda encima y puede volver a la izquierda.
		expect(screen.getByRole('slider', { name: 'Precio mínimo' })).toHaveStyle('z-index: 4');

		fireEvent.change(screen.getByRole('slider', { name: 'Precio mínimo' }), {
			target: { value: '1.5' },
		});
		expect(screen.getByRole('slider', { name: 'Precio mínimo' })).toHaveValue('1.5');
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
