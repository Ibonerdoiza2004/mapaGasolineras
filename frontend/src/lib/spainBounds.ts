/**
 * Límites geográficos para la vista inicial del mapa, centrados en la península.
 * El rectángulo es simétrico respecto al centro de la península (≈39,9ºN, 3,1ºO)
 * y se extiende justo hasta el extremo suroeste de Canarias (El Hierro: 27,63ºN,
 * 18,16ºO), de modo que la península queda centrada y Canarias entran justas.
 */
export const SPAIN_BOUNDS: [[number, number], [number, number]] = [
	[27.63, -18.16],
	[52.17, 11.96],
];

/**
 * Centro visual de la España peninsular. El punto medio en píxeles del
 * rectángulo de SPAIN_BOUNDS queda en lat ~41,1º por la distorsión de
 * Mercator, así que para centrar la península hay que apuntar a este punto.
 */
export const PENINSULA_CENTER: [number, number] = [39.9, -3.1];
