const FORM_FIELD_TAGS = new Set(['INPUT', 'SELECT', 'TEXTAREA']);

function isFormField(target: EventTarget | null): boolean {
	return target instanceof HTMLElement && FORM_FIELD_TAGS.has(target.tagName);
}

/**
 * Añade al panel `<details>` el comportamiento de teclado esperado en un panel
 * accesible: mantiene `aria-expanded` en el `<summary>` y permite cerrarlo con
 * Escape devolviendo el foco al resumen. Devuelve una función de limpieza.
 */
export function enhanceExplorerPanel(details: HTMLDetailsElement): () => void {
	const summary = details.querySelector('summary');
	if (!summary) {
		return () => {};
	}

	const updateExpanded = () => {
		summary.setAttribute('aria-expanded', String(details.open));
	};

	const handleKeyDown = (event: KeyboardEvent) => {
		if (event.key !== 'Escape') return;
		if (!details.open) return;
		if (isFormField(event.target)) return;

		details.open = false;
		updateExpanded();
		summary.focus();
	};

	updateExpanded();
	details.addEventListener('toggle', updateExpanded);
	details.addEventListener('keydown', handleKeyDown);

	return () => {
		details.removeEventListener('toggle', updateExpanded);
		details.removeEventListener('keydown', handleKeyDown);
	};
}
