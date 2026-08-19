import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import BrandFilter from './BrandFilter';
import { MARCAS_EVENT } from '../lib/explorerEvents';
import { fetchBrands } from '../lib/stations';

vi.mock('../lib/stations', () => ({
	fetchBrands: vi.fn(),
}));

const CATALOG = [
	{ code: 'repsol', label: 'Repsol', count: 42 },
	{ code: 'cepsa', label: 'Cepsa', count: 7 },
	{ code: 'otras', label: 'Otras marcas', count: 91 },
];

const originalLocation = window.location.href;

beforeEach(() => {
	window.history.replaceState(null, '', '/explorar');
	vi.mocked(fetchBrands).mockResolvedValue(CATALOG);
});

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
	window.history.replaceState(null, '', originalLocation);
});

function openFilter() {
	act(() => {
		screen.getByText('Filtrar por marca').click();
	});
}

describe('BrandFilter — filtro por marca', () => {
	it('sin catálogo (fallo del backend) no renderiza nada', async () => {
		vi.mocked(fetchBrands).mockResolvedValue([]);

		const { container } = render(<BrandFilter />);

		await vi.waitFor(() => {
			expect(fetchBrands).toHaveBeenCalled();
		});
		expect(container).toBeEmptyDOMElement();
	});

	it('muestra el acordeón plegado con el catálogo al abrirlo', async () => {
		render(<BrandFilter />);

		await vi.waitFor(() => {
			expect(screen.getByText('Filtrar por marca')).toBeInTheDocument();
		});
		// Plegado por defecto: el contenido no se renderiza, así que no hay
		// etiquetas ocultas en el DOM (el auditor de Astro las marcaría).
		const summary = screen.getByRole('button', { name: /Filtrar por marca/ });
		expect(summary).toHaveAttribute('aria-expanded', 'false');
		expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();

		openFilter();

		expect(summary).toHaveAttribute('aria-expanded', 'true');
		expect(screen.getAllByRole('checkbox')).toHaveLength(3);
		expect(screen.getByRole('checkbox', { name: /Repsol/ })).toBeInTheDocument();
		expect(screen.getByRole('checkbox', { name: /Otras marcas/ })).toBeInTheDocument();
		expect(screen.getByText('91')).toBeInTheDocument();
	});

	it('al cerrar el acordeón retira las casillas del DOM', async () => {
		render(<BrandFilter />);
		await vi.waitFor(() => expect(screen.getByText('Filtrar por marca')).toBeInTheDocument());
		openFilter();
		expect(screen.getAllByRole('checkbox')).toHaveLength(3);

		act(() => {
			screen.getByRole('button', { name: /Filtrar por marca/ }).click();
		});

		expect(screen.getByRole('button', { name: /Filtrar por marca/ })).toHaveAttribute(
			'aria-expanded',
			'false',
		);
		expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
	});

	it('al marcar una marca la refleja en la URL, notifica y anuncia', async () => {
		const listener = vi.fn();
		window.addEventListener(MARCAS_EVENT, listener);
		render(<BrandFilter />);
		await vi.waitFor(() => expect(screen.getByText('Filtrar por marca')).toBeInTheDocument());
		openFilter();

		act(() => {
			screen.getByRole('checkbox', { name: /Repsol/ }).click();
		});

		expect(new URL(window.location.href).searchParams.get('marcas')).toBe('repsol');
		expect(listener).toHaveBeenCalledWith(
			expect.objectContaining({ detail: { marcas: ['repsol'] } }),
		);
		expect(screen.getByRole('status')).toHaveTextContent('Filtro por marca: Repsol');
		window.removeEventListener(MARCAS_EVENT, listener);
	});

	it('al desmarcar la última marca limpia el parámetro y notifica sin filtro', async () => {
		window.history.replaceState(null, '', '/explorar?marcas=repsol');
		const listener = vi.fn();
		window.addEventListener(MARCAS_EVENT, listener);
		render(<BrandFilter />);
		await vi.waitFor(() => expect(screen.getByText('Filtrar por marca')).toBeInTheDocument());
		openFilter();

		act(() => {
			screen.getByRole('checkbox', { name: /Repsol/ }).click();
		});

		expect(new URL(window.location.href).searchParams.get('marcas')).toBeNull();
		expect(listener).toHaveBeenCalledWith(expect.objectContaining({ detail: { marcas: [] } }));
		expect(screen.getByRole('status')).toHaveTextContent('Repsol desactivado');
		window.removeEventListener(MARCAS_EVENT, listener);
	});

	it('restaura la selección de la URL al hidratarse y la notifica', async () => {
		window.history.replaceState(null, '', '/explorar?marcas=repsol,otras');
		const listener = vi.fn();
		window.addEventListener(MARCAS_EVENT, listener);
		render(<BrandFilter />);

		await vi.waitFor(() => {
			expect(listener).toHaveBeenCalledWith(
				expect.objectContaining({ detail: { marcas: ['repsol', 'otras'] } }),
			);
		});
		openFilter();
		expect(screen.getByRole('checkbox', { name: /Repsol/ })).toBeChecked();
		expect(screen.getByRole('checkbox', { name: /Otras marcas/ })).toBeChecked();
		expect(screen.getByRole('checkbox', { name: /Cepsa/ })).not.toBeChecked();
		window.removeEventListener(MARCAS_EVENT, listener);
	});

	it('descarta códigos de la URL que ya no están en el catálogo', async () => {
		window.history.replaceState(null, '', '/explorar?marcas=repsol,mitica');
		const listener = vi.fn();
		window.addEventListener(MARCAS_EVENT, listener);
		render(<BrandFilter />);

		await vi.waitFor(() => {
			expect(listener).toHaveBeenCalledWith(
				expect.objectContaining({ detail: { marcas: ['repsol'] } }),
			);
		});
		openFilter();
		expect(screen.getAllByRole('checkbox')).toHaveLength(3);
		expect(screen.queryByRole('checkbox', { name: /Mitica/ })).not.toBeInTheDocument();
		window.removeEventListener(MARCAS_EVENT, listener);
	});

	it('el recuento de marcas activas se muestra y se actualiza', async () => {
		window.history.replaceState(null, '', '/explorar?marcas=repsol');
		render(<BrandFilter />);

		await vi.waitFor(() => {
			expect(screen.getByLabelText('1 marcas activas')).toBeInTheDocument();
		});
		openFilter();
		act(() => {
			screen.getByRole('checkbox', { name: /Cepsa/ }).click();
		});
		expect(screen.getByLabelText('2 marcas activas')).toBeInTheDocument();
	});

	it('al abrir el acordeón refresca los conteos del catálogo', async () => {
		render(<BrandFilter />);
		await vi.waitFor(() => expect(screen.getByText('Filtrar por marca')).toBeInTheDocument());
		expect(fetchBrands).toHaveBeenCalledTimes(1);

		const updated = CATALOG.map((brand) =>
			brand.code === 'repsol' ? { ...brand, count: 150 } : brand,
		);
		vi.mocked(fetchBrands).mockResolvedValue(updated);

		openFilter();

		await vi.waitFor(() => {
			expect(fetchBrands).toHaveBeenCalledTimes(2);
		});
		// El refresco es asíncrono: se espera a que el nuevo conteo llegue al DOM.
		await vi.waitFor(() => expect(screen.getByText('150')).toBeInTheDocument());
	});

	it('el buscador filtra las marcas por nombre y las restaura al borrar', async () => {
		render(<BrandFilter />);
		await vi.waitFor(() => expect(screen.getByText('Filtrar por marca')).toBeInTheDocument());
		openFilter();

		const search = screen.getByRole('searchbox', { name: 'Buscar marca' });
		expect(screen.getAllByRole('checkbox')).toHaveLength(3);

		act(() => {
			search.focus();
			fireEvent.change(search, { target: { value: 'reps' } });
		});

		expect(screen.getAllByRole('checkbox')).toHaveLength(1);
		expect(screen.getByRole('checkbox', { name: /Repsol/ })).toBeInTheDocument();
		expect(screen.queryByRole('checkbox', { name: /Cepsa/ })).not.toBeInTheDocument();

		act(() => {
			fireEvent.change(search, { target: { value: '' } });
		});

		expect(screen.getAllByRole('checkbox')).toHaveLength(3);
	});

	it('sin coincidencias en el buscador muestra un mensaje y oculta la lista', async () => {
		render(<BrandFilter />);
		await vi.waitFor(() => expect(screen.getByText('Filtrar por marca')).toBeInTheDocument());
		openFilter();

		act(() => {
			fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar marca' }), {
				target: { value: 'zzzz' },
			});
		});

		expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
		expect(screen.getByText(/No hay marcas que coincidan con «zzzz»/)).toBeInTheDocument();
	});
});