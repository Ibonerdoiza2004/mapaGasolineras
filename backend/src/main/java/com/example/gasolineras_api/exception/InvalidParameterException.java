package com.example.gasolineras_api.exception;

/**
 * Excepción para parámetros de entrada inválidos. Produce un error 400.
 */
public class InvalidParameterException extends RuntimeException {

	private final String parameter;

	public InvalidParameterException(String parameter, String message) {
		super(message);
		this.parameter = parameter;
	}

	public String getParameter() {
		return parameter;
	}
}
