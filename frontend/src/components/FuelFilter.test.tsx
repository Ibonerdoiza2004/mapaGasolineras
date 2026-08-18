import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import FuelFilter from './FuelFilter';
import { FUEL_EVENT } from '../lib/explorerEvents';

const originalLocation = window.location.href;

function goto(url: string) {
	window.history.replaceState(null, '', url);
}

function currentUrl(): URL {
	return new URL(window.location.href);
}

afterEach(() => {
	window.history.replaceState(null, '', originalLocation);
	vi.restoreAllMocks();
});

describe('FuelFilter — chips de combustible', () => {
	it('muestra los tres combustibles con el diésel marcado por defecto', () => {
		render(<FuelFilter />);

		const group = screen.getByRole('radiogroup', { name: 'Combustible' });
		expect(group).toBeInTheDocument();

		const radios = screen.getAllByRole('radio');
		expect(radios).toHaveLength(3);
		expect(screen.getByRole('radio', { name: 'Diésel' })).toHaveAttribute(
			'aria-checked',
			'true',
		);
		expect(screen.getByRole('radio', { name: 'Gasolina 95' })).toHaveAttribute(
			'aria-checked',
			'false',
		);
		expect(screen.getByRole('radio', { name: 'Gasolina 98' })).toHaveAttribute(
			'aria-checked',
			'false',
		);
	});

	it('restaura el combustible desde la URL al cargar', () => {
		goto('/explorar?combustible=GASOLINA_98');

		render(<FuelFilter />);

		expect(screen.getByRole('radio', { name: 'Gasolina 98' })).toHaveAttribute(
			'aria-checked',
			'true',
		);
		expect(screen.getByRole('radio', { name: 'Diésel' })).toHaveAttribute(
			'aria-checked',
			'false',
		);
	});

	it('ignora un combustible desconocido en la URL y usa el predeterminado', () => {
		goto('/explorar?combustible=HIDROGENO');

		render(<FuelFilter />);

		expect(screen.getByRole('radio', { name: 'Diésel' })).toHaveAttribute(
			'aria-checked',
			'true',
		);
	});

	it('notifica el combustible restaurado al montar para el listado', () => {
		goto('/explorar?combustible=GASOLINA_95');
		const listener = vi.fn();
		window.addEventListener(FUEL_EVENT, listener);

		render(<FuelFilter />);

		expect(listener).toHaveBeenCalledOnce();
		const event = listener.mock.calls[0][0] as CustomEvent<{ combustible: string }>;
		expect(event.detail.combustible).toBe('GASOLINA_95');
		window.removeEventListener(FUEL_EVENT, listener);
	});

	it('seleccionar un chip actualiza la URL, notifica el evento y anuncia el cambio', () => {
		render(<FuelFilter />);
		const listener = vi.fn();
		window.addEventListener(FUEL_EVENT, listener);

		fireEvent.click(screen.getByRole('radio', { name: 'Gasolina 98' }));

		expect(currentUrl().searchParams.get('combustible')).toBe('GASOLINA_98');
		expect(screen.getByRole('radio', { name: 'Gasolina 98' })).toHaveAttribute(
			'aria-checked',
			'true',
		);
		expect(listener).toHaveBeenCalledOnce();
		const event = listener.mock.calls[0][0] as CustomEvent<{ combustible: string }>;
		expect(event.detail.combustible).toBe('GASOLINA_98');
		expect(screen.getByRole('status')).toHaveTextContent('Combustible: Gasolina 98');
		window.removeEventListener(FUEL_EVENT, listener);
	});

	it('hacer clic en el chip ya seleccionado no vuelve a notificar', () => {
		render(<FuelFilter />);
		const listener = vi.fn();
		window.addEventListener(FUEL_EVENT, listener);

		fireEvent.click(screen.getByRole('radio', { name: 'Diésel' }));

		expect(listener).not.toHaveBeenCalled();
		window.removeEventListener(FUEL_EVENT, listener);
	});

	it('se opera con las flechas del teclado y mueve el foco', () => {
		render(<FuelFilter />);

		const diesel = screen.getByRole('radio', { name: 'Diésel' });
		const gasoline95 = screen.getByRole('radio', { name: 'Gasolina 95' });

		diesel.focus();
		fireEvent.keyDown(diesel, { key: 'ArrowRight' });

		expect(gasoline95).toHaveAttribute('aria-checked', 'true');
		expect(gasoline95).toHaveFocus();
		expect(currentUrl().searchParams.get('combustible')).toBe('GASOLINA_95');
	});

	it('las flechas se desplazan en bucle y Home/End saltan a los extremos', () => {
		render(<FuelFilter />);
		const group = screen.getByRole('radiogroup', { name: 'Combustible' });
		const gasoline98 = screen.getByRole('radio', { name: 'Gasolina 98' });

		fireEvent.keyDown(group, { key: 'End' });
		expect(gasoline98).toHaveAttribute('aria-checked', 'true');

		fireEvent.keyDown(group, { key: 'ArrowRight' });
		expect(screen.getByRole('radio', { name: 'Diésel' })).toHaveAttribute(
			'aria-checked',
			'true',
		);

		fireEvent.keyDown(group, { key: 'Home' });
		expect(screen.getByRole('radio', { name: 'Diésel' })).toHaveAttribute(
			'aria-checked',
			'true',
		);
	});

	it('solo hay un punto de tabulación en el grupo', () => {
		render(<FuelFilter />);

		expect(screen.getByRole('radio', { name: 'Diésel' })).toHaveAttribute('tabindex', '0');
		expect(screen.getByRole('radio', { name: 'Gasolina 95' })).toHaveAttribute('tabindex', '-1');
		expect(screen.getByRole('radio', { name: 'Gasolina 98' })).toHaveAttribute('tabindex', '-1');
	});
});