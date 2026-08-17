package com.example.gasolineras_api.repository;

import java.math.BigDecimal;

/**
 * Proyección de estaciones cercanas devuelta por la consulta espacial.
 */
public interface NearbyStationProjection {

	String getOfficialId();

	String getRotulo();

	String getDireccion();

	String getLocalidad();

	String getProvincia();

	Double getLatitud();

	Double getLongitud();

	Double getDistanciaKm();

	BigDecimal getPrecio();

	String getDataDate();
}
