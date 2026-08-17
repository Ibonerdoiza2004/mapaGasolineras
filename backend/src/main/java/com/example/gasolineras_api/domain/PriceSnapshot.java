package com.example.gasolineras_api.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Snapshot histórico de un precio. Se inserta en cada importación
 * para conservar trazabilidad de la evolución de tarifas.
 */
@Entity
@Table(name = "price_snapshots", indexes = {
		@Index(name = "idx_price_snapshots_station_date", columnList = "station_id, recorded_at")
})
public class PriceSnapshot {

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

	@Column(name = "data_date", nullable = false, length = 30)
	private String dataDate;

	@Column(name = "recorded_at", nullable = false)
	private Instant recordedAt;

	protected PriceSnapshot() {
	}

	public PriceSnapshot(Station station, FuelType fuelType, BigDecimal price,
			String dataDate, Instant recordedAt) {
		this.station = station;
		this.fuelType = fuelType;
		this.price = price;
		this.dataDate = dataDate;
		this.recordedAt = recordedAt;
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

	public String getDataDate() {
		return dataDate;
	}

	public Instant getRecordedAt() {
		return recordedAt;
	}
}
