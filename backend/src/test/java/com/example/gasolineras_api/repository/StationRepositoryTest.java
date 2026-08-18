package com.example.gasolineras_api.repository;

import com.example.gasolineras_api.domain.CurrentPrice;
import com.example.gasolineras_api.domain.FuelType;
import com.example.gasolineras_api.domain.PriceSnapshot;
import com.example.gasolineras_api.domain.Station;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.geom.Point;
import org.locationtech.jts.geom.PrecisionModel;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest(properties = "app.municipios.import-enabled=false")
@Transactional
class StationRepositoryTest {

	@Autowired
	private StationRepository stationRepository;

	@Autowired
	private CurrentPriceRepository currentPriceRepository;

	@Autowired
	private PriceSnapshotRepository priceSnapshotRepository;

	@Test
	@DisplayName("Una estación con ubicación PostGIS se persiste y recupera correctamente")
	void stationWithPostGisLocationIsPersisted() {
		Point location = createPoint(-3.7038, 40.4168);
		Station station = new Station(
				"4375", "REPSOL", "repsol", "AVENIDA CASTILLA LA MANCHA, 26",
				"02250", "ABENGIBRE", "Abengibre", "ALBACETE",
				location, "L-D: 07:00-22:00", "P", "D",
				"17/08/2026 15:43:34", Instant.now());

		stationRepository.save(station);
		stationRepository.flush();

		Station found = stationRepository.findByOfficialId("4375").orElseThrow();
		assertThat(found.getRotulo()).isEqualTo("REPSOL");
		assertThat(found.getLocation().getX()).isEqualTo(-3.7038);
		assertThat(found.getLocation().getY()).isEqualTo(40.4168);
		assertThat(found.getLocation().getSRID()).isEqualTo(4326);
	}

	@Test
	@DisplayName("Un precio actual se persiste y recupera correctamente")
	void currentPriceIsPersisted() {
		Point location = createPoint(-3.7038, 40.4168);
		Station station = new Station(
				"4376", "CEPSA", "cepsa", "CALLE MAYOR 1",
				"28001", "Madrid", "Madrid", "Madrid",
				location, "L-D: 06:00-22:00", "P", "D",
				"17/08/2026", Instant.now());
		stationRepository.save(station);

		CurrentPrice price = new CurrentPrice(
				station, FuelType.GASOLINA_95, new BigDecimal("1.599"), Instant.now());
		currentPriceRepository.save(price);
		currentPriceRepository.flush();

		CurrentPrice found = currentPriceRepository
				.findByStationAndFuelType(station, FuelType.GASOLINA_95)
				.orElseThrow();
		assertThat(found.getPrice()).isEqualByComparingTo(new BigDecimal("1.599"));
		assertThat(found.getFuelType()).isEqualTo(FuelType.GASOLINA_95);
	}

	@Test
	@DisplayName("Un snapshot histórico se persiste y recupera por estación")
	void priceSnapshotIsPersisted() {
		Point location = createPoint(-3.7038, 40.4168);
		Station station = new Station(
				"4377", "BP", "bp", "CALLE REAL 5",
				"28002", "Madrid", "Madrid", "Madrid",
				location, "L-D: 00:00-23:59", "P", "I",
				"17/08/2026", Instant.now());
		stationRepository.save(station);

		PriceSnapshot snapshot = new PriceSnapshot(
				station, FuelType.DIESEL, new BigDecimal("1.749"),
				"17/08/2026 15:43:34", Instant.now());
		priceSnapshotRepository.save(snapshot);
		priceSnapshotRepository.flush();

		var found = priceSnapshotRepository
				.findByStationOfficialIdOrderByRecordedAtDesc("4377");
		assertThat(found).hasSize(1);
		assertThat(found.getFirst().getPrice()).isEqualByComparingTo(new BigDecimal("1.749"));
		assertThat(found.getFirst().getFuelType()).isEqualTo(FuelType.DIESEL);
	}

	@Test
	@DisplayName("Una estación con latitud fuera de rango se rechaza")
	void stationWithOutOfRangeLatitudeIsRejected() {
		Point location = createPoint(-3.7038, 95.0);
		Station station = new Station(
				"4000", "REPSOL", "repsol", "DIR", "28001",
				"Madrid", "Madrid", "Madrid", location,
				"L-D: 06:00-22:00", "P", "D", "17/08/2026", Instant.now());

		assertThatThrownBy(() -> {
			stationRepository.save(station);
			stationRepository.flush();
		}).isInstanceOf(RuntimeException.class);
	}

	@Test
	@DisplayName("Una estación con longitud fuera de rango se rechaza")
	void stationWithOutOfRangeLongitudeIsRejected() {
		Point location = createPoint(200.0, 40.4168);
		Station station = new Station(
				"4001", "REPSOL", "repsol", "DIR", "28001",
				"Madrid", "Madrid", "Madrid", location,
				"L-D: 06:00-22:00", "P", "D", "17/08/2026", Instant.now());

		assertThatThrownBy(() -> {
			stationRepository.save(station);
			stationRepository.flush();
		}).isInstanceOf(RuntimeException.class);
	}

	@Test
	@DisplayName("Un precio con combustible nulo se rechaza")
	void currentPriceWithNullFuelTypeIsRejected() {
		Point location = createPoint(-3.7038, 40.4168);
		Station station = new Station(
				"4002", "CEPSA", "cepsa", "DIR", "28001",
				"Madrid", "Madrid", "Madrid", location,
				"L-D: 06:00-22:00", "P", "D", "17/08/2026", Instant.now());
		stationRepository.save(station);
		stationRepository.flush();

		CurrentPrice price = new CurrentPrice(
				station, null, new BigDecimal("1.599"), Instant.now());

		assertThatThrownBy(() -> {
			currentPriceRepository.save(price);
			currentPriceRepository.flush();
		}).isInstanceOf(DataIntegrityViolationException.class);
	}

	private Point createPoint(double lon, double lat) {
		GeometryFactory factory = new GeometryFactory(new PrecisionModel(), 4326);
		return factory.createPoint(new Coordinate(lon, lat));
	}
}
