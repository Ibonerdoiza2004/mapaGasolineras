package com.example.gasolineras_api.exception;

/**
 * Formato de error consistente de la API: código, mensaje legible y,
 * opcionalmente, detalle de campos.
 */
public record ApiError(
		String code,
		String message,
		java.util.Map<String, String> details
) {

	public ApiError(String code, String message) {
		this(code, message, null);
	}
}
