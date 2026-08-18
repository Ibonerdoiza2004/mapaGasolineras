import { afterEach, describe, expect, it } from 'vitest';

import { updateResultCount } from './resultCount';

afterEach(() => {
	document.body.innerHTML = '';
});

describe('resultCount — contadores de resultados', () => {
	function renderSummary(count: number) {
		document.body.innerHTML = `
			<details class="explorer__sidebar" open>
				<summary>
					<span><strong>Gasolineras cercanas</strong><small>${count} resultados</small></span>
				</summary>
				<span class="explorer__result-count" aria-label="${count} resultados">${count}</span>
			</details>
		`;
	}

	it('actualiza el contador de la cabecera y del resumen', () => {
		renderSummary(12);

		updateResultCount(5);

		const badge = document.querySelector('.explorer__result-count') as HTMLElement;
		expect(badge.textContent).toBe('5');
		expect(badge.getAttribute('aria-label')).toBe('5 resultados');
		expect(document.querySelector('summary small')?.textContent).toBe('5 resultados');
	});

	it('usa singular para un solo resultado', () => {
		renderSummary(12);

		updateResultCount(1);

		const badge = document.querySelector('.explorer__result-count') as HTMLElement;
		expect(badge.getAttribute('aria-label')).toBe('1 resultado');
		expect(document.querySelector('summary small')?.textContent).toBe('1 resultado');
	});

	it('no rompe cuando faltan los elementos', () => {
		expect(() => updateResultCount(0)).not.toThrow();
	});
});