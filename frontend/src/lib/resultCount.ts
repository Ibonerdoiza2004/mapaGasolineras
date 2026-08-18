/** Actualiza los contadores de resultados junto a «Resultados» y el resumen de la hoja inferior. */
export function updateResultCount(count: number): void {
	const label = `${count} ${count === 1 ? 'resultado' : 'resultados'}`;
	document.querySelectorAll<HTMLElement>('.explorer__result-count').forEach((element) => {
		element.textContent = String(count);
		element.setAttribute('aria-label', label);
	});
	const summaryLabel = document.querySelector<HTMLElement>('.explorer__sidebar > summary small');
	if (summaryLabel) {
		summaryLabel.textContent = label;
	}
}