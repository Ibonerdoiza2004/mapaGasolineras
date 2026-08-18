/** Lee un parámetro de la URL actual. Devuelve null si no está presente. */
export function getUrlParam(name: string): string | null {
	if (typeof window === 'undefined') return null;
	return new URLSearchParams(window.location.search).get(name);
}

/** Escribe un parámetro de la URL con replaceState, conservando el resto.
 *  Un valor null elimina el parámetro (equivale a "sin filtro"). */
export function setUrlParam(name: string, value: string | null): void {
	const url = new URL(window.location.href);
	if (value === null) {
		url.searchParams.delete(name);
	} else {
		url.searchParams.set(name, value);
	}
	window.history.replaceState(null, '', url);
}