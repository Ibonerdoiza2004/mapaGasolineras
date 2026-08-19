import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { MOBILE_MEDIA_QUERY, useMediaQuery } from './useMediaQuery';

describe('MOBILE_MEDIA_QUERY', () => {
	it('distingue móvil horizontal de tablet horizontal', () => {
		expect(MOBILE_MEDIA_QUERY).toBe(
			'(max-width: 48rem), (max-width: 60rem) and (max-height: 30rem)',
		);
	});
});

describe('useMediaQuery', () => {
	it('devuelve el valor actual de la media query', () => {
		const mql = {
			matches: true,
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
		};
		vi.spyOn(window, 'matchMedia').mockReturnValue(mql as unknown as MediaQueryList);

		const { result } = renderHook(() => useMediaQuery(MOBILE_MEDIA_QUERY));

		expect(result.current).toBe(true);
		expect(window.matchMedia).toHaveBeenCalledWith(MOBILE_MEDIA_QUERY);
	});

	it('reacciona a los cambios de la media query y limpia su suscripción', () => {
		const listeners = new Set<(event: { matches: boolean }) => void>();
		const mql = {
			matches: false,
			addEventListener: (_type: string, listener: (event: { matches: boolean }) => void) => {
				listeners.add(listener);
			},
			removeEventListener: (_type: string, listener: (event: { matches: boolean }) => void) => {
				listeners.delete(listener);
			},
		};
		vi.spyOn(window, 'matchMedia').mockReturnValue(mql as unknown as MediaQueryList);

		const { result, unmount } = renderHook(() => useMediaQuery(MOBILE_MEDIA_QUERY));

		expect(result.current).toBe(false);

		act(() => {
			for (const listener of listeners) listener({ matches: true });
		});
		expect(result.current).toBe(true);

		unmount();
		expect(listeners.size).toBe(0);
	});

	it('no se rompe si window.matchMedia no está disponible', () => {
		const matchMedia = window.matchMedia;
		Object.defineProperty(window, 'matchMedia', {
			configurable: true,
			value: undefined,
		});

		try {
			const { result } = renderHook(() => useMediaQuery(MOBILE_MEDIA_QUERY));
			expect(result.current).toBe(false);
		} finally {
			Object.defineProperty(window, 'matchMedia', {
				configurable: true,
				value: matchMedia,
			});
		}
	});
});
