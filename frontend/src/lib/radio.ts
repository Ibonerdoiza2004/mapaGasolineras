export interface RadioOption {
	value: number;
	label: string;
}

/** Radios disponibles en kilómetros cuando el interruptor está activado. */
export const RADIO_OPTIONS: readonly RadioOption[] = [
	{ value: 5, label: '5 km' },
	{ value: 10, label: '10 km' },
	{ value: 25, label: '25 km' },
	{ value: 50, label: '50 km' },
] as const;

/** Estado por defecto del filtro: desactivado (se consulta el área del mapa). */
export const DEFAULT_RADIO: number | null = null;

/** Radio que se aplica al activar el interruptor si no había uno elegido. */
export const DEFAULT_RADIUS_KM = 10;

export const RADIO_URL_PARAM = 'radio';

const VALID_RADII = new Set<number>(RADIO_OPTIONS.map((option) => option.value));

/** Acepta solo los radios canónicos (o null para "sin radio"); cualquier otro se rechaza. */
export function isRadioValue(value: unknown): value is number | null {
	return value === null || (typeof value === 'number' && VALID_RADII.has(value));
}

export function radioLabel(value: number): string {
	return RADIO_OPTIONS.find((option) => option.value === value)?.label ?? `${value} km`;
}