import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const workspaceAstro = readFileSync(
	resolve(process.cwd(), 'src/components/ExplorerWorkspace.astro'),
	'utf8',
);
const explorerCss = readFileSync(resolve(process.cwd(), 'src/styles/explorer.css'), 'utf8');

function normalize(css: string) {
	return css.replace(/\s+/g, ' ').trim();
}

describe('semántica de color — precio, ahorro y combustible', () => {
	it('expresa el combustible con texto además del color', () => {
		expect(workspaceAstro).toContain('{station.fuel}');
		expect(workspaceAstro).toContain('station-card__fuel-dot');
	});

	it('marca el punto de color del combustible como decorativo', () => {
		expect(workspaceAstro).toContain(
			'<span class="station-card__fuel-dot" aria-hidden="true"></span>',
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
		expect(workspaceAstro).toContain("tag: 'Mejor precio'");
		expect(workspaceAstro).toContain('{station.tag && <span class="station-card__tag">{station.tag}</span>}');
	});

	it('incluye la unidad en el precio para que no dependa solo del color', () => {
		expect(workspaceAstro).toContain('€/l');
	});
});
