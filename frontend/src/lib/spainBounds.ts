/** Límites ajustados al territorio español, con un pequeño margen exterior. */
export const SPAIN_BOUNDS: [[number, number], [number, number]] = [
	[27.35, -18.45],
	[44.15, 4.75],
];

/** Centro visual de la España peninsular para búsquedas y reencuadres. */
export const PENINSULA_CENTER: [number, number] = [39.9, -3.1];

/**
 * Latitud del borde norte de la España peninsular (costa de A Coruña).
 * Limita el zoom de la vista inicial para que la península nunca quede
 * cortada por arriba cuando el zoom mínimo lo fija la anchura del viewport.
 */
export const PENINSULA_NORTH_LAT = 43.8;
