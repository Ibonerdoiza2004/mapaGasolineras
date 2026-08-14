import { describe, expect, it } from 'vitest';

import { getActiveSection, navigationItems } from './navigation';

describe('navegación principal', () => {
	it('define enlaces con etiquetas y destinos válidos', () => {
		expect(navigationItems).toEqual([
			{ label: 'Explorar', href: '/', section: 'explore' },
			{ label: 'Rutas', href: '/rutas', section: 'routes' },
		]);
	});

	it.each([
		['/', 'explore'],
		['/rutas', 'routes'],
		['/rutas/madrid', 'routes'],
	])('marca la sección activa para %s', (pathname, expected) => {
		expect(getActiveSection(pathname)).toBe(expected);
	});

	it.each(['/404', '/cuenta', ''])('no marca una sección para una ruta desconocida: %s', (pathname) => {
		expect(getActiveSection(pathname)).toBeNull();
	});
});
