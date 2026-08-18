package com.example.gasolineras_api.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

/**
 * Municipio español con centroide y población (datos INE). Alimenta el
 * autocompletado local del buscador, con tolerancia a erratas (pg_trgm)
 * y prioridad por población.
 */
@Entity
@Table(name = "municipalities")
public class Municipality {

	private static final double LAT_MIN = 27.0;
	private static final double LAT_MAX = 44.5;
	private static final double LON_MIN = -19.0;
	private static final double LON_MAX = 5.0;

	@Id
	@Column(length = 5)
	private String code;

	@Column(nullable = false, length = 200)
	private String nombre;

	@Column(nullable = false, length = 100)
	private String provincia;

	@Column(nullable = false)
	private long poblacion;

	@Column(nullable = false)
	private double latitud;

	@Column(nullable = false)
	private double longitud;

	protected Municipality() {
	}

	public Municipality(String code, String nombre, String provincia, long poblacion,
			double latitud, double longitud) {
		this.code = code;
		this.nombre = nombre;
		this.provincia = provincia;
		this.poblacion = poblacion;
		this.latitud = latitud;
		this.longitud = longitud;
	}

	public String getCode() {
		return code;
	}

	public String getNombre() {
		return nombre;
	}

	public String getProvincia() {
		return provincia;
	}

	public long getPoblacion() {
		return poblacion;
	}

	public double getLatitud() {
		return latitud;
	}

	public double getLongitud() {
		return longitud;
	}

	@PrePersist
	@PreUpdate
	void validateCoordinates() {
		if (latitud < LAT_MIN || latitud > LAT_MAX) {
			throw new IllegalArgumentException("Latitud fuera de rango: " + latitud);
		}
		if (longitud < LON_MIN || longitud > LON_MAX) {
			throw new IllegalArgumentException("Longitud fuera de rango: " + longitud);
		}
	}
}