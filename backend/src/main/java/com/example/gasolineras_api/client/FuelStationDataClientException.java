package com.example.gasolineras_api.client;

/**
 * Excepción lanzada cuando ocurre un error al comunicarse con el proveedor de datos.
 */
public class FuelStationDataClientException extends RuntimeException {

	private final boolean providerUnavailable;

	public FuelStationDataClientException(String message, Throwable cause) {
		super(message, cause);
		this.providerUnavailable = false;
	}

	public FuelStationDataClientException(String message, boolean providerUnavailable) {
		super(message);
		this.providerUnavailable = providerUnavailable;
	}

	public FuelStationDataClientException(String message, Throwable cause, boolean providerUnavailable) {
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
