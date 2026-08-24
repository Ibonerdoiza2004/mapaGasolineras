package com.example.gasolineras_api.repository;

import java.math.BigDecimal;

/** Proyección mínima para dibujar todas las estaciones en el mapa. */
public interface MapStationProjection {

	String getOfficialId();

	String getRotulo();

	Double getLatitud();

	Double getLongitud();

	BigDecimal getPrecio();

	Boolean getBestOption();

	String getDataDate();
}
