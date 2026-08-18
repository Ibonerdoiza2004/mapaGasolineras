package com.example.gasolineras_api.dto;

/**
 * Sugerencia de geocodificación para el buscador de ubicaciones.
 */
public record GeocodeSuggestionDto(
		String id,
		String label,
		String fullName,
		String tipo,
		double latitud,
		double longitud
) {}