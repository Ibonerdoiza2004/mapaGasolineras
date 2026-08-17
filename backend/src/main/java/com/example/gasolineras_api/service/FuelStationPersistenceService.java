package com.example.gasolineras_api.service;

import com.example.gasolineras_api.domain.CurrentPrice;
import com.example.gasolineras_api.domain.FuelType;
import com.example.gasolineras_api.domain.NormalizedStation;
import com.example.gasolineras_api.domain.PriceSnapshot;
import com.example.gasolineras_api.domain.Station;
import com.example.gasolineras_api.mapper.NormalizationResult;
import com.example.gasolineras_api.repository.CurrentPriceRepository;
import com.example.gasolineras_api.repository.PriceSnapshotRepository;
import com.example.gasolineras_api.repository.StationRepository;
import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.geom.Point;
import org.locationtech.jts.geom.PrecisionModel;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Map;

/**
 * Persiste datos normalizados en la base de datos.
 * Reglas de idempotencia:
 * - Estaciones: upsert por official_id.
 * - Precios actuales: upsert por (station, fuel_type).
 * - Snapshots históricos: solo inserta si no existe uno igual para la misma
 *   estación, combustible y fecha de datos.
 */
@Service
public class FuelStationPersistenceService {

	private static final Logger log = LoggerFactory.getLogger(FuelStationPersistenceService.class);
	private static final GeometryFactory GEOMETRY_FACTORY = new GeometryFactory(new PrecisionModel(), 4326);

	private final StationRepository stationRepository;
	private final CurrentPriceRepository currentPriceRepository;
	private final PriceSnapshotRepository priceSnapshotRepository;

	public FuelStationPersistenceService(StationRepository stationRepository,
			CurrentPriceRepository currentPriceRepository,
			PriceSnapshotRepository priceSnapshotRepository) {
		this.stationRepository = stationRepository;
		this.currentPriceRepository = currentPriceRepository;
		this.priceSnapshotRepository = priceSnapshotRepository;
	}

	/**
	 * Persiste el resultado normalizado de una importación.
	 *
	 * @param normalized resultado de la normalización
	 * @param importTime timestamp de la importación
	 */
	@Transactional
	public void persist(NormalizationResult normalized, Instant importTime) {
		for (NormalizedStation ns : normalized.validStations()) {
			Station station = upsertStation(ns, normalized.fechaActualizacion(), importTime);

			for (Map.Entry<FuelType, BigDecimal> entry : ns.precios().entrySet()) {
				upsertCurrentPrice(station, entry.getKey(), entry.getValue(), importTime);
				insertSnapshotIfAbsent(station, entry.getKey(), entry.getValue(),
						normalized.fechaActualizacion(), importTime);
			}
		}
	}

	private Station upsertStation(NormalizedStation ns, String dataDate, Instant importTime) {
		Station station = stationRepository.findByOfficialId(ns.id())
				.map(existing -> {
					updateStationFields(existing, ns, dataDate, importTime);
					return existing;
				})
				.orElseGet(() -> createStation(ns, dataDate, importTime));
		return stationRepository.save(station);
	}

	private Station createStation(NormalizedStation ns, String dataDate, Instant importTime) {
		Point location = GEOMETRY_FACTORY.createPoint(new Coordinate(ns.longitud(), ns.latitud()));
		return new Station(
				ns.id(), ns.rotulo(), ns.direccion(), ns.codigoPostal(),
				ns.localidad(), ns.municipio(), ns.provincia(), location,
				ns.horario(), ns.tipoVenta(), ns.margen(), dataDate, importTime);
	}

	private void updateStationFields(Station existing, NormalizedStation ns,
			String dataDate, Instant importTime) {
		// Los campos se actualizan solo si el nuevo dato no es nulo
		if (ns.rotulo() != null) existing.setRotulo(ns.rotulo());
		if (ns.direccion() != null) existing.setDireccion(ns.direccion());
		if (ns.localidad() != null) existing.setLocalidad(ns.localidad());
		if (ns.municipio() != null) existing.setMunicipio(ns.municipio());
		if (ns.provincia() != null) existing.setProvincia(ns.provincia());
		Point location = GEOMETRY_FACTORY.createPoint(new Coordinate(ns.longitud(), ns.latitud()));
		existing.setLocation(location);
		existing.setHorario(ns.horario());
		existing.setTipoVenta(ns.tipoVenta());
		existing.setMargen(ns.margen());
		existing.setDataDate(dataDate);
		existing.setUpdatedAt(importTime);
	}

	private void upsertCurrentPrice(Station station, FuelType fuelType,
			BigDecimal price, Instant importTime) {
		CurrentPrice cp = currentPriceRepository
				.findByStationAndFuelType(station, fuelType)
				.map(existing -> {
					existing.setPrice(price);
					existing.setUpdatedAt(importTime);
					return existing;
				})
				.orElseGet(() -> new CurrentPrice(station, fuelType, price, importTime));
		currentPriceRepository.save(cp);
	}

	private void insertSnapshotIfAbsent(Station station, FuelType fuelType,
			BigDecimal price, String dataDate, Instant importTime) {
		if (!priceSnapshotRepository.existsByStationAndFuelTypeAndDataDate(station, fuelType, dataDate)) {
			priceSnapshotRepository.save(new PriceSnapshot(station, fuelType, price, dataDate, importTime));
		}
	}
}
