package com.example.gasolineras_api.exception;

/**
 * Excepción para recursos inexistentes. Produce un error 404.
 */
public class ResourceNotFoundException extends RuntimeException {

	public ResourceNotFoundException(String message) {
		super(message);
	}
}
