import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import StationDetail from './StationDetail';
import { FUEL_EVENT, STATION_DETAIL_EVENT } from '../lib/explorerEvents';

vi.mock('../config/runtime', () => ({
	apiUrl: (path: string) => 'https://api.test' + path,
}));

function detailBody(overrides: Record<string, unknown> = {}) {
	return {
		id: 's1',
		rotulo: 'REPSOL Norte',
		direccion: 'Av. de la Industria, 24',
		codigoPostal: '28001',
		localidad: 'Madrid',
		municipio: 'Madrid',
		provincia: 'Madrid',
		latitud: 40.426,
		longitud: -3.7038,
		horario: 'L-D: 06:00-22:00',
		tipoVenta: 'P',
		margen: 'D',
		precios: { DIESEL: 1.459, GASOLINA_95: 1.599, GASOLINA_98: 1.699 },
		fechaActualizacion: new Date().toISOString(),
		...overrides,
	};
}

function jsonResponse(body: unknown) {
	return {
		ok: true,
		status: 200,
		json: () => Promise.resolve(body),
	} as Response;
}

function select(id: string) {
	act(() => {
		window.dispatchEvent(new CustomEvent(STATION_DETAIL_EVENT, { detail: { id } }));
	});
}

describe('StationDetail — ficha de la estación', () => {
	afterEach(() => {
		vi.restoreAllMocks();
		document.body.innerHTML = '';
	});

	it('no se muestra hasta seleccionar una estación', () => {
		render(<StationDetail />);
		expect(screen.queryByRole('dialog')).toBeNull();
	});

	it('resalta y ordena primero el combustible seleccionado', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(detailBody())));
		render(<StationDetail />);

		act(() => {
			window.dispatchEvent(
				new CustomEvent(FUEL_EVENT, { detail: { combustible: 'GASOLINA_95' } }),
			);
		});
		select('s1');
		await screen.findByText('REPSOL Norte');

		const prices = screen.getAllByRole('listitem');
		expect(prices[0]).toHaveTextContent('Gasolina 95');
		expect(prices[0]).toHaveClass('station-detail__price--active');
		expect(prices[1]).not.toHaveClass('station-detail__price--active');
	});

	it('al seleccionar consulta la ficha y muestra precios, horario y dirección', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(detailBody())));
		render(<StationDetail />);

		select('s1');

		expect(screen.getByRole('dialog')).toBeInTheDocument();
		await screen.findByText('REPSOL Norte');
		expect(screen.getByText('Diésel')).toBeInTheDocument();
		expect(screen.getByText('1,459 €/l')).toBeInTheDocument();
		expect(screen.getByText('1,599 €/l')).toBeInTheDocument();
		expect(screen.getByText('1,699 €/l')).toBeInTheDocument();
		expect(screen.getByText('L-D: 06:00-22:00')).toBeInTheDocument();
		expect(screen.getByText(/Av\. de la Industria/)).toBeInTheDocument();
	});

	it('el enlace de indicaciones apunta a Google Maps con las coordenadas', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(detailBody())));
		render(<StationDetail />);

		select('s1');
		const link = await screen.findByRole('link', { name: /Cómo llegar/ });

		expect(link).toHaveAttribute(
			'href',
			'https://www.google.com/maps/dir/?api=1&destination=40.426,-3.7038&travelmode=driving',
		);
		expect(link).toHaveAttribute('target', '_blank');
		expect(link).toHaveAttribute('rel', 'noopener noreferrer');
	});

	it('muestra error recuperable y Reintentar vuelve a consultar', async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce({ ok: false, status: 500 } as Response)
			.mockResolvedValueOnce(jsonResponse(detailBody()));
		vi.stubGlobal('fetch', fetchMock);
		render(<StationDetail />);

		select('s1');
		await screen.findByRole('alert');
		expect(screen.getByText(/No se pudo cargar la ficha/)).toBeInTheDocument();

		screen.getByRole('button', { name: 'Reintentar' }).click();
		await waitFor(() => expect(screen.getByText('REPSOL Norte')).toBeInTheDocument());
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it('cerrar deselecciona y oculta la ficha', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(detailBody())));
		render(<StationDetail />);
		select('s1');
		await screen.findByRole('dialog');

		fireEvent.click(screen.getByRole('button', { name: 'Cerrar ficha' }));

		expect(screen.queryByRole('dialog')).toBeNull();
	});

	it('la tecla Escape cierra la ficha', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(detailBody())));
		render(<StationDetail />);
		select('s1');
		await screen.findByRole('dialog');

		act(() => {
			window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
		});

		expect(screen.queryByRole('dialog')).toBeNull();
	});

	it('sin precios muestra un aviso en lugar de la lista', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(jsonResponse(detailBody({ precios: {} }))),
		);
		render(<StationDetail />);

		select('s1');
		await screen.findByText('No hay precios disponibles para esta estación.');
	});

	it('marca la fecha de actualización cuando los precios son antiguos', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(jsonResponse(detailBody({ fechaActualizacion: '2026-01-01T10:00:00Z' }))),
		);
		render(<StationDetail />);

		select('s1');
		const fact = await screen.findByText('Precios actualizados');
		expect(fact.nextElementSibling).toHaveClass('station-detail__stale');
	});

	it('oculta las indicaciones si faltan coordenadas', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(
				jsonResponse(detailBody({ latitud: Number.NaN, longitud: Number.NaN })),
			),
		);
		render(<StationDetail />);

		select('s1');
		await screen.findByRole('heading', { name: 'REPSOL Norte' });
		expect(screen.queryByRole('link', { name: /Cómo llegar/ })).toBeNull();
	});
});
