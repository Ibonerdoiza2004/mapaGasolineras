package com.example.gasolineras_api.exception;

/**
 * Excepción lanzada cuando se supera el límite de consultas al
 * geocodificador. Produce un error 429.
 */
public class GeocodeRateLimitException extends RuntimeException {

	public GeocodeRateLimitException(String message) {
		super(message);
	}
}