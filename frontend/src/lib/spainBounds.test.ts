import { describe, expect, it } from 'vitest';

import { SPAIN_BOUNDS } from './spainBounds';

const [[south, west], [north, east]] = SPAIN_BOUNDS;

function isInside(lat: number, lon: number): boolean {
	return lat >= south && lat <= north && lon >= west && lon <= east;
}

describe('SPAIN_BOUNDS', () => {
	it('queda centrado en la península', () => {
		const centerLat = (south + north) / 2;
		const centerLon = (west + east) / 2;
		expect(centerLat).toBeCloseTo(39.9, 1);
		expect(centerLon).toBeCloseTo(-3.1, 1);
	});

	it('incluye la península, Baleares y Canarias', () => {
		expect(isInside(40.4168, -3.7038)).toBe(true); // Madrid
		expect(isInside(41.38, 2.17)).toBe(true); // Barcelona
		expect(isInside(37.38, -5.99)).toBe(true); // Sevilla
		expect(isInside(39.57, 2.65)).toBe(true); // Palma de Mallorca
		expect(isInside(28.12, -15.43)).toBe(true); // Las Palmas de Gran Canaria
		expect(isInside(28.47, -16.25)).toBe(true); // Santa Cruz de Tenerife
		expect(isInside(27.64, -18.16)).toBe(true); // El Hierro (extremo suroeste)
	});

	it('las Canarias entran justas por el suroeste', () => {
		expect(isInside(27.63, -18.16)).toBe(true); // borde sur-oeste, aún dentro
		expect(isInside(27.6, -18.16)).toBe(false); // justo al sur queda fuera
		expect(isInside(27.63, -18.2)).toBe(false); // justo al oeste queda fuera
	});

	it('excluye puntos fuera del encuadre', () => {
		expect(isInside(53.35, -6.26)).toBe(false); // Dublín (al norte)
		expect(isInside(18.07, -15.96)).toBe(false); // Nouakchott (al sur)
		expect(isInside(37.98, 23.73)).toBe(false); // Atenas (al este)
		expect(isInside(34.05, -118.24)).toBe(false); // Los Ángeles (al oeste)
	});
});
