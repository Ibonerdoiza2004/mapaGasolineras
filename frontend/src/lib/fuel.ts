export type FuelType = 'DIESEL' | 'GASOLINA_95' | 'GASOLINA_98';

export interface FuelOption {
	value: FuelType;
	label: string;
}

/** Opciones del MVP en orden canónico (mismo que el enum del backend). */
export const FUEL_OPTIONS: readonly FuelOption[] = [
	{ value: 'DIESEL', label: 'Diésel' },
	{ value: 'GASOLINA_95', label: 'Gasolina 95' },
	{ value: 'GASOLINA_98', label: 'Gasolina 98' },
] as const;

export const DEFAULT_FUEL: FuelType = 'DIESEL';

const VALID_FUELS = new Set<string>(FUEL_OPTIONS.map((option) => option.value));

/** Acepta solo los valores canónicos del backend; cualquier otro se rechaza. */
export function isFuelType(value: unknown): value is FuelType {
	return typeof value === 'string' && VALID_FUELS.has(value);
}

export function fuelLabel(value: FuelType): string {
	return FUEL_OPTIONS.find((option) => option.value === value)?.label ?? value;
}