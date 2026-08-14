import { describe, expect, it } from 'vitest';

import { seo } from './seo';

describe('metadatos SEO', () => {
	it('define título y descripción para cada página pública', () => {
		for (const page of Object.values(seo)) {
			expect(page.title.trim()).not.toBe('');
			expect(page.description.trim()).not.toBe('');
		}
	});

	it('mantiene longitudes razonables para buscadores', () => {
		for (const page of Object.values(seo)) {
			expect(page.title.length).toBeLessThanOrEqual(60);
			expect(page.description.length).toBeLessThanOrEqual(160);
		}
	});
});
