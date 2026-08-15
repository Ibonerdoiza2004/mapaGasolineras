const configuredApiUrl = import.meta.env.PUBLIC_API_URL?.trim();

/** URL base del backend configurada por el entorno de despliegue. */
export const API_URL = configuredApiUrl ? configuredApiUrl.replace(/\/$/, '') : undefined;

export function apiUrl(path: string): string {
  if (!API_URL) {
    throw new Error('PUBLIC_API_URL no está configurada');
  }

  return `${API_URL}/${path.replace(/^\//, '')}`;
}
