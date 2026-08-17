package com.example.gasolineras_api.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import org.locationtech.jts.geom.Point;

import java.time.Instant;

/**
 * Estación de servicio persistida con ubicación geoespacial (PostGIS).
 */
@Entity
@Table(name = "stations")
public class Station {

	private static final double LAT_MIN = -90.0;
	private static final double LAT_MAX = 90.0;
	private static final double LON_MIN = -180.0;
	private static final double LON_MAX = 180.0;

	@Id
	@Column(name = "official_id", length = 20)
	private String officialId;

	@Column(length = 200)
	private String rotulo;

	@Column(length = 500)
	private String direccion;

	@Column(name = "codigo_postal", length = 10)
	private String codigoPostal;

	@Column(length = 200)
	private String localidad;

	@Column(length = 200)
	private String municipio;

	@Column(length = 200)
	private String provincia;

	@Column(columnDefinition = "geometry(Point, 4326)")
	private Point location;

	@Column(length = 500)
	private String horario;

	@Column(name = "tipo_venta", length = 10)
	private String tipoVenta;

	@Column(length = 10)
	private String margen;

	@Column(name = "data_date", length = 30)
	private String dataDate;

	@Column(name = "updated_at")
	private Instant updatedAt;

	protected Station() {
	}

	public Station(String officialId, String rotulo, String direccion, String codigoPostal,
			String localidad, String municipio, String provincia, Point location,
			String horario, String tipoVenta, String margen, String dataDate, Instant updatedAt) {
		this.officialId = officialId;
		this.rotulo = rotulo;
		this.direccion = direccion;
		this.codigoPostal = codigoPostal;
		this.localidad = localidad;
		this.municipio = municipio;
		this.provincia = provincia;
		this.location = location;
		this.horario = horario;
		this.tipoVenta = tipoVenta;
		this.margen = margen;
		this.dataDate = dataDate;
		this.updatedAt = updatedAt;
	}

	public String getOfficialId() {
		return officialId;
	}

	public String getRotulo() {
		return rotulo;
	}

	public String getDireccion() {
		return direccion;
	}

	public String getCodigoPostal() {
		return codigoPostal;
	}

	public String getLocalidad() {
		return localidad;
	}

	public String getMunicipio() {
		return municipio;
	}

	public String getProvincia() {
		return provincia;
	}

	public Point getLocation() {
		return location;
	}

	public String getHorario() {
		return horario;
	}

	public String getTipoVenta() {
		return tipoVenta;
	}

	public String getMargen() {
		return margen;
	}

	public String getDataDate() {
		return dataDate;
	}

	public Instant getUpdatedAt() {
		return updatedAt;
	}

	public void setRotulo(String rotulo) {
		this.rotulo = rotulo;
	}

	public void setDireccion(String direccion) {
		this.direccion = direccion;
	}

	public void setLocalidad(String localidad) {
		this.localidad = localidad;
	}

	public void setMunicipio(String municipio) {
		this.municipio = municipio;
	}

	public void setProvincia(String provincia) {
		this.provincia = provincia;
	}

	public void setLocation(Point location) {
		this.location = location;
	}

	public void setHorario(String horario) {
		this.horario = horario;
	}

	public void setTipoVenta(String tipoVenta) {
		this.tipoVenta = tipoVenta;
	}

	public void setMargen(String margen) {
		this.margen = margen;
	}

	public void setDataDate(String dataDate) {
		this.dataDate = dataDate;
	}

	public void setUpdatedAt(Instant updatedAt) {
		this.updatedAt = updatedAt;
	}

	@PrePersist
	@PreUpdate
	void validateCoordinates() {
		if (location == null) {
			return;
		}
		double lat = location.getY();
		double lon = location.getX();
		if (lat < LAT_MIN || lat > LAT_MAX) {
			throw new IllegalArgumentException("Latitud fuera de rango: " + lat);
		}
		if (lon < LON_MIN || lon > LON_MAX) {
			throw new IllegalArgumentException("Longitud fuera de rango: " + lon);
		}
	}
}
