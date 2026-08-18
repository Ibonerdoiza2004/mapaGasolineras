import { describe, expect, it } from 'vitest';

import { clusterizeStations } from './markerCluster';

// Proyección de prueba: convierte lon/lat en píxeles con una escala fija.
function project([lat, lon]: [number, number]) {
	return { x: lon * 4000, y: -lat * 4000 };
}

describe('markerCluster — agrupación de marcadores por proximidad', () => {
	it('devuelve una lista vacía sin estaciones', () => {
		expect(clusterizeStations([], project, 5, 80)).toEqual([]);
	});

	it('agrupa estaciones próximas en un solo clúster con su recuento y centroide', () => {
		const clusters = clusterizeStations(
			[
				{ id: 'a', lat: 40.4168, lon: -3.7038 },
				{ id: 'b', lat: 40.4178, lon: -3.7048 },
				{ id: 'c', lat: 40.4188, lon: -3.7058 },
			],
			project,
			13,
			80,
		);

		expect(clusters).toHaveLength(1);
		expect(clusters[0].count).toBe(3);
		expect(clusters[0].lat).toBeCloseTo(40.4178, 4);
		expect(clusters[0].lon).toBeCloseTo(-3.7048, 4);
	});

	it('mantiene separadas las estaciones alejadas entre sí', () => {
		const clusters = clusterizeStations(
			[
				{ id: 'peninsula', lat: 40.4168, lon: -3.7038 },
				{ id: 'canarias', lat: 27.63, lon: -18.16 },
				{ id: 'norte', lat: 43.8, lon: -7.5 },
			],
			project,
			13,
			80,
		);

		expect(clusters).toHaveLength(3);
		expect(clusters.every((cluster) => cluster.count === 1)).toBe(true);
	});

	it('conserva el orden de primera aparición de cada celda', () => {
		const clusters = clusterizeStations(
			[
				{ id: 'a', lat: 40.403, lon: -3.703 },
				{ id: 'b', lat: 40.405, lon: -3.705 },
				{ id: 'c', lat: 27.6, lon: -18.1 },
			],
			project,
			13,
			80,
		);

		expect(clusters).toHaveLength(2);
		expect(clusters[0].items.map((item) => item.id)).toEqual(['a', 'b']);
		expect(clusters[1].items.map((item) => item.id)).toEqual(['c']);
	});

	it('no rompe con coordenadas negativas ni con un tamaño de celda inválido', () => {
		const clusters = clusterizeStations(
			[
				{ id: 'a', lat: -8.659, lon: 42.037 },
				{ id: 'b', lat: 0, lon: 0 },
			],
			project,
			5,
			0,
		);

		expect(clusters).toHaveLength(2);
	});
});
