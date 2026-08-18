import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import LeafletMap, { type MapStation } from './LeafletMap';
import {
	COMPARE_EVENT,
	RADIO_EVENT,
	STATION_DETAIL_EVENT,
	STATION_FOCUS_EVENT,
	STATION_SELECT_EVENT,
	STATIONS_EVENT,
	VIEWPORT_EVENT,
} from '../lib/explorerEvents';
import { dispatchUserLocation, LOCATION_EVENT, resetLastLocation } from '../lib/geolocation';
import { SPAIN_BOUNDS, PENINSULA_CENTER } from '../lib/spainBounds';

const { leafletMock, markerInstance, circleInstance, mapState } = vi.hoisted(() => {
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
		getBounds: vi.fn(() => ({
			getSouthWest: () => ({ lat: 36.5, lng: -9.5 }),
			getNorthEast: () => ({ lat: 43.8, lng: 3.5 }),
		})),
		getMaxZoom: vi.fn(() => 19),
		getMinZoom: vi.fn(() => 3),
		getSize: vi.fn(() => mapState.size),
		getZoom: vi.fn(() => mapState.zoom),
		on: vi.fn(),
		options: { zoomSnap: 0.5 },
		project: vi.fn((latlng: [number, number], zoom?: number) => {
			if (zoom === 0) return zeroZoom[latlng[0]] ?? { x: 0, y: 0 };
			// Esquinas de SPAIN_BOUNDS usadas para calcular el encuadre inicial.
			if (latlng[0] === 27.63 && latlng[1] === -18.16) return mapState.southWest;
			if (latlng[0] === 52.17 && latlng[1] === 11.96) return mapState.northEast;
			// Estaciones: píxel derivado de las coordenadas para que la
			// agrupación respete la proximidad real entre puntos.
			return { x: latlng[1] * 4000, y: -latlng[0] * 4000 };
		}),
		remove: vi.fn(),
		scrollWheelZoom: { disable: vi.fn() },
		setMinZoom: vi.fn(),
		setView: vi.fn(),
		panTo: vi.fn(),
		unproject: vi.fn(() => ({ lat: 36.5, lng: -6.9 })),
		mouseEventToContainerPoint: vi.fn(() => ({ x: 100, y: 200 })),
		setZoomAround: vi.fn(),
		_animatingZoom: false,
		_onZoomTransitionEnd: vi.fn(),
	};
	const markerInstance = {
		addTo: vi.fn(() => markerInstance),
		bindPopup: vi.fn(() => markerInstance),
		on: vi.fn(),
		remove: vi.fn(),
		setLatLng: vi.fn(),
	};
	const circleInstance = {
		addTo: vi.fn(() => circleInstance),
		remove: vi.fn(),
		setLatLng: vi.fn(),
		setRadius: vi.fn(),
	};
	const tileLayerInstance = { addTo: vi.fn() };
	const zoomControlInstance = { addTo: vi.fn() };
	return {
		mapState,
		markerInstance,
		circleInstance,
		zoomControlInstance,
		leafletMock: {
			map: vi.fn(() => mapInstance),
			tileLayer: vi.fn(() => tileLayerInstance),
			marker: vi.fn(() => markerInstance),
			circle: vi.fn(() => circleInstance),
			divIcon: vi.fn((opts: unknown) => opts),
			control: { zoom: vi.fn(() => zoomControlInstance) },
			latLngBounds: vi.fn(() => ({ pad: vi.fn(() => ({})) })),
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
		resetLastLocation();
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
			maxBounds: unknown;
			maxBoundsViscosity: number;
		},
		];
		expect(options.center).toEqual([40.4168, -3.7038]);
		expect(options.zoom).toBe(13);
		expect(options.zoomControl).toBe(false);
		expect(options.minZoom).toBe(3);
		expect(options.maxZoom).toBe(19);
		expect(options.zoomSnap).toBe(0.5);
		expect(options.zoomDelta).toBe(0.5);
		expect(options.maxBoundsViscosity).toBe(1);
		expect(leafletMock.latLngBounds).toHaveBeenCalledWith(SPAIN_BOUNDS);
		const boundsMock = leafletMock.latLngBounds.mock.results[0].value as {
			pad: ReturnType<typeof vi.fn>;
		};
		expect(boundsMock.pad).toHaveBeenCalledWith(0.08);
		expect(options.maxBounds).toBeDefined();
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

	it('crea un marcador por estación cuando están alejadas', async () => {
		const spread = [
			{ id: '1', lat: 40.4168, lon: -3.7038, rotulo: 'REPSOL', price: 1.599, isBest: true },
			{ id: '2', lat: 27.63, lon: -18.16, rotulo: 'CEPSA', price: 1.65 },
		];
		render(<LeafletMap stations={spread} center={[40.4168, -3.7038]} zoom={13} />);

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

	it('agrupa estaciones próximas en un clúster y acerca el zoom al pulsarlo', async () => {
		const clustered = [
			{ id: 'a', lat: 40.4168, lon: -3.7038, rotulo: 'A', price: 1.5 },
			{ id: 'b', lat: 40.4178, lon: -3.7048, rotulo: 'B', price: 1.6 },
			{ id: 'c', lat: 40.4188, lon: -3.7058, rotulo: 'C', price: 1.7 },
		];
		render(<LeafletMap stations={clustered} center={[40.4168, -3.7038]} zoom={13} />);

		// Tres estaciones en la misma celda se funden en un único clúster.
		await waitFor(() => expect(leafletMock.marker).toHaveBeenCalledTimes(1));
		const clusterIcon = leafletMock.divIcon.mock.calls
			.map((call) => call[0] as { className?: string; html?: string })
			.find((opts) => opts?.className === 'station-cluster');
		expect(clusterIcon).toBeDefined();
		expect(clusterIcon?.html).toContain('>3<');

		// Pulsar el clúster acerca el zoom un paso, centrado en su centroide.
		const clickHandler = markerInstance.on.mock.calls.find(
			([event]) => event === 'click',
		)?.[1] as () => void;
		clickHandler?.();
		const mapInstance = leafletMock.map.mock.results[0].value as {
			setView: ReturnType<typeof vi.fn>;
		};
		expect(mapInstance.setView).toHaveBeenCalledWith([40.4178, -3.7048], 6.25);
	});

	it('resalta las estaciones del panel de comparar y desplaza el mapa a la añadida', async () => {
		const spread = [
			{ id: '1', lat: 40.4168, lon: -3.7038, rotulo: 'REPSOL', price: 1.599 },
			{ id: '2', lat: 27.63, lon: -18.16, rotulo: 'CEPSA', price: 1.65 },
		];
		render(<LeafletMap stations={spread} center={[40.4168, -3.7038]} zoom={13} />);
		await waitFor(() => expect(leafletMock.marker).toHaveBeenCalledTimes(2));

		act(() => {
			window.dispatchEvent(
				new CustomEvent(COMPARE_EVENT, { detail: { ids: ['2'], added: '2' } }),
			);
		});

		const mapInstance = leafletMock.map.mock.results[0].value as {
			panTo: ReturnType<typeof vi.fn>;
		};
		await waitFor(() => expect(mapInstance.panTo).toHaveBeenCalledWith([27.63, -18.16]));

		const selectedIcon = leafletMock.divIcon.mock.calls
			.map((call) => call[0] as { className?: string })
			.find(
				(opts) =>
					typeof opts?.className === 'string' &&
					opts.className.includes('station-marker--selected'),
			);
		expect(selectedIcon).toBeDefined();
	});

	it('resalta el marcador de la estación enfocada desde la lista y desplaza el mapa', async () => {
		const spread = [
			{ id: '1', lat: 40.4168, lon: -3.7038, rotulo: 'REPSOL', price: 1.599 },
			{ id: '2', lat: 27.63, lon: -18.16, rotulo: 'CEPSA', price: 1.65 },
		];
		render(<LeafletMap stations={spread} center={[40.4168, -3.7038]} zoom={13} />);
		await waitFor(() => expect(leafletMock.marker).toHaveBeenCalledTimes(2));

		act(() => {
			window.dispatchEvent(new CustomEvent(STATION_FOCUS_EVENT, { detail: { id: '2' } }));
		});

		const mapInstance = leafletMock.map.mock.results[0].value as {
			panTo: ReturnType<typeof vi.fn>;
		};
		await waitFor(() => expect(mapInstance.panTo).toHaveBeenCalledWith([27.63, -18.16]));

		await waitFor(() => {
			const focusedIcon = leafletMock.divIcon.mock.calls
				.map((call) => call[0] as { className?: string })
				.find(
					(opts) =>
						typeof opts?.className === 'string' &&
						opts.className.includes('station-marker--selected'),
				);
			expect(focusedIcon).toBeDefined();
		});
	});

	it('deja de resaltar la estación al limpiar el foco si no está en el comparador', async () => {
		const spread = [{ id: '1', lat: 40.4168, lon: -3.7038, rotulo: 'REPSOL', price: 1.599 }];
		render(<LeafletMap stations={spread} center={[40.4168, -3.7038]} zoom={13} />);
		await waitFor(() => expect(leafletMock.marker).toHaveBeenCalledTimes(1));

		act(() => {
			window.dispatchEvent(new CustomEvent(STATION_FOCUS_EVENT, { detail: { id: '1' } }));
		});
		await waitFor(() => {
			const last = leafletMock.divIcon.mock.calls.at(-1)?.[0] as { className?: string } | undefined;
			expect(last?.className?.includes('station-marker--selected')).toBe(true);
		});

		act(() => {
			window.dispatchEvent(new CustomEvent(STATION_FOCUS_EVENT, { detail: { id: null } }));
		});

		// La última renderización ya no usa el icono resaltado.
		await waitFor(() => {
			const last = leafletMock.divIcon.mock.calls.at(-1)?.[0] as { className?: string } | undefined;
			expect(last?.className?.includes('station-marker--selected')).toBe(false);
		});
	});

	it('mantiene resaltada la estación del comparador aunque se limpie el foco', async () => {
		const spread = [{ id: '1', lat: 40.4168, lon: -3.7038, rotulo: 'REPSOL', price: 1.599 }];
		render(<LeafletMap stations={spread} center={[40.4168, -3.7038]} zoom={13} />);
		await waitFor(() => expect(leafletMock.marker).toHaveBeenCalledTimes(1));

		act(() => {
			window.dispatchEvent(
				new CustomEvent(COMPARE_EVENT, { detail: { ids: ['1'], added: '1' } }),
			);
		});
		act(() => {
			window.dispatchEvent(new CustomEvent(STATION_FOCUS_EVENT, { detail: { id: '1' } }));
		});
		act(() => {
			window.dispatchEvent(new CustomEvent(STATION_FOCUS_EVENT, { detail: { id: null } }));
		});

		// Tras limpiar el foco sigue resaltada porque pertenece al comparador.
		await waitFor(() => {
			const last = leafletMock.divIcon.mock.calls.at(-1)?.[0] as { className?: string } | undefined;
			expect(last?.className?.includes('station-marker--selected')).toBe(true);
		});
	});

	it('hacer clic en un marcador abre un popup con las opciones de comparar y ver ficha', async () => {
		const spread = [
			{ id: '1', lat: 40.4168, lon: -3.7038, rotulo: 'REPSOL', price: 1.599 },
			{ id: '2', lat: 27.63, lon: -18.16, rotulo: 'CEPSA', price: 1.65 },
		];
		const listener = vi.fn();
		window.addEventListener(STATION_SELECT_EVENT, listener);
		render(<LeafletMap stations={spread} center={[40.4168, -3.7038]} zoom={13} />);
		await waitFor(() => expect(markerInstance.bindPopup).toHaveBeenCalled());

		const popupHtml = (markerInstance.bindPopup.mock.calls as unknown[][])[0][0] as string;
		expect(popupHtml).toContain('REPSOL');
		expect(popupHtml).toContain('Añadir al comparador');
		expect(popupHtml).toContain('Ver ficha');
		expect(popupHtml).toContain('data-station-id="1"');

		// El clic en el marcador ya no añade directamente al comparador.
		const clickHandler = markerInstance.on.mock.calls.find(
			([event]) => event === 'click',
		)?.[1] as () => void;
		clickHandler?.();
		expect(listener).not.toHaveBeenCalled();
		window.removeEventListener(STATION_SELECT_EVENT, listener);
	});

	it('los botones del popup notifican añadir al comparador y ver ficha', async () => {
		const spread = [{ id: '1', lat: 40.4168, lon: -3.7038, rotulo: 'REPSOL', price: 1.599 }];
		const selectListener = vi.fn();
		const detailListener = vi.fn();
		window.addEventListener(STATION_SELECT_EVENT, selectListener);
		window.addEventListener(STATION_DETAIL_EVENT, detailListener);
		const { container } = render(
			<LeafletMap stations={spread} center={[40.4168, -3.7038]} zoom={13} />,
		);
		await waitFor(() => expect(markerInstance.bindPopup).toHaveBeenCalled());
		const mapContainer = container.querySelector('.leaflet-map__container') as HTMLElement;

		const button = document.createElement('button');
		button.setAttribute('data-station-id', '1');
		button.setAttribute('data-station-action', 'compare');
		mapContainer.appendChild(button);
		fireEvent.click(button);
		expect(selectListener).toHaveBeenCalled();
		expect(
			(selectListener.mock.calls[0][0] as CustomEvent<{ id: string }>).detail.id,
		).toBe('1');

		const detailButton = document.createElement('button');
		detailButton.setAttribute('data-station-id', '1');
		detailButton.setAttribute('data-station-action', 'detail');
		mapContainer.appendChild(detailButton);
		fireEvent.click(detailButton);
		expect(detailListener).toHaveBeenCalled();
		expect(
			(detailListener.mock.calls[0][0] as CustomEvent<{ id: string }>).detail.id,
		).toBe('1');
		window.removeEventListener(STATION_SELECT_EVENT, selectListener);
		window.removeEventListener(STATION_DETAIL_EVENT, detailListener);
	});

	it('ajusta la vista a los límites y deja 18 px bajo Canarias centrando la península', async () => {
		render(<LeafletMap stations={stations} center={[40.4168, -3.7038]} zoom={13} bounds={SPAIN_BOUNDS} />);

		await waitFor(() => expect(leafletMock.map).toHaveBeenCalledTimes(1));
		const mapInstance = leafletMock.map.mock.results[0].value as {
			fitBounds: ReturnType<typeof vi.fn>;
			project: ReturnType<typeof vi.fn>;
			setMinZoom: ReturnType<typeof vi.fn>;
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
		// 28 px del borde inferior del mapa (puede no caer en la rejilla de
		// zoomSnap) y el centro apunta al centro visual de la península.
		const bottomOffset = 107.54 - 96.99;
		const targetZoom = Math.log2((1024 / 2 - 28) / bottomOffset);
		expect(mapInstance.setView).toHaveBeenCalledWith(PENINSULA_CENTER, targetZoom, {
			animate: false,
		});
		// El zoom mínimo coincide con la vista inicial: no se puede alejar más
		// allá de los límites de España.
		expect(mapInstance.setMinZoom).toHaveBeenCalledWith(targetZoom);
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
			setMinZoom: ReturnType<typeof vi.fn>;
			setView: ReturnType<typeof vi.fn>;
		};
		expect(mapInstance.fitBounds).toHaveBeenCalledWith(SPAIN_BOUNDS, { padding: [16, 16] });
		expect(mapInstance.setView).not.toHaveBeenCalled();
		// El zoom mínimo es el del encuadre por anchura (sin desplazamiento).
		expect(mapInstance.setMinZoom).toHaveBeenCalledWith(4);
	});

	it('no ajusta la vista si no se proporcionan límites', async () => {
		render(<LeafletMap stations={stations} center={[40.4168, -3.7038]} zoom={13} />);

		await waitFor(() => expect(leafletMock.map).toHaveBeenCalledTimes(1));
		const mapInstance = leafletMock.map.mock.results[0].value as {
			fitBounds: ReturnType<typeof vi.fn>;
			setMinZoom: ReturnType<typeof vi.fn>;
		};
		expect(mapInstance.fitBounds).not.toHaveBeenCalled();
		expect(mapInstance.setMinZoom).not.toHaveBeenCalled();
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

	it('no hace nada al alejar con la rueda en el zoom mínimo', async () => {
		render(<LeafletMap stations={stations} center={[40.4168, -3.7038]} zoom={13} />);

		await waitFor(() => expect(leafletMock.map).toHaveBeenCalledTimes(1));
		const mapInstance = leafletMock.map.mock.results[0].value as {
			getMinZoom: ReturnType<typeof vi.fn>;
			setZoomAround: ReturnType<typeof vi.fn>;
		};
		const mapContainer = document.querySelector<HTMLElement>('.leaflet-map__container') as HTMLElement;
		mapState.zoom = 3;
		mapInstance.getMinZoom.mockReturnValue(3);

		// Un paso hacia atrás caería por debajo del zoom mínimo: Leaflet frenaría
		// el zoom pero movería el centro del mapa; se ignora y nada cambia.
		fireEvent.wheel(mapContainer, { deltaY: 100 });
		expect(mapInstance.setZoomAround).not.toHaveBeenCalled();

		// El paso hacia delante desde el mínimo sigue funcionando.
		fireEvent.wheel(mapContainer, { deltaY: -100 });
		expect(mapInstance.setZoomAround).toHaveBeenCalledWith({ x: 100, y: 200 }, 3.5);
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
		const spread = [
			{ id: '1', lat: 40.4168, lon: -3.7038, rotulo: 'REPSOL', price: 1.599 },
			{ id: '2', lat: 27.63, lon: -18.16, rotulo: 'CEPSA', price: 1.65 },
		];
		render(
			<LeafletMap stations={spread} center={[40.4168, -3.7038]} zoom={13} onSelect={onSelect} />,
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

	it('muestra el estado vacío solo después de una consulta sin resultados', () => {
		render(<LeafletMap stations={[]} center={[40.4168, -3.7038]} zoom={13} />);

		// Mientras el mapa carga o la consulta no ha terminado no se muestra
		// el aviso (antes aparecía superpuesto a las teselas en carga).
		expect(
			screen.queryByText('No hay estaciones que mostrar en el mapa.'),
		).not.toBeInTheDocument();

		act(() => {
			window.dispatchEvent(new CustomEvent(STATIONS_EVENT, { detail: { stations: [] } }));
		});

		expect(screen.getByText('No hay estaciones que mostrar en el mapa.')).toBeInTheDocument();
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
		// 3 marcadores iniciales + marcador de referencia + 3 reordenados.
		await waitFor(() => expect(leafletMock.marker).toHaveBeenCalledTimes(7));
		const calls = leafletMock.marker.mock.calls as unknown as [number, number][][];
		// El marcador de referencia ocupa la posición 4 (efecto declarado antes).
		const reordered = calls.slice(4, 7).map(([coords]) => coords);
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

	it('dibuja el marcador de referencia y la circunferencia del radio', async () => {
		render(<LeafletMap stations={[]} center={[40.4168, -3.7038]} zoom={13} />);

		await waitFor(() => expect(leafletMock.map).toHaveBeenCalledTimes(1));

		act(() => {
			window.dispatchEvent(new CustomEvent(RADIO_EVENT, { detail: { radio: 10 } }));
		});
		dispatchUserLocation(40.4168, -3.7038, 'device');

		await waitFor(() => expect(leafletMock.circle).toHaveBeenCalledTimes(1));
		const [circleCoords, circleOptions] = leafletMock.circle.mock.calls[0] as unknown as [
			[number, number],
			{ radius: number; className: string },
		];
		expect(circleCoords).toEqual([40.4168, -3.7038]);
		expect(circleOptions.radius).toBe(10_000);
		expect(circleOptions.className).toBe('radius-circle');
		expect(circleInstance.addTo).toHaveBeenCalled();

		// El marcador central de la ubicación del dispositivo se dibuja con su
		// estilo propio.
		expect(leafletMock.divIcon).toHaveBeenCalledWith(
			expect.objectContaining({ className: 'location-marker location-marker--device' }),
		);
	});

	it('dibuja el marcador cuando la ubicación llega antes de que el mapa se inicialice', async () => {
		// El evento se emite antes de que el mapa se monte (hidratación tardía):
		// la ubicación se conserva y se aplica al inicializarse el mapa.
		dispatchUserLocation(40.4168, -3.7038, 'device');
		render(<LeafletMap stations={[]} center={[40.4168, -3.7038]} zoom={13} />);

		await waitFor(() => expect(leafletMock.map).toHaveBeenCalledTimes(1));
		const mapInstance = leafletMock.map.mock.results[0].value as {
			setView: ReturnType<typeof vi.fn>;
		};
		await waitFor(() => expect(mapInstance.setView).toHaveBeenCalledWith([40.4168, -3.7038], 15));
		await waitFor(() =>
			expect(leafletMock.divIcon).toHaveBeenCalledWith(
				expect.objectContaining({ className: 'location-marker location-marker--device' }),
			),
		);
	});

	it('el punto buscado usa el marcador de referencia estándar y sin radio no dibuja circunferencia', async () => {
		render(<LeafletMap stations={[]} center={[40.4168, -3.7038]} zoom={13} />);

		await waitFor(() => expect(leafletMock.map).toHaveBeenCalledTimes(1));

		dispatchUserLocation(40.4168, -3.7038, 'search');

		await waitFor(() =>
			expect(leafletMock.divIcon).toHaveBeenCalledWith(
				expect.objectContaining({ className: 'location-marker' }),
			),
		);
		expect(leafletMock.circle).not.toHaveBeenCalled();
	});

	it('actualiza la circunferencia al cambiar el radio sin recrearla', async () => {
		render(<LeafletMap stations={[]} center={[40.4168, -3.7038]} zoom={13} />);

		await waitFor(() => expect(leafletMock.map).toHaveBeenCalledTimes(1));

		act(() => {
			window.dispatchEvent(new CustomEvent(RADIO_EVENT, { detail: { radio: 10 } }));
		});
		dispatchUserLocation(40.4168, -3.7038);
		await waitFor(() => expect(leafletMock.circle).toHaveBeenCalledTimes(1));
		expect(circleInstance.setRadius).not.toHaveBeenCalled();

		act(() => {
			window.dispatchEvent(new CustomEvent(RADIO_EVENT, { detail: { radio: 50 } }));
		});

		// La misma instancia se re-encuadra y re-escala en sitio para evitar
		// el parpadeo de quitar y volver a dibujar la circunferencia.
		await waitFor(() => expect(circleInstance.setRadius).toHaveBeenCalledWith(50_000));
		expect(leafletMock.circle).toHaveBeenCalledTimes(1);
		expect(circleInstance.remove).not.toHaveBeenCalled();
	});

	it('sin radio quita la circunferencia', async () => {
		render(<LeafletMap stations={[]} center={[40.4168, -3.7038]} zoom={13} />);

		await waitFor(() => expect(leafletMock.map).toHaveBeenCalledTimes(1));

		act(() => {
			window.dispatchEvent(new CustomEvent(RADIO_EVENT, { detail: { radio: 10 } }));
		});
		dispatchUserLocation(40.4168, -3.7038);
		await waitFor(() => expect(leafletMock.circle).toHaveBeenCalledTimes(1));
		expect(circleInstance.remove).not.toHaveBeenCalled();

		act(() => {
			window.dispatchEvent(new CustomEvent(RADIO_EVENT, { detail: { radio: null } }));
		});

		await waitFor(() => expect(circleInstance.remove).toHaveBeenCalled());
	});

	it('ignora un evento de radio con valor inválido', async () => {
		render(<LeafletMap stations={[]} center={[40.4168, -3.7038]} zoom={13} />);

		await waitFor(() => expect(leafletMock.map).toHaveBeenCalledTimes(1));

		act(() => {
			window.dispatchEvent(new CustomEvent(RADIO_EVENT, { detail: { radio: 'mucho' } }));
			window.dispatchEvent(new CustomEvent(RADIO_EVENT, { detail: {} }));
		});
		dispatchUserLocation(40.4168, -3.7038);

		await waitFor(() =>
			expect(leafletMock.divIcon).toHaveBeenCalledWith(
				expect.objectContaining({ className: 'location-marker' }),
			),
		);
		expect(leafletMock.circle).not.toHaveBeenCalled();
	});

	it('añade marcadores al recibir resultados de estaciones cercanas', async () => {
		render(<LeafletMap stations={[]} center={[40.4168, -3.7038]} zoom={13} />);

		await waitFor(() => expect(leafletMock.map).toHaveBeenCalledTimes(1));
		expect(
			screen.queryByText('No hay estaciones que mostrar en el mapa.'),
		).not.toBeInTheDocument();

		act(() => {
			window.dispatchEvent(
				new CustomEvent(STATIONS_EVENT, {
					detail: {
						stations: [
							{
								id: 'a',
								rotulo: 'REPSOL',
								direccion: 'Av. de la Industria, 24',
								localidad: 'Madrid',
								provincia: 'Madrid',
								latitud: 40.4168,
								longitud: -3.7038,
								distanciaKm: 1.2,
								precio: 1.459,
								ahorro: 0,
								fechaActualizacion: new Date().toISOString(),
							},
							{
								id: 'b',
								rotulo: 'CEPSA',
								direccion: 'Calle Mayor, 1',
								localidad: 'Madrid',
								provincia: 'Madrid',
								latitud: 40.6178,
								longitud: -3.7048,
								distanciaKm: 1.8,
								precio: null,
								ahorro: null,
								fechaActualizacion: new Date().toISOString(),
							},
						],
					},
				}),
			);
		});

		await waitFor(() => expect(leafletMock.marker).toHaveBeenCalledTimes(2));
		const [first, firstOptions] = leafletMock.marker.mock.calls[0] as unknown as [
			[number, number],
			{ title: string },
		];
		expect(first).toEqual([40.4168, -3.7038]);
		expect(firstOptions.title).toBe('REPSOL');
		expect(screen.queryByText('No hay estaciones que mostrar en el mapa.')).not.toBeInTheDocument();
		// La mejor opción lleva su pin; la que no tiene precio, el rótulo.
		expect(leafletMock.divIcon).toHaveBeenNthCalledWith(
			1,
			expect.objectContaining({
				className: 'station-marker station-marker--best',
			}),
		);
		expect(leafletMock.divIcon).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({
				className: 'station-marker',
			}),
		);
	});

	it('ignora un evento de estaciones sin lista válida', async () => {
		render(<LeafletMap stations={[]} center={[40.4168, -3.7038]} zoom={13} />);

		await waitFor(() => expect(leafletMock.map).toHaveBeenCalledTimes(1));

		act(() => {
			window.dispatchEvent(new CustomEvent(STATIONS_EVENT, { detail: {} }));
			window.dispatchEvent(new CustomEvent(STATIONS_EVENT, { detail: { stations: 'nope' } }));
		});

		// Los eventos inválidos no cuentan como consulta terminada.
		expect(
			screen.queryByText('No hay estaciones que mostrar en el mapa.'),
		).not.toBeInTheDocument();

		act(() => {
			window.dispatchEvent(new CustomEvent(STATIONS_EVENT, { detail: { stations: [] } }));
		});

		expect(screen.getByText('No hay estaciones que mostrar en el mapa.')).toBeInTheDocument();
	});

	it('ignora estaciones sin coordenadas válidas', async () => {
		render(<LeafletMap stations={[]} center={[40.4168, -3.7038]} zoom={13} />);

		await waitFor(() => expect(leafletMock.map).toHaveBeenCalledTimes(1));

		act(() => {
			window.dispatchEvent(
				new CustomEvent(STATIONS_EVENT, {
					detail: {
						stations: [
							{
								id: 'buena',
								rotulo: 'REPSOL',
								direccion: 'Av. de la Industria, 24',
								localidad: 'Madrid',
								provincia: 'Madrid',
								latitud: 40.4168,
								longitud: -3.7038,
								distanciaKm: 1.2,
								precio: 1.459,
								ahorro: 0,
								fechaActualizacion: new Date().toISOString(),
							},
							{
								id: 'mala',
								rotulo: 'SIN POSICIÓN',
								direccion: 'Sin calle',
								localidad: 'Madrid',
								provincia: 'Madrid',
								latitud: Number.NaN,
								longitud: Number.NaN,
								distanciaKm: 0,
								precio: 1.5,
								ahorro: 0,
								fechaActualizacion: new Date().toISOString(),
							},
						],
					},
				}),
			);
		});

		// Solo la estación con coordenadas válidas genera un marcador.
		await waitFor(() => expect(leafletMock.marker).toHaveBeenCalledTimes(1));
		const [coords] = leafletMock.marker.mock.calls[0] as unknown as [[number, number]];
		expect(coords).toEqual([40.4168, -3.7038]);
	});

	it('notifica el viewport al inicializar el mapa', async () => {
		const listener = vi.fn();
		window.addEventListener(VIEWPORT_EVENT, listener);

		render(<LeafletMap stations={stations} center={[40.4168, -3.7038]} zoom={13} />);
		await waitFor(() => expect(leafletMock.map).toHaveBeenCalledTimes(1));

		expect(listener).toHaveBeenCalledOnce();
		const event = listener.mock.calls[0][0] as CustomEvent<{
			bounds: { minLat: number; maxLat: number; minLon: number; maxLon: number };
		}>;
		expect(event.detail.bounds).toEqual({
			minLat: 36.5,
			maxLat: 43.8,
			minLon: -9.5,
			maxLon: 3.5,
		});
		window.removeEventListener(VIEWPORT_EVENT, listener);
	});

	it('notifica el viewport al terminar de moverse el mapa (con retardo)', async () => {
		const listener = vi.fn();
		window.addEventListener(VIEWPORT_EVENT, listener);

		render(<LeafletMap stations={stations} center={[40.4168, -3.7038]} zoom={13} />);
		await waitFor(() => expect(leafletMock.map).toHaveBeenCalledTimes(1));
		listener.mockClear();

		const mapInstance = leafletMock.map.mock.results[0].value as {
			on: ReturnType<typeof vi.fn>;
		};
		const moveendHandler = mapInstance.on.mock.calls.find(
			([event]) => event === 'moveend',
		)?.[1] as () => void;
		expect(moveendHandler).toBeDefined();

		// Durante el arrastre se encadenan eventos: solo el último emite.
		act(() => {
			moveendHandler();
			moveendHandler();
		});
		expect(listener).not.toHaveBeenCalled();

		await new Promise((resolve) => setTimeout(resolve, 400));
		expect(listener).toHaveBeenCalledOnce();
		window.removeEventListener(VIEWPORT_EVENT, listener);
	});
});
