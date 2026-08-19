import { useEffect, useState } from 'react';

/** El móvil horizontal conserva la rejilla con panel izquierdo, pero mantiene
 * el comportamiento móvil (sin comparador y con ficha directa). El límite de
 * 60rem deja fuera la tablet horizontal de 1024px. */
export const MOBILE_MEDIA_QUERY =
	'(max-width: 48rem), (max-width: 60rem) and (max-height: 30rem)';
/** Breakpoint del panel inferior. En móvil horizontal vuelve la rejilla y la
 * columna izquierda debe estar abierta aunque siga siendo comportamiento móvil. */
export const MOBILE_SHEET_MEDIA_QUERY = '(max-width: 48rem)';

/**
 * Observa una media query del navegador y devuelve si se cumple en el momento
 * actual. En el render inicial del servidor (SSR) devuelve false para que el
 * HTML servido coincida con la variante de escritorio.
 */
export function useMediaQuery(query: string): boolean {
	const [matches, setMatches] = useState(() => {
		if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
			return false;
		}
		return window.matchMedia(query).matches;
	});

	useEffect(() => {
		if (typeof window.matchMedia !== 'function') return;
		const mql = window.matchMedia(query);
		const onChange = (event: MediaQueryListEvent) => setMatches(event.matches);
		setMatches(mql.matches);
		mql.addEventListener('change', onChange);
		return () => mql.removeEventListener('change', onChange);
	}, [query]);

	return matches;
}
