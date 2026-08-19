import { MOBILE_SHEET_MEDIA_QUERY } from '../lib/useMediaQuery';

const FORM_FIELD_TAGS = new Set(['INPUT', 'SELECT', 'TEXTAREA']);

function isFormField(target: EventTarget | null): boolean {
	return target instanceof HTMLElement && FORM_FIELD_TAGS.has(target.tagName);
}

/**
 * Añade al panel `<details>` el comportamiento esperado en un panel accesible:
 * mantiene `aria-expanded` en el `<summary>`, permite cerrarlo con Escape
 * (solo en el layout móvil, donde es una hoja plegable) y reabre la hoja al
 * volver al layout de escritorio por si el usuario la plegó en móvil (si
 * quedara cerrada, la columna lateral se vería vacía al rotar o ensanchar la
 * ventana). Devuelve una función de limpieza.
 */
export function enhanceExplorerPanel(details: HTMLDetailsElement): () => void {
	const summary = details.querySelector('summary');
	if (!summary) {
		return () => {};
	}

	const sheetQuery = window.matchMedia(MOBILE_SHEET_MEDIA_QUERY);

	const updateExpanded = () => {
		summary.setAttribute('aria-expanded', String(details.open));
	};

	const openOnDesktop = () => {
		if (!sheetQuery.matches && !details.open) {
			details.open = true;
			updateExpanded();
		}
	};

	const handleKeyDown = (event: KeyboardEvent) => {
		if (event.key !== 'Escape') return;
		if (isFormField(event.target)) return;
		// En escritorio el resumen está oculto y el panel es una columna fija;
		// cerrarlo con Escape dejaría la columna vacía sin forma de reabrirla.
		if (!sheetQuery.matches) return;
		if (!details.open) return;

		details.open = false;
		updateExpanded();
		summary.focus();
	};

	updateExpanded();
	details.addEventListener('toggle', updateExpanded);
	details.addEventListener('keydown', handleKeyDown);
	if (typeof sheetQuery.addEventListener === 'function') {
		sheetQuery.addEventListener('change', openOnDesktop);
	}

	return () => {
		details.removeEventListener('toggle', updateExpanded);
		details.removeEventListener('keydown', handleKeyDown);
		if (typeof sheetQuery.removeEventListener === 'function') {
			sheetQuery.removeEventListener('change', openOnDesktop);
		}
	};
}
