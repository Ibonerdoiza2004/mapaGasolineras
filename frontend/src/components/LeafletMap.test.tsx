import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import LeafletMap, { type MapStation } from './LeafletMap';
import { dispatchUserLocation, LOCATION_EVENT } from '../lib/geolocation';
import { SPAIN_BOUNDS, PENINSULA_CENTER } from '../lib/spainBounds';

const { leafletMock, markerInstance, mapState } = vi.hoisted(() => {
	const mapState = {
		size: { x: 1580, y: 1024 },
		zoom: 5.25,
		southWest: { x: 50, y: 1016 },
		northEast: { x: 865, y: 133 },
	};
	const zeroZoom: Record<string, { x: number; y: number }> = {
		'27.63': { x: 115.09, y: 107.54 },
		'39.9': { x: 125.8, y: 96.99 },
		'52.17': { x: 136.5, y: 84.27 },
	};
	const mapInstance = {
		fitBounds: vi.fn(),
		getMaxZoom: vi.fn(() => 19),
		getSize: vi.fn(() => mapState.size),
		getZoom: vi.fn(() => mapState.zoom),
		options: { zoomSnap: 0.5 },
		project: vi.fn((latlng: [number, number], zoom?: number) => {
			if (zoom === 0) return zeroZoom[latlng[0]];
			return latlng[0] < 30 ? mapState.southWest : mapState.northEast;
		}),
		remove: vi.fn(),
		scrollWheelZoom: { disable: vi.fn() },
		setView: vi.fn(),
		unproject: vi.fn(() => ({ lat: 36.5, lng: -6.9 })),
		mouseEventToContainerPoint: vi.fn(() => ({ x: 100, y: 200 })),
		setZoomAround: vi.fn(),
		_animatingZoom: false,
		_onZoomTransitionEnd: vi.fn(),
	};
	const markerInstance = {
		addTo: vi.fn(() => markerInstance),
		on: vi.fn(),
		remove: vi.fn(),
	};
	const tileLayerInstance = { addTo: vi.fn() };
	const zoomControlInstance = { addTo: vi.fn() };
	return {
		mapState,
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
		mapState.size = { x: 1580, y: 1024 };
		mapState.zoom = 5.25;
		mapState.southWest = { x: 50, y: 1016 };
		mapState.northEast = { x: 865, y: 133 };
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
				zoomSnap: number;
				zoomDelta: number;
			},
		];
		expect(options.center).toEqual([40.4168, -3.7038]);
		expect(options.zoom).toBe(13);
		expect(options.zoomControl).toBe(false);
		expect(options.minZoom).toBe(3);
		expect(options.maxZoom).toBe(19);
		expect(options.zoomSnap).toBe(0.5);
		expect(options.zoomDelta).toBe(0.5);
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
		const mapInstance = leafletMock.map.mock.results[0].value as {
			fitBounds: ReturnType<typeof vi.fn>;
		};
		expect(mapInstance.fitBounds).not.toHaveBeenCalled();
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

	it('ajusta la vista a los límites y deja 18 px bajo Canarias centrando la península', async () => {
		render(<LeafletMap stations={stations} center={[40.4168, -3.7038]} zoom={13} bounds={SPAIN_BOUNDS} />);

		await waitFor(() => expect(leafletMock.map).toHaveBeenCalledTimes(1));
		const mapInstance = leafletMock.map.mock.results[0].value as {
			fitBounds: ReturnType<typeof vi.fn>;
			project: ReturnType<typeof vi.fn>;
			setView: ReturnType<typeof vi.fn>;
			unproject: ReturnType<typeof vi.fn>;
			options: { zoomSnap: number };
		};
		expect(mapInstance.fitBounds).toHaveBeenCalledWith(SPAIN_BOUNDS, { padding: [16, 16] });
		expect(mapInstance.project).toHaveBeenNthCalledWith(1, SPAIN_BOUNDS[0], 5.25);
		expect(mapInstance.project).toHaveBeenNthCalledWith(2, SPAIN_BOUNDS[1], 5.25);
		expect(mapInstance.project).toHaveBeenNthCalledWith(3, SPAIN_BOUNDS[0], 0);
		expect(mapInstance.project).toHaveBeenNthCalledWith(4, PENINSULA_CENTER, 0);
		// El zoom se calcula para que el borde inferior del encuadre quede a
		// 18 px del borde inferior del mapa (puede no caer en la rejilla de
		// zoomSnap) y el centro apunta al centro visual de la península.
		const bottomOffset = 107.54 - 96.99;
		const targetZoom = Math.log2((1024 / 2 - 18) / bottomOffset);
		expect(mapInstance.setView).toHaveBeenCalledWith(PENINSULA_CENTER, targetZoom, {
			animate: false,
		});
		expect(mapInstance.unproject).not.toHaveBeenCalled();
		// El ajuste a la rejilla se desactiva solo durante la vista inicial.
		expect(mapInstance.options.zoomSnap).toBe(0.5);
	});

	it('no desplaza el encuadre cuando es la anchura la que limita el mapa', async () => {
		mapState.size = { x: 400, y: 700 };
		mapState.zoom = 4;
		mapState.southWest = { x: 20, y: 650 };
		mapState.northEast = { x: 360, y: 150 };

		render(<LeafletMap stations={stations} center={[40.4168, -3.7038]} zoom={13} bounds={SPAIN_BOUNDS} />);

		await waitFor(() => expect(leafletMock.map).toHaveBeenCalledTimes(1));
		const mapInstance = leafletMock.map.mock.results[0].value as {
			fitBounds: ReturnType<typeof vi.fn>;
			setView: ReturnType<typeof vi.fn>;
		};
		expect(mapInstance.fitBounds).toHaveBeenCalledWith(SPAIN_BOUNDS, { padding: [16, 16] });
		expect(mapInstance.setView).not.toHaveBeenCalled();
	});

	it('no ajusta la vista si no se proporcionan límites', async () => {
		render(<LeafletMap stations={stations} center={[40.4168, -3.7038]} zoom={13} />);

		await waitFor(() => expect(leafletMock.map).toHaveBeenCalledTimes(1));
		const mapInstance = leafletMock.map.mock.results[0].value as {
			fitBounds: ReturnType<typeof vi.fn>;
		};
		expect(mapInstance.fitBounds).not.toHaveBeenCalled();
	});

	it('hace zoom con pasos fijos de 0.5 centrados en el puntero con la rueda', async () => {
		render(<LeafletMap stations={stations} center={[40.4168, -3.7038]} zoom={13} />);

		await waitFor(() => expect(leafletMock.map).toHaveBeenCalledTimes(1));
		const mapInstance = leafletMock.map.mock.results[0].value as {
			scrollWheelZoom: { disable: ReturnType<typeof vi.fn> };
			mouseEventToContainerPoint: ReturnType<typeof vi.fn>;
			setZoomAround: ReturnType<typeof vi.fn>;
			_animatingZoom: boolean;
			_onZoomTransitionEnd: ReturnType<typeof vi.fn>;
		};
		const mapContainer = document.querySelector<HTMLElement>('.leaflet-map__container');
		expect(mapContainer).not.toBeNull();
		// La rueda nativa de Leaflet queda desactivada en favor del manejador propio.
		expect(mapInstance.scrollWheelZoom.disable).toHaveBeenCalled();

		fireEvent.wheel(mapContainer as HTMLElement, { deltaY: 100 });
		// Zoom animado (sin opciones) centrado en el punto del puntero.
		expect(mapInstance.setZoomAround).toHaveBeenCalledWith({ x: 100, y: 200 }, 4.75);
		expect(mapInstance._onZoomTransitionEnd).not.toHaveBeenCalled();

		fireEvent.wheel(mapContainer as HTMLElement, { deltaY: -100 });
		expect(mapInstance.setZoomAround).toHaveBeenCalledWith({ x: 100, y: 200 }, 5.75);
	});

	it('finaliza la animación en curso antes de cada paso de la rueda', async () => {
		render(<LeafletMap stations={stations} center={[40.4168, -3.7038]} zoom={13} />);

		await waitFor(() => expect(leafletMock.map).toHaveBeenCalledTimes(1));
		const mapInstance = leafletMock.map.mock.results[0].value as {
			setZoomAround: ReturnType<typeof vi.fn>;
			_animatingZoom: boolean;
			_onZoomTransitionEnd: ReturnType<typeof vi.fn>;
		};
		const mapContainer = document.querySelector<HTMLElement>('.leaflet-map__container') as HTMLElement;
		mapInstance._animatingZoom = true;

		// Un paso que llega durante una animación la finaliza antes de empezar
		// la suya: la rueda rápida no pierde pasos ni deja de animar.
		fireEvent.wheel(mapContainer, { deltaY: -100 });
		expect(mapInstance._onZoomTransitionEnd).toHaveBeenCalled();
		expect(mapInstance.setZoomAround).toHaveBeenCalledWith({ x: 100, y: 200 }, 5.75);
	});

	it('acumula el delta de la rueda hasta completar un paso de zoom', async () => {
		render(<LeafletMap stations={stations} center={[40.4168, -3.7038]} zoom={13} />);

		await waitFor(() => expect(leafletMock.map).toHaveBeenCalledTimes(1));
		const mapInstance = leafletMock.map.mock.results[0].value as {
			setZoomAround: ReturnType<typeof vi.fn>;
			_animatingZoom: boolean;
		};
		const mapContainer = document.querySelector<HTMLElement>('.leaflet-map__container') as HTMLElement;
		mapInstance._animatingZoom = false;

		fireEvent.wheel(mapContainer, { deltaY: 30 });
		fireEvent.wheel(mapContainer, { deltaY: 30 });
		expect(mapInstance.setZoomAround).not.toHaveBeenCalled();

		fireEvent.wheel(mapContainer, { deltaY: 30 });
		fireEvent.wheel(mapContainer, { deltaY: 10 });
		expect(mapInstance.setZoomAround).toHaveBeenCalledWith({ x: 100, y: 200 }, 4.75);

		fireEvent.wheel(mapContainer, { deltaY: 5, deltaMode: 1 });
		expect(mapInstance.setZoomAround).toHaveBeenCalledWith({ x: 100, y: 200 }, 4.75);
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

	it('centra el mapa y reordena los marcadores al recibir la ubicación del usuario', async () => {
		const nearby = [
			{ id: 'lejos', lat: 41.0, lon: -1.0, rotulo: 'LEJOS' },
			{ id: 'cerca', lat: 40.42, lon: -3.7, rotulo: 'CERCA' },
			{ id: 'medio', lat: 40.5, lon: -3.5, rotulo: 'MEDIO' },
		];
		render(<LeafletMap stations={nearby} center={[40.4168, -3.7038]} zoom={13} />);

		await waitFor(() => expect(leafletMock.map).toHaveBeenCalledTimes(1));
		const mapInstance = leafletMock.map.mock.results[0].value as {
			setView: ReturnType<typeof vi.fn>;
		};

		dispatchUserLocation(40.4168, -3.7038);

		await waitFor(() => {
			expect(mapInstance.setView).toHaveBeenCalledWith([40.4168, -3.7038], 15);
		});
		await waitFor(() => expect(leafletMock.marker).toHaveBeenCalledTimes(6));
		const calls = leafletMock.marker.mock.calls as unknown as [number, number][][];
		const reordered = calls.slice(3).map(([coords]) => coords);
		expect(reordered).toEqual([
			[40.42, -3.7],
			[40.5, -3.5],
			[41, -1],
		]);
	});

	it('ignora coordenadas fuera de rango en el evento de ubicación', async () => {
		render(<LeafletMap stations={stations} center={[40.4168, -3.7038]} zoom={13} />);

		await waitFor(() => expect(leafletMock.map).toHaveBeenCalledTimes(1));
		const mapInstance = leafletMock.map.mock.results[0].value as {
			setView: ReturnType<typeof vi.fn>;
		};

		window.dispatchEvent(new CustomEvent(LOCATION_EVENT, { detail: { lat: 120, lon: -3.7 } }));

		expect(mapInstance.setView).not.toHaveBeenCalled();
	});
});
