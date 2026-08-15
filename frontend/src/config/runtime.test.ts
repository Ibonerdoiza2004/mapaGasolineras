import { describe, expect, it } from 'vitest';

import { API_URL, apiUrl } from './runtime';

describe('configuración de runtime', () => {
  it('no contiene una URL de backend implícita', () => {
    expect(API_URL).toBeUndefined();
  });

  it('exige la URL configurada antes de construir una llamada', () => {
    expect(() => apiUrl('/api/stations/nearby')).toThrow('PUBLIC_API_URL');
  });
});
