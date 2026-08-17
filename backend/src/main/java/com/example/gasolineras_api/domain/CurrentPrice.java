package com.example.gasolineras_api.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Precio actual de un combustible en una estación.
 * Se actualiza (upsert) en cada importación.
 */
@Entity
@Table(name = "current_prices", uniqueConstraints = @UniqueConstraint(columnNames = {"station_id", "fuel_type"}))
public class CurrentPrice {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "station_id", nullable = false)
	private Station station;

	@Enumerated(EnumType.STRING)
	@Column(name = "fuel_type", nullable = false, length = 20)
	private FuelType fuelType;

	@Column(nullable = false, precision = 10, scale = 3)
	private BigDecimal price;

	@Column(name = "updated_at", nullable = false)
	private Instant updatedAt;

	protected CurrentPrice() {
	}

	public CurrentPrice(Station station, FuelType fuelType, BigDecimal price, Instant updatedAt) {
		this.station = station;
		this.fuelType = fuelType;
		this.price = price;
		this.updatedAt = updatedAt;
	}

	public Long getId() {
		return id;
	}

	public Station getStation() {
		return station;
	}

	public FuelType getFuelType() {
		return fuelType;
	}

	public BigDecimal getPrice() {
		return price;
	}

	public Instant getUpdatedAt() {
		return updatedAt;
	}

	public void setPrice(BigDecimal price) {
		this.price = price;
	}

	public void setUpdatedAt(Instant updatedAt) {
		this.updatedAt = updatedAt;
	}
}
