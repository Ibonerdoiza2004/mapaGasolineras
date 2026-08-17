import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

import '@testing-library/jest-dom/vitest';

afterEach(() => {
	cleanup();
});

Object.defineProperty(window, 'matchMedia', {
	configurable: true,
	value: (query: string) => ({
		matches: query === '(prefers-color-scheme: dark)',
		media: query,
		onchange: null,
		addListener: () => undefined,
		removeListener: () => undefined,
		addEventListener: () => undefined,
		removeEventListener: () => undefined,
		dispatchEvent: () => false,
	}),
});
