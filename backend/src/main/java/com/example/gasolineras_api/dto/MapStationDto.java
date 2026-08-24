package com.example.gasolineras_api.dto;

import java.math.BigDecimal;

/**
 * Representación ligera de una estación para la capa GeoJSON del mapa.
 */
public record MapStationDto(
		String id,
		String rotulo,
		double latitud,
		double longitud,
		BigDecimal precio,
		boolean mejorOpcion,
		String fechaActualizacion
) {}
