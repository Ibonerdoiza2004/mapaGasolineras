package com.example.gasolineras_api.client.dto;

/**
 * Lugar geocodificado normalizado, independiente del proveedor externo.
 */
public record GeocodePlace(
		String id,
		String displayName,
		String tipo,
		double lat,
		double lon
) {}