export const navigationItems = [
	{ label: 'Explorar', href: '/', section: 'explore' },
	{ label: 'Rutas', href: '/rutas', section: 'routes' },
] as const;

export type NavigationSection = (typeof navigationItems)[number]['section'];

export function getActiveSection(pathname: string): NavigationSection | null {
	if (pathname === '/') return 'explore';
	if (pathname === '/rutas' || pathname.startsWith('/rutas/')) return 'routes';
	return null;
}
