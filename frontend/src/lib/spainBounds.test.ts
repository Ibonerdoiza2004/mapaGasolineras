import { describe, expect, it } from 'vitest';

import { PENINSULA_CENTER, SPAIN_BOUNDS } from './spainBounds';

const [[south, west], [north, east]] = SPAIN_BOUNDS;

function isInside(lat: number, lon: number): boolean {
	return lat >= south && lat <= north && lon >= west && lon <= east;
}

describe('SPAIN_BOUNDS', () => {
	it('define un centro visual para la península dentro del encuadre', () => {
		expect(PENINSULA_CENTER).toEqual([39.9, -3.1]);
		expect(isInside(PENINSULA_CENTER[0], PENINSULA_CENTER[1])).toBe(true);
	});

	it('se ajusta a España sin el gran margen artificial que ocultaba Canarias', () => {
		expect(north - south).toBeLessThan(17);
		expect(east - west).toBeLessThan(24);
		expect(north).toBeLessThan(45);
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

	it('las Canarias tienen margen por el suroeste', () => {
		expect(isInside(27.63, -18.16)).toBe(true);
		expect(isInside(27.34, -18.16)).toBe(false);
		expect(isInside(27.63, -18.46)).toBe(false);
	});

	it('excluye puntos fuera del encuadre', () => {
		expect(isInside(53.35, -6.26)).toBe(false); // Dublín (al norte)
		expect(isInside(18.07, -15.96)).toBe(false); // Nouakchott (al sur)
		expect(isInside(37.98, 23.73)).toBe(false); // Atenas (al este)
		expect(isInside(34.05, -118.24)).toBe(false); // Los Ángeles (al oeste)
	});
});
