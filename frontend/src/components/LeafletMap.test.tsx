import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import LeafletMap, { type MapStation } from './LeafletMap';

const { leafletMock, markerInstance } = vi.hoisted(() => {
	const mapInstance = { remove: vi.fn() };
	const markerInstance = {
		addTo: vi.fn(() => markerInstance),
		on: vi.fn(),
		remove: vi.fn(),
	};
	const tileLayerInstance = { addTo: vi.fn() };
	const zoomControlInstance = { addTo: vi.fn() };
	return {
		markerInstance,
		zoomControlInstance,
		leafletMock: {
			map: vi.fn(() => mapInstance),
			tileLayer: vi.fn(() => tileLayerInstance),
			marker: vi.fn(() => markerInstance),
			divIcon: vi.fn(() => ({})),
			control: { zoom: vi.fn(() => zoomControlInstance) },
		},
	};
});

vi.mock('leaflet', () => ({ default: leafletMock }));

const stations: MapStation[] = [
	{ id: '1', lat: 40.4168, lon: -3.7038, rotulo: 'REPSOL', price: 1.599, isBest: true },
	{ id: '2', lat: 40.4178, lon: -3.7048, rotulo: 'CEPSA', price: 1.65 },
];

describe('LeafletMap', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		cleanup();
	});

	it('inicializa el mapa y añade la capa de teselas de OpenStreetMap', async () => {
		render(<LeafletMap stations={stations} center={[40.4168, -3.7038]} zoom={13} />);

		await waitFor(() => expect(leafletMock.map).toHaveBeenCalledTimes(1));
		const [container, options] = leafletMock.map.mock.calls[0] as unknown as [
			HTMLElement,
			{
				center: [number, number];
				zoom: number;
				zoomControl: boolean;
				minZoom: number;
				maxZoom: number;
			},
		];
		expect(options.center).toEqual([40.4168, -3.7038]);
		expect(options.zoom).toBe(13);
		expect(options.zoomControl).toBe(false);
		expect(options.minZoom).toBe(3);
		expect(options.maxZoom).toBe(19);
		expect(leafletMock.tileLayer).toHaveBeenCalledWith(
			'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
			expect.objectContaining({
				maxZoom: 19,
				attribution: expect.stringContaining('OpenStreetMap'),
			}),
		);
		expect(leafletMock.control.zoom).toHaveBeenCalledWith({
			zoomInTitle: 'Acercar mapa',
			zoomOutTitle: 'Alejar mapa',
		});
		expect(container).toBeInstanceOf(HTMLElement);
	});

	it('crea un marcador por estación', async () => {
		render(<LeafletMap stations={stations} center={[40.4168, -3.7038]} zoom={13} />);

		await waitFor(() => expect(leafletMock.marker).toHaveBeenCalledTimes(2));
		const [station1, opts1] = leafletMock.marker.mock.calls[0] as unknown as [
			[number, number],
			{ title: string; keyboard: boolean },
		];
		expect(station1).toEqual([40.4168, -3.7038]);
		expect(opts1.title).toBe('REPSOL');
		expect(opts1.keyboard).toBe(true);
	});

	it('expone el mapa como región con nombre accesible', () => {
		render(<LeafletMap stations={stations} center={[40.4168, -3.7038]} zoom={13} />);

		const region = screen.getByRole('region', { name: 'Mapa de gasolineras cercanas' });
		expect(region).toBeInTheDocument();
	});

	it('llama a onSelect al hacer clic en un marcador', async () => {
		const onSelect = vi.fn();
		render(
			<LeafletMap stations={stations} center={[40.4168, -3.7038]} zoom={13} onSelect={onSelect} />,
		);

		await waitFor(() => expect(markerInstance.on).toHaveBeenCalled());
		const clickHandler = markerInstance.on.mock.calls.find(
			([event]) => event === 'click',
		)?.[1];
		expect(clickHandler).toBeDefined();
		clickHandler?.();
		expect(onSelect).toHaveBeenCalledWith('1');
	});

	it('muestra la lista alternativa si la inicialización del mapa falla', async () => {
		leafletMock.map.mockImplementationOnce(() => {
			throw new Error('no map');
		});

		render(<LeafletMap stations={stations} center={[40.4168, -3.7038]} zoom={13} />);

		expect(await screen.findByRole('list', { name: 'Lista de gasolineras cercanas' }))
			.toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'REPSOL' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'CEPSA' })).toBeInTheDocument();
	});

	it('la lista alternativa permite seleccionar una estación', async () => {
		leafletMock.map.mockImplementationOnce(() => {
			throw new Error('no map');
		});
		const onSelect = vi.fn();

		render(
			<LeafletMap stations={stations} center={[40.4168, -3.7038]} zoom={13} onSelect={onSelect} />,
		);

		fireEvent.click(await screen.findByRole('button', { name: 'CEPSA' }));
		expect(onSelect).toHaveBeenCalledWith('2');
	});

	it('muestra un estado vacío cuando no hay estaciones', () => {
		render(<LeafletMap stations={[]} center={[40.4168, -3.7038]} zoom={13} />);

		expect(screen.getByRole('status')).toHaveTextContent('No hay estaciones');
	});
});
