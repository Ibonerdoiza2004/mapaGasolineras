package com.example.gasolineras_api.domain;

import java.math.BigDecimal;
import java.util.Map;

/**
 * Estación de servicio con datos normalizados del Geoportal/MITECO.
 * Los precios y coordenadas ya están convertidos a tipos numéricos.
 */
public record NormalizedStation(
		String id,
		String rotulo,
		String marca,
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
		Map<FuelType, BigDecimal> precios
) {}
