import { describe, expect, it } from 'vitest';

import { DEFAULT_FUEL, fuelLabel, isFuelType } from './fuel';

describe('fuel — dominio del combustible', () => {
	it('reconoce los tres combustibles canónicos del backend', () => {
		expect(isFuelType('DIESEL')).toBe(true);
		expect(isFuelType('GASOLINA_95')).toBe(true);
		expect(isFuelType('GASOLINA_98')).toBe(true);
	});

	it('rechaza valores desconocidos, nulos y no cadena', () => {
		expect(isFuelType('HIDROGENO')).toBe(false);
		expect(isFuelType('diesel')).toBe(false);
		expect(isFuelType('')).toBe(false);
		expect(isFuelType(null)).toBe(false);
		expect(isFuelType(undefined)).toBe(false);
		expect(isFuelType(42)).toBe(false);
	});

	it('traduce el valor canónico a su etiqueta española', () => {
		expect(fuelLabel('DIESEL')).toBe('Diésel');
		expect(fuelLabel('GASOLINA_95')).toBe('Gasolina 95');
		expect(fuelLabel('GASOLINA_98')).toBe('Gasolina 98');
	});

	it('el combustible predeterminado es diésel', () => {
		expect(DEFAULT_FUEL).toBe('DIESEL');
	});
});