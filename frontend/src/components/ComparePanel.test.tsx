import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import ComparePanel from './ComparePanel';
import {
	COMPARE_EVENT,
	STATION_SELECT_EVENT,
	STATIONS_EVENT,
	STATION_DETAIL_EVENT,
} from '../lib/explorerEvents';
import { LOCATION_EVENT } from '../lib/geolocation';
import type { NearbyStation } from '../lib/stations';

function station(overrides: Partial<NearbyStation> = {}): NearbyStation {
	return {
		id: 's1',
		rotulo: 'Estación Norte',
		direccion: 'Calle Mayor 1',
		localidad: 'Madrid',
		provincia: 'Madrid',
		latitud: 40.42,
		longitud: -3.7,
		distanciaKm: 1.2,
		precio: 1.459,
		ahorro: 0,
		fechaActualizacion: new Date().toISOString(),
		...overrides,
	};
}

function publish(stations: NearbyStation[]) {
	act(() => {
		window.dispatchEvent(new CustomEvent(STATIONS_EVENT, { detail: { stations } }));
	});
}

function select(id: string) {
	act(() => {
		window.dispatchEvent(new CustomEvent(STATION_SELECT_EVENT, { detail: { id } }));
	});
}

function locate(lat = 40.4168, lon = -3.7038) {
	act(() => {
		window.dispatchEvent(new CustomEvent(LOCATION_EVENT, { detail: { lat, lon, source: 'search' } }));
	});
}

describe('ComparePanel — columna de comparación', () => {
	afterEach(() => {
		vi.restoreAllMocks();
		document.body.innerHTML = '';
	});

	it('no muestra nada sin estaciones añadidas', () => {
		render(<ComparePanel />);
		expect(screen.queryByRole('heading', { name: 'Comparar' })).toBeNull();
	});

	it('muestra el panel con título, cuenta y datos al añadir una estación', () => {
		render(<ComparePanel />);
		publish([station()]);
		locate();

		select('s1');

		expect(screen.getByRole('heading', { name: 'Comparar' })).toBeInTheDocument();
		expect(screen.getByText('1 gasolinera')).toBeInTheDocument();
		expect(screen.getByText('Estación Norte')).toBeInTheDocument();
		expect(screen.getByText('1,459 €/l')).toBeInTheDocument();
		expect(screen.getByText(/km/)).toBeInTheDocument();
		expect(screen.getByText('Actualizado')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Ver ficha' })).toBeInTheDocument();
	});

	it('no muestra la distancia sin una ubicación marcada en el mapa', () => {
		render(<ComparePanel />);
		publish([station()]);

		select('s1');

		expect(screen.queryByText(/km/)).toBeNull();
		expect(screen.getByText('—')).toBeInTheDocument();
	});

	it('actualiza la distancia al cambiar la ubicación marcada', () => {
		render(<ComparePanel />);
		publish([station({ latitud: 40, longitud: -3 })]);
		select('s1');

		locate(40, -3);
		expect(screen.getByText('0 km')).toBeInTheDocument();

		locate(41, -3);
		expect(screen.getByText('111,2 km')).toBeInTheDocument();
	});

	it('conserva los datos de las estaciones aunque dejen de estar en los resultados', () => {
		render(<ComparePanel />);
		publish([station()]);
		locate();
		select('s1');
		expect(screen.getByText('1,459 €/l')).toBeInTheDocument();

		publish([]);
		expect(screen.getByText('1,459 €/l')).toBeInTheDocument();
		expect(screen.getByText(/km/)).toBeInTheDocument();
	});

	it('marca la fecha de actualización cuando el precio es antiguo', () => {
		render(<ComparePanel />);
		publish([station({ fechaActualizacion: '2026-01-01T10:00:00Z' })]);
		locate();
		select('s1');

		const date = screen.getByText('Actualizado').nextElementSibling;
		expect(date).toHaveClass('compare-panel__stale');
	});

	it('no muestra la fecha cuando no es válida', () => {
		render(<ComparePanel />);
		publish([station({ fechaActualizacion: 'no-es-fecha' })]);

		select('s1');

		expect(screen.queryByText('Actualizado')).toBeNull();
	});

	it('añade varias estaciones en orden y suma la cuenta', () => {
		render(<ComparePanel />);
		publish([station(), station({ id: 's2', rotulo: 'Gasolinera Sur', precio: 1.7 })]);

		select('s1');
		select('s2');

		const entries = screen.getAllByRole('heading', { name: /Estación|Sur/ });
		expect(entries).toHaveLength(2);
		expect(entries[0]).toHaveTextContent('Estación Norte');
		expect(entries[1]).toHaveTextContent('Gasolinera Sur');
		expect(screen.getByText('2 gasolineras')).toBeInTheDocument();
	});

	it('un clic en una estación ya añadida la quita y oculta el panel al vaciarse', () => {
		render(<ComparePanel />);
		publish([station()]);

		select('s1');
		expect(screen.getByRole('heading', { name: 'Comparar' })).toBeInTheDocument();

		select('s1');
		expect(screen.queryByRole('heading', { name: 'Comparar' })).toBeNull();
	});

	it('el botón X quita la estación sin afectar al resto', () => {
		render(<ComparePanel />);
		publish([station(), station({ id: 's2', rotulo: 'Gasolinera Sur' })]);

		select('s1');
		select('s2');

		fireEvent.click(screen.getByRole('button', { name: 'Quitar Estación Norte' }));

		expect(screen.queryByText('Estación Norte')).toBeNull();
		expect(screen.getByText('Gasolinera Sur')).toBeInTheDocument();
		expect(screen.getByText('1 gasolinera')).toBeInTheDocument();
	});

	it('ignora la selección de una estación que no está entre los resultados', () => {
		render(<ComparePanel />);
		publish([station({ id: 's1' })]);

		select('s999');

		expect(screen.queryByRole('heading', { name: 'Comparar' })).toBeNull();
	});

	it('refresca precios y distancias de las estaciones añadidas', () => {
		render(<ComparePanel />);
		publish([station({ precio: 1.459 })]);
		select('s1');
		expect(screen.getByText('1,459 €/l')).toBeInTheDocument();

		publish([station({ precio: 1.5 })]);
		expect(screen.getByText('1,500 €/l')).toBeInTheDocument();
	});

	it('publica el conjunto de ids al añadir y al quitar', () => {
		render(<ComparePanel />);
		publish([station(), station({ id: 's2' })]);
		const compareEvents: Array<{ ids: string[]; added: string | null }> = [];
		const listener = (event: Event) => {
			compareEvents.push((event as CustomEvent<{ ids: string[]; added: string | null }>).detail);
		};
		window.addEventListener(COMPARE_EVENT, listener);

		select('s1');
		expect(compareEvents.at(-1)).toEqual({ ids: ['s1'], added: 's1' });

		select('s2');
		expect(compareEvents.at(-1)).toEqual({ ids: ['s1', 's2'], added: 's2' });

		select('s1');
		expect(compareEvents.at(-1)).toEqual({ ids: ['s2'], added: null });
		window.removeEventListener(COMPARE_EVENT, listener);
	});

	it('abre la ficha con «Ver ficha»', () => {
		render(<ComparePanel />);
		publish([station()]);
		const detailEvents: Array<string | null> = [];
		window.addEventListener(STATION_DETAIL_EVENT, (event) => {
			detailEvents.push((event as CustomEvent<{ id: string | null }>).detail.id);
		});

		select('s1');
		fireEvent.click(screen.getByRole('button', { name: 'Ver ficha' }));

		expect(detailEvents).toEqual(['s1']);
	});
});
