package com.example.gasolineras_api.dto;

import com.example.gasolineras_api.domain.FuelType;

import java.math.BigDecimal;
import java.util.Map;

/**
 * Ficha completa de una estación con sus precios disponibles.
 */
public record StationDetailDto(
		String id,
		String rotulo,
		String direccion,
		String codigoPostal,
		String localidad,
		String municipio,
		String provincia,
		double latitud,
		double longitud,
		String horario,
		String tipoVenta,
		String margen,
		Map<FuelType, BigDecimal> precios,
		String fechaActualizacion
) {}
