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

const { leafletMock, markerInstance, circleInstance, mapState, zoomControlInstance } =
	vi.hoisted(() => {
	const mapState = {
		size: { x: 1580, y: 1024 },
		zoom: 5.25,
		southWest: { x: 50, y: 1016 },
		northEast: { x: 865, y: 133 },
	};
	const zeroZoom: Record<string, { x: number; y: number }> = {
		'27.63': { x: 115.09, y: 107.54 },
		'39.9': { x: 125.8, y: 96.99 },
		'43.8': { x: 128.79, y: 93.34 },
		'52.17': { x: 136.5, y: 84.27 },
	};
	const mapInstance = {
		fitBounds: vi.fn(),
		getBounds: vi.fn(() => ({
			getSouthWest: () => ({ lat: 36.5, lng: -9.5 }),
			getNorthEast: () => ({ lat: 43.8, lng: 3.5 }),
		})),
		getCenter: vi.fn(() => ({ lat: 40.4, lng: -3.7 })),
		_limitCenter: vi.fn((center: unknown) => center),
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
	// El control de zoom propio se construye con `L.Control.extend(props)` y se
	// instancia después; para que la prueba ejercite el `onAdd` real (que crea
	// los botones y desactiva la propagación de clics), el mock conserva las
	// opciones pasadas a `extend` y `addTo` invoca `onAdd` antes de añadirse.
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
			Control: {
				extend: vi.fn((props: unknown) => {
					return vi.fn(function (this: {
						addTo: ReturnType<typeof vi.fn>;
						onAdd?: () => HTMLElement;
						options?: { position: string };
					}) {
						Object.assign(this, props as object, {
							addTo: vi.fn((map: unknown) => {
								if (typeof this.onAdd === 'function') this.onAdd();
								return zoomControlInstance.addTo(map);
							}),
						});
					});
				}),
			},
			DomUtil: {
				create: vi.fn((tag: string, className: string) => {
					const element = document.createElement(tag);
					element.className = className;
					return element;
				}),
			},
			DomEvent: {
				disableClickPropagation: vi.fn(),
			},
			latLngBounds: vi.fn(() => ({
				pad: vi.fn(() => ({})),
				getCenter: vi.fn(() => ({ lat: 39.9, lng: -3.1 })),
			})),
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
		// El resto de pruebas asume el ancho de escritorio de JSDOM.
		Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true });
	});

	it('inicializa el mapa y añade la capa de teselas de OpenStreetMap', async () => {
		render(
			<LeafletMap stations={stations} center={[40.4168, -3.7038]} zoom={13} bounds={SPAIN_BOUNDS} />,
		);

		await waitFor(() => expect(leafletMock.map).toHaveBeenCalledTimes(1));
		const [container, options] = leafletMock.map.mock.calls[0] as unknown as [
			HTMLElement,
		{
			center: [number, number];
			zoom: number;
			zoomControl: boolean;
			minZoom: number;
			maxZoom: number;
			touchZoom: boolean;
			bounceAtZoomLimits: boolean;
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
		expect(options.touchZoom).toBe(true);
		// El pellizco se frena en el zoom mínimo/máximo, sin rebote.
		expect(options.bounceAtZoomLimits).toBe(false);
		expect(options.zoomSnap).toBe(0.5);
		expect(options.zoomDelta).toBe(0.5);
		expect(options.maxBoundsViscosity).toBe(1);
		// Los límites de arrastre son asimétricos: el norte es un valor absoluto
		// justo por encima de la vista inicial (50º) para no dejar océano de
		// sobra sobre la península, y el sur depende del ancho del viewport
		// (JSDOM usa 1024 px exactos: entra en la rama ancha de escritorio).
		const [swLat, swLng] = SPAIN_BOUNDS[0];
		const [neLat, neLng] = SPAIN_BOUNDS[1];
		const latSpan = neLat - swLat;
		const lngSpan = neLng - swLng;
		expect(leafletMock.latLngBounds).toHaveBeenCalledWith(
			[swLat - latSpan * 0.05, swLng - lngSpan * 0.2],
			[50, neLng + lngSpan * 0.05],
		);
		expect(options.maxBounds).toBeDefined();
		expect(leafletMock.tileLayer).toHaveBeenCalledWith(
			'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
			expect.objectContaining({
				maxZoom: 19,
				attribution: expect.stringContaining('OpenStreetMap'),
			}),
		);
		// El control de zoom es propio y accesible (botones, no <a href="#">).
		expect(leafletMock.Control.extend).toHaveBeenCalled();
		expect(leafletMock.DomEvent.disableClickPropagation).toHaveBeenCalled();
		const buttonTags = leafletMock.DomUtil.create.mock.calls
			.map(([tag]) => tag)
			.filter((tag) => tag === 'button');
		expect(buttonTags).toHaveLength(2);
		expect(zoomControlInstance.addTo).toHaveBeenCalledWith(
			leafletMock.map.mock.results[0].value,
		);
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
		await waitFor(() =>
			expect(mapInstance.panTo).toHaveBeenCalledWith([27.63, -18.16], { animate: false }),
		);

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

	it('el popup de una estación solo enfocada ofrece añadir, no quitar del comparador', async () => {
		const spread = [
			{ id: '1', lat: 40.4168, lon: -3.7038, rotulo: 'REPSOL', price: 1.599 },
			{ id: '2', lat: 27.63, lon: -18.16, rotulo: 'CEPSA', price: 1.65 },
		];
		render(<LeafletMap stations={spread} center={[40.4168, -3.7038]} zoom={13} />);
		await waitFor(() => expect(markerInstance.bindPopup).toHaveBeenCalled());

		// Se enfoca la estación 2 desde el listado sin añadirla al comparador.
		act(() => {
			window.dispatchEvent(new CustomEvent(STATION_FOCUS_EVENT, { detail: { id: '2' } }));
		});

		await waitFor(() => {
			const calls = markerInstance.bindPopup.mock.calls as unknown as [string][];
			const last = calls.filter(([html]) => html.includes('data-station-id="2"')).at(-1)?.[0];
			expect(last).toBeDefined();
			expect(last).toContain('Añadir al comparador');
			expect(last).not.toContain('Quitar del comparador');
		});

		// Al añadirla al comparador, el popup pasa a ofrecer quitarla.
		act(() => {
			window.dispatchEvent(
				new CustomEvent(COMPARE_EVENT, { detail: { ids: ['2'], added: '2' } }),
			);
		});

		await waitFor(() => {
			const calls = markerInstance.bindPopup.mock.calls as unknown as [string][];
			const last = calls.filter(([html]) => html.includes('data-station-id="2"')).at(-1)?.[0];
			expect(last).toBeDefined();
			expect(last).toContain('Quitar del comparador');
		});
	});

	it('ajusta la vista a los límites, conserva el margen bajo Canarias y aumenta el detalle', async () => {
		render(<LeafletMap stations={stations} center={[40.4168, -3.7038]} zoom={13} bounds={SPAIN_BOUNDS} />);

		await waitFor(() => expect(leafletMock.map).toHaveBeenCalledTimes(1));
		const mapInstance = leafletMock.map.mock.results[0].value as {
			project: ReturnType<typeof vi.fn>;
			setMinZoom: ReturnType<typeof vi.fn>;
			setView: ReturnType<typeof vi.fn>;
			unproject: ReturnType<typeof vi.fn>;
			options: { zoomSnap: number };
		};
		// El zoom mínimo se calcula proyectando el rectángulo a zoom 0: el
		// encuadre de España (el menor de ambos ejes, con un pequeño margen
		// lateral) nunca baja del encuadre del área desplazable con margen.
		expect(mapInstance.project).toHaveBeenNthCalledWith(1, SPAIN_BOUNDS[0], 0);
		expect(mapInstance.project).toHaveBeenNthCalledWith(2, SPAIN_BOUNDS[1], 0);
		expect(mapInstance.project).toHaveBeenNthCalledWith(3, SPAIN_BOUNDS[0], 0);
		expect(mapInstance.project).toHaveBeenNthCalledWith(4, PENINSULA_CENTER, 0);
		expect(mapInstance.project).toHaveBeenNthCalledWith(5, SPAIN_BOUNDS[0], 0);
		expect(mapInstance.project).toHaveBeenNthCalledWith(6, [43.8, 0], 0);
		const boundsWidth = 136.5 - 115.09;
		const boundsHeight = 107.54 - 84.27;
		const minZoom = Math.max(
			Math.min(Math.log2((1580 * 0.97) / boundsWidth), Math.log2(1024 / boundsHeight)),
			Math.log2(1580 / (boundsWidth * 1.25)),
		);
		// El zoom mínimo impide alejarse más allá de los límites de España.
		expect(mapInstance.setMinZoom).toHaveBeenCalledWith(minZoom);
		// La vista inicial de escritorio encuadra la península anclando Canarias
		// a 28 px del borde inferior. En este viewport de 1024 px no se aplica
		// INITIAL_ZOOM_PAD.
		const bottomOffset = 107.54 - 96.99;
		const baseZoom = Math.log2((1024 / 2 - 28) / bottomOffset);
		const peninsulaZoom = Math.log2(1024 / (107.54 - 93.34));
		const targetZoom = Math.max(
			Math.min(baseZoom, 19, peninsulaZoom),
			minZoom,
		);
		const framedZoom = Math.max(targetZoom, 3);
		expect(mapInstance.setMinZoom).toHaveBeenCalledWith(framedZoom);
		expect(mapInstance.setView).toHaveBeenCalledWith([36.5, -6.9], framedZoom, {
			animate: false,
		});
		expect(mapInstance.unproject).toHaveBeenCalled();
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
			setMinZoom: ReturnType<typeof vi.fn>;
			setView: ReturnType<typeof vi.fn>;
			options: { zoomSnap: number };
		};
		const minZoom = Math.max(
			Math.min(
				Math.log2((400 * 0.97) / (136.5 - 115.09)),
				Math.log2(700 / (107.54 - 84.27)),
			),
			Math.log2(400 / ((136.5 - 115.09) * 1.25)),
		);
		// El zoom mínimo encuadra España entera (el menor de ambos ejes),
		// nunca por debajo del encuadre del área desplazable con margen (el
		// margen este ahora es 0.05 en todo ancho de pantalla).
		expect(mapInstance.setMinZoom).toHaveBeenCalledWith(minZoom);
		// La anchura limita: la vista inicial muestra España centrada al zoom
		// mínimo, no el zoom del mapa (que sería un no-op).
		expect(mapInstance.setView).toHaveBeenCalledWith([39.9, -3.1], minZoom, {
			animate: false,
		});
		// El ajuste a la rejilla se desactiva solo durante la vista inicial.
		expect(mapInstance.options.zoomSnap).toBe(0.5);
	});

	it('en tablet de 1024 px no aplica el alejamiento de escritorio (quedaría demasiado alejado)', async () => {
		mapState.size = { x: 1024, y: 768 };
		Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true });

		render(<LeafletMap stations={stations} center={[40.4168, -3.7038]} zoom={13} bounds={SPAIN_BOUNDS} />);

		await waitFor(() => expect(leafletMock.map).toHaveBeenCalledTimes(1));
		const mapInstance = leafletMock.map.mock.results[0].value as {
			project: ReturnType<typeof vi.fn>;
			setMinZoom: ReturnType<typeof vi.fn>;
			setView: ReturnType<typeof vi.fn>;
			unproject: ReturnType<typeof vi.fn>;
			options: { zoomSnap: number };
		};
		const boundsWidth = 136.5 - 115.09;
		const boundsHeight = 107.54 - 84.27;
		const minZoom = Math.max(
			Math.min(Math.log2((1024 * 0.97) / boundsWidth), Math.log2(768 / boundsHeight)),
			Math.log2(1024 / (boundsWidth * 1.25)),
		);
		const bottomOffset = 107.54 - 96.99;
		const baseZoom = Math.log2((768 / 2 - 28) / bottomOffset);
		const peninsulaZoom = Math.log2(768 / (107.54 - 93.34));
		const targetZoom = Math.max(
			Math.min(baseZoom, 19, peninsulaZoom),
			minZoom,
		);
		// 1024 px no supera el umbral de escritorio ancho: sin INITIAL_ZOOM_PAD,
		// el zoom inicial coincide con el target (no hay -0.4). El floor real es
		// el zoom mínimo absoluto (3), no el encuadre.
		const expectedFramed = Math.max(targetZoom, 3);
		expect(mapInstance.setMinZoom).toHaveBeenCalledWith(expectedFramed);
		expect(mapInstance.setView).toHaveBeenCalledWith([36.5, -6.9], expectedFramed, {
			animate: false,
		});
		expect(mapInstance.options.zoomSnap).toBe(0.5);
	});

	it('en móvil deja margen para mostrar Baleares sin perder Canarias', async () => {
		mapState.size = { x: 400, y: 700 };
		mapState.southWest = { x: 50, y: 650 };
		mapState.northEast = { x: 360, y: 150 };
		Object.defineProperty(window, 'innerWidth', { value: 412, configurable: true });

		render(<LeafletMap stations={stations} center={[40.4168, -3.7038]} zoom={13} bounds={SPAIN_BOUNDS} />);

		await waitFor(() => expect(leafletMock.map).toHaveBeenCalledTimes(1));
		const mapInstance = leafletMock.map.mock.results[0].value as {
			setMinZoom: ReturnType<typeof vi.fn>;
			setView: ReturnType<typeof vi.fn>;
			unproject: ReturnType<typeof vi.fn>;
			options: { zoomSnap: number };
		};
		const [swLat, swLng] = SPAIN_BOUNDS[0];
		const [neLat, neLng] = SPAIN_BOUNDS[1];
		const latSpan = neLat - swLat;
		const lngSpan = neLng - swLng;
		const baseMinZoom = Math.max(
			Math.min(
				Math.log2((400 * 0.97) / (136.5 - 115.09)),
				Math.log2(700 / (107.54 - 84.27)),
			),
			Math.log2(400 / ((136.5 - 115.09) * 1.25)),
		);
		// En móvil el margen este del área desplazable se reduce (0.05) para
		// no dejar océano navegable a la derecha de la península; el oeste
		// conserva su margen (0.2) para que Canarias no queden cortadas.
		expect(leafletMock.latLngBounds).toHaveBeenCalledWith(
			[swLat - latSpan * 0.35, swLng - lngSpan * 0.2],
			[50, neLng + lngSpan * 0.05],
		);
		// En móvil se aleja ligeramente para que quepan las Baleares completas.
		expect(mapInstance.setMinZoom).toHaveBeenCalledWith(baseMinZoom + 0.4);
		// La vista inicial ancla el borde oeste (Canarias) en el margen que
		// dejaba la vista centrada: las islas siguen en el mismo sitio.
		expect(mapInstance.unproject).toHaveBeenCalledWith(
			[50 + 400 / 2 - (400 * (1 - 0.97)) / 2, (150 + 650) / 2],
			baseMinZoom + 0.4,
		);
		expect(mapInstance.setView).toHaveBeenCalledWith([36.5, -6.9], baseMinZoom + 0.4, {
			animate: false,
		});
		expect(mapInstance.options.zoomSnap).toBe(0.5);
	});

	it('en tableta la vista inicial es el zoom mínimo con España centrada', async () => {
		mapState.size = { x: 834, y: 600 };
		mapState.zoom = 4;
		Object.defineProperty(window, 'innerWidth', { value: 834, configurable: true });

		render(<LeafletMap stations={stations} center={[40.4168, -3.7038]} zoom={13} bounds={SPAIN_BOUNDS} />);

		await waitFor(() => expect(leafletMock.map).toHaveBeenCalledTimes(1));
		const mapInstance = leafletMock.map.mock.results[0].value as {
			setMinZoom: ReturnType<typeof vi.fn>;
			setView: ReturnType<typeof vi.fn>;
			options: { zoomSnap: number };
		};
		const boundsWidth = 136.5 - 115.09;
		const boundsHeight = 107.54 - 84.27;
		const baseMinZoom = Math.max(
			Math.min(
				Math.log2((834 * 0.97) / boundsWidth),
				Math.log2(600 / boundsHeight),
			),
			Math.log2(834 / (boundsWidth * 1.25)),
		);
		// La tableta (768-1023 px) no sube el zoom mínimo como el móvil.
		expect(mapInstance.setMinZoom).toHaveBeenCalledWith(baseMinZoom);
		// Aunque la altura limite el encuadre, la vista inicial de tableta es
		// la de España entera centrada al zoom mínimo (sin el anclaje de la
		// península que la dejaba pegada arriba).
		expect(mapInstance.setView).toHaveBeenCalledWith([39.9, -3.1], baseMinZoom, {
			animate: false,
		});
		expect(mapInstance.options.zoomSnap).toBe(0.5);
	});

	it('clama el centro durante el pellizco para no salir de los límites', async () => {
		render(<LeafletMap stations={stations} center={[40.4168, -3.7038]} zoom={13} bounds={SPAIN_BOUNDS} />);

		await waitFor(() => expect(leafletMock.map).toHaveBeenCalledTimes(1));
		const mapInstance = leafletMock.map.mock.results[0].value as {
			getCenter: ReturnType<typeof vi.fn>;
			getZoom: ReturnType<typeof vi.fn>;
			_limitCenter: ReturnType<typeof vi.fn>;
			panTo: ReturnType<typeof vi.fn>;
			on: ReturnType<typeof vi.fn>;
			touchZoom: { _center?: { lat: number; lng: number } };
			options: { maxBounds?: unknown };
		};
		mapInstance.options.maxBounds = {};
		mapInstance.getCenter.mockReturnValue({ lat: 52.5, lng: 14 });
		mapInstance.getZoom.mockReturnValue(4);
		mapInstance._limitCenter.mockReturnValue({ lat: 50, lng: 5 });
		// Leaflet expone el gesto de pellizco como `map.touchZoom`.
		mapInstance.touchZoom = { _center: { lat: 52.5, lng: 14 } };

		const moveHandler = mapInstance.on.mock.calls.find(
			([event]) => event === 'move',
		)?.[1] as () => void;
		const zoomHandler = mapInstance.on.mock.calls.find(
			([event]) => event === 'zoom',
		)?.[1] as () => void;
		expect(moveHandler).toBeDefined();
		expect(zoomHandler).toBeDefined();

		// El centro fuera de los límites se devuelve dentro con un movimiento
		// inmediato (sin animación para no encadenar gestos).
		act(() => {
			moveHandler();
		});
		expect(mapInstance.panTo).toHaveBeenCalledWith({ lat: 50, lng: 5 }, { animate: false });
		// El gesto de pellizco mantiene su centro interno clampeado para que al
		// soltar la animación no salga fuera de los límites y rebote.
		expect(mapInstance.touchZoom._center).toEqual({ lat: 50, lng: 5 });

		// Dentro de los límites el manejador no fuerza ningún movimiento.
		mapInstance.panTo.mockClear();
		mapInstance.getCenter.mockReturnValue({ lat: 40.4, lng: -3.7 });
		mapInstance._limitCenter.mockReturnValue({ lat: 40.4, lng: -3.7 });
		act(() => {
			moveHandler();
			zoomHandler();
		});
		expect(mapInstance.panTo).not.toHaveBeenCalled();
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

	it('no recarga el viewport mientras un popup hace auto-pan', async () => {
		const listener = vi.fn();
		window.addEventListener(VIEWPORT_EVENT, listener);

		render(<LeafletMap stations={stations} center={[40.4168, -3.7038]} zoom={13} />);
		await waitFor(() => expect(leafletMock.map).toHaveBeenCalledTimes(1));
		listener.mockClear();

		const mapInstance = leafletMock.map.mock.results[0].value as {
			on: ReturnType<typeof vi.fn>;
		};
		const popupOpenHandler = mapInstance.on.mock.calls.find(
			([event]) => event === 'popupopen',
		)?.[1] as () => void;
		const popupCloseHandler = mapInstance.on.mock.calls.find(
			([event]) => event === 'popupclose',
		)?.[1] as () => void;
		const moveendHandler = mapInstance.on.mock.calls.find(
			([event]) => event === 'moveend',
		)?.[1] as () => void;

		act(() => {
			popupOpenHandler();
			moveendHandler();
		});
		await new Promise((resolve) => setTimeout(resolve, 350));
		expect(listener).not.toHaveBeenCalled();

		act(() => popupCloseHandler());
		expect(listener).toHaveBeenCalledOnce();
		window.removeEventListener(VIEWPORT_EVENT, listener);
	});
});
