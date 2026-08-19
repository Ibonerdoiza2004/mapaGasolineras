import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { enhanceExplorerPanel } from './explorerPanel';
import { MOBILE_MEDIA_QUERY, MOBILE_SHEET_MEDIA_QUERY } from '../lib/useMediaQuery';

type ChangeListener = (event: { matches: boolean }) => void;

const listenersByQuery = new Map<string, Set<ChangeListener>>();
let matchesByQuery = new Map<string, boolean>();

function matchMediaMock(query: string): MediaQueryList {
	return {
		get matches() {
			return matchesByQuery.get(query) ?? false;
		},
		media: query,
		onchange: null,
		addListener: () => undefined,
		removeListener: () => undefined,
		dispatchEvent: () => false,
		addEventListener: (_type: string, listener: ChangeListener) => {
			const set = listenersByQuery.get(query) ?? new Set();
			set.add(listener);
			listenersByQuery.set(query, set);
		},
		removeEventListener: (_type: string, listener: ChangeListener) => {
			listenersByQuery.get(query)?.delete(listener);
		},
	} as unknown as MediaQueryList;
}

function setMediaQuery(query: string, matches: boolean) {
	matchesByQuery.set(query, matches);
	if (query === MOBILE_MEDIA_QUERY) matchesByQuery.set(MOBILE_SHEET_MEDIA_QUERY, matches);
	for (const listener of [...(listenersByQuery.get(query) ?? [])]) {
		listener({ matches });
	}
	if (query === MOBILE_MEDIA_QUERY) {
		for (const listener of [...(listenersByQuery.get(MOBILE_SHEET_MEDIA_QUERY) ?? [])]) {
			listener({ matches });
		}
	}
}

function createPanel(open = false) {
	const details = document.createElement('details');
	details.className = 'explorer__sidebar';
	details.open = open;

	const summary = document.createElement('summary');
	summary.textContent = 'Gasolineras cercanas';
	details.appendChild(summary);

	const content = document.createElement('div');
	content.className = 'explorer__sidebar-content';
	details.appendChild(content);

	document.body.appendChild(details);
	return { details, summary, content };
}

function press(target: EventTarget, key: string) {
	target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
}

beforeEach(() => {
	matchesByQuery = new Map([
		[MOBILE_MEDIA_QUERY, true],
		[MOBILE_SHEET_MEDIA_QUERY, true],
	]);
	listenersByQuery.clear();
	vi.spyOn(window, 'matchMedia').mockImplementation(matchMediaMock);
});

afterEach(() => {
	document.body.innerHTML = '';
	vi.restoreAllMocks();
});

describe('enhanceExplorerPanel', () => {
	it('refleja el estado inicial del panel en aria-expanded', () => {
		const closed = createPanel(false);
		enhanceExplorerPanel(closed.details);
		expect(closed.summary).toHaveAttribute('aria-expanded', 'false');

		const opened = createPanel(true);
		enhanceExplorerPanel(opened.details);
		expect(opened.summary).toHaveAttribute('aria-expanded', 'true');
	});

	it('sincroniza aria-expanded cuando cambia el estado open', () => {
		const { details, summary } = createPanel(true);
		enhanceExplorerPanel(details);

		details.open = false;
		details.dispatchEvent(new Event('toggle'));

		expect(summary).toHaveAttribute('aria-expanded', 'false');
	});

	it('Escape cierra el panel abierto y devuelve el foco al resumen (móvil)', () => {
		const { details, summary } = createPanel(true);
		enhanceExplorerPanel(details);
		summary.focus();

		press(summary, 'Escape');

		expect(details.open).toBe(false);
		expect(summary).toHaveAttribute('aria-expanded', 'false');
		expect(document.activeElement).toBe(summary);
	});

	it('Escape dentro del panel cierra y devuelve el foco al resumen (móvil)', () => {
		const { details, summary, content } = createPanel(true);
		enhanceExplorerPanel(details);

		press(content, 'Escape');

		expect(details.open).toBe(false);
		expect(document.activeElement).toBe(summary);
	});

	it('Escape no cierra el panel en el layout de escritorio', () => {
		setMediaQuery(MOBILE_MEDIA_QUERY, false);
		const { details, summary } = createPanel(true);
		enhanceExplorerPanel(details);
		summary.focus();

		press(summary, 'Escape');

		expect(details.open).toBe(true);
		expect(summary).toHaveAttribute('aria-expanded', 'true');
	});

	it('Escape dentro de un campo de formulario no cierra el panel', () => {
		const { details, content } = createPanel(true);
		enhanceExplorerPanel(details);

		const input = document.createElement('input');
		input.type = 'search';
		content.appendChild(input);
		input.focus();

		press(input, 'Escape');

		expect(details.open).toBe(true);
	});

	it('Escape no hace nada cuando el panel ya está cerrado', () => {
		const { details, summary } = createPanel(false);
		enhanceExplorerPanel(details);

		press(summary, 'Escape');

		expect(details.open).toBe(false);
		expect(summary).toHaveAttribute('aria-expanded', 'false');
	});

	it('otras teclas no cierran el panel', () => {
		const { details, summary } = createPanel(true);
		enhanceExplorerPanel(details);

		press(summary, 'Enter');
		press(summary, 'a');

		expect(details.open).toBe(true);
	});

	it('reabre la hoja plegada en móvil al pasar a escritorio', () => {
		const { details, summary } = createPanel(false);
		enhanceExplorerPanel(details);
		expect(details.open).toBe(false);

		setMediaQuery(MOBILE_MEDIA_QUERY, false);

		expect(details.open).toBe(true);
		expect(summary).toHaveAttribute('aria-expanded', 'true');
	});

	it('no toca el estado al pasar de escritorio a móvil', () => {
		setMediaQuery(MOBILE_MEDIA_QUERY, false);
		const { details, summary } = createPanel(true);
		enhanceExplorerPanel(details);

		setMediaQuery(MOBILE_MEDIA_QUERY, true);

		expect(details.open).toBe(true);
		expect(summary).toHaveAttribute('aria-expanded', 'true');
	});

	it('deja el panel abierto si ya lo estaba al volver a escritorio', () => {
		const { details } = createPanel(true);
		enhanceExplorerPanel(details);

		setMediaQuery(MOBILE_MEDIA_QUERY, false);

		expect(details.open).toBe(true);
	});

	it('la limpieza desactiva los listeners y deja de actualizar el estado', () => {
		const { details, summary } = createPanel(true);
		const cleanup = enhanceExplorerPanel(details);
		cleanup();

		details.open = false;
		details.dispatchEvent(new Event('toggle'));
		press(summary, 'Escape');

		expect(summary).toHaveAttribute('aria-expanded', 'true');
	});

	it('la limpieza desactiva también la reapertura al pasar a escritorio', () => {
		const { details, summary } = createPanel(false);
		const cleanup = enhanceExplorerPanel(details);
		cleanup();

		setMediaQuery(MOBILE_MEDIA_QUERY, false);

		expect(details.open).toBe(false);
		expect(summary).toHaveAttribute('aria-expanded', 'false');
	});

	it('devuelve una función inofensiva si el details no tiene summary', () => {
		const details = document.createElement('details');
		document.body.appendChild(details);

		const cleanup = enhanceExplorerPanel(details);
		expect(() => cleanup()).not.toThrow();
	});
});
