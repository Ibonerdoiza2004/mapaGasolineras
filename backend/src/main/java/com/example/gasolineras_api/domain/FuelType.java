package com.example.gasolineras_api.domain;

/**
 * Combustibles soportados en el MVP. El nombre canónico se usa como clave
 * interna; la etiqueta es el texto que se muestra al usuario.
 */
public enum FuelType {

	DIESEL("Diésel"),
	GASOLINA_95("Gasolina 95"),
	GASOLINA_98("Gasolina 98");

	private final String label;

	FuelType(String label) {
		this.label = label;
	}

	public String getLabel() {
		return label;
	}
}
