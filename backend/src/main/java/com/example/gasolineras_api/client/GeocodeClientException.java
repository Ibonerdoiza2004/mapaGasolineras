package com.example.gasolineras_api.client;

/**
 * Excepción lanzada cuando ocurre un error al comunicarse con el
 * proveedor de geocodificación.
 */
public class GeocodeClientException extends RuntimeException {

	private final boolean providerUnavailable;

	public GeocodeClientException(String message, Throwable cause) {
		super(message, cause);
		this.providerUnavailable = false;
	}

	public GeocodeClientException(String message, boolean providerUnavailable) {
		super(message);
		this.providerUnavailable = providerUnavailable;
	}

	public GeocodeClientException(String message, Throwable cause, boolean providerUnavailable) {
		super(message, cause);
		this.providerUnavailable = providerUnavailable;
	}

	/**
	 * Indica si el proveedor externo no está disponible.
	 */
	public boolean isProviderUnavailable() {
		return providerUnavailable;
	}
}