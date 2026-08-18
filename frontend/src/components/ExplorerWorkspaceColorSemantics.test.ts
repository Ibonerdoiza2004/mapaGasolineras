import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const stationListSource = readFileSync(
	resolve(process.cwd(), 'src/components/StationList.tsx'),
	'utf8',
);
const stationsLibSource = readFileSync(resolve(process.cwd(), 'src/lib/stations.ts'), 'utf8');
const explorerCss = readFileSync(resolve(process.cwd(), 'src/styles/explorer.css'), 'utf8');

function normalize(css: string) {
	return css.replace(/\s+/g, ' ').trim();
}

describe('semántica de color — precio, ahorro y combustible', () => {
	it('expresa el combustible con texto además del color', () => {
		expect(stationListSource).toContain('{fuelLabel(fuel)}');
		expect(stationListSource).toContain('station-card__fuel-dot');
	});

	it('marca el punto de color del combustible como decorativo', () => {
		expect(stationListSource).toContain(
			'<span className="station-card__fuel-dot" aria-hidden="true" />',
		);
	});

	it('usa un color por combustible pero mantiene el texto en color neutro', () => {
		const css = normalize(explorerCss);
		expect(css).toContain('.station-card__fuel--diesel .station-card__fuel-dot {');
		expect(css).toContain('.station-card__fuel--gasolina-95 .station-card__fuel-dot {');
		expect(css).toContain('.station-card__fuel--gasolina-98 .station-card__fuel-dot {');
		expect(css).toContain('.station-card__fuel {');
		expect(css).toContain('color: var(--color-text-muted);');
	});

	it('expresa el ahorro con una etiqueta de texto', () => {
		expect(stationListSource).toContain('Cuesta ');
		expect(stationListSource).toContain('station-card__savings');
	});

	it('incluye la unidad en el precio para que no dependa solo del color', () => {
		expect(stationsLibSource).toContain('€/l');
	});
});