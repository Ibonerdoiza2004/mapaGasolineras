package com.example.gasolineras_api.dto;

import java.math.BigDecimal;

/**
 * Estación cercana con precio aplicable, distancia y ahorro estimado.
 */
public record NearbyStationDto(
		String id,
		String rotulo,
		String direccion,
		String localidad,
		String provincia,
		double latitud,
		double longitud,
		double distanciaKm,
		BigDecimal precio,
		BigDecimal ahorro,
		String fechaActualizacion
) {}
