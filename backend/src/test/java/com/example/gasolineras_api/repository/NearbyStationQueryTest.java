package com.example.gasolineras_api.repository;

import com.example.gasolineras_api.domain.CurrentPrice;
import com.example.gasolineras_api.domain.FuelType;
import com.example.gasolineras_api.domain.Station;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.geom.Point;
import org.locationtech.jts.geom.PrecisionModel;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.math.BigDecimal;
import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
class NearbyStationQueryTest {

	@Autowired
	private StationRepository stationRepository;

	@Autowired
	private CurrentPriceRepository currentPriceRepository;

	@Autowired
	private PriceSnapshotRepository priceSnapshotRepository;

	@BeforeEach
	void setUp() {
		// Limpia datos de tests previos respetando las claves foráneas
		priceSnapshotRepository.deleteAll();
		currentPriceRepository.deleteAll();
		stationRepository.deleteAll();

		// Centro en Madrid (40.4168, -3.7038)
		saveStation("CERCANA", "REPSOL", -3.7038, 40.4168, "1.599");
		// ~5 km al oeste
		saveStation("A5KM", "CEPSA", -3.7723, 40.4168, "1.650");
		// ~50 km al sur (fuera del radio de 10 km)
		saveStation("LEJOS", "BP", -3.7038, 39.9670, "1.700");
	}

	@Test
	@DisplayName("La consulta espacial devuelve estaciones dentro del radio con distancia")
	void returnsStationsWithinRadiusWithDistance() {
		var result = stationRepository.findNearby(40.4168, -3.7038, 10_000.0, "GASOLINA_95");

		assertThat(result).hasSize(2);
		assertThat(result).extracting("officialId")
				.containsExactlyInAnyOrder("CERCANA", "A5KM");

		var cercana = result.stream()
				.filter(p -> p.getOfficialId().equals("CERCANA"))
				.findFirst()
				.orElseThrow();
		assertThat(cercana.getDistanciaKm()).isLessThan(1.0);
		assertThat(cercana.getPrecio()).isEqualByComparingTo(new BigDecimal("1.599"));
	}

	@Test
	@DisplayName("Estaciones sin precio del combustible solicitado quedan con precio nulo")
	void stationWithoutFuelPriceHasNullPrice() {
		// LEJOS está fuera del radio; CERCANA y A5KM tienen precio.
		// Añadimos una estación sin precio dentro del radio.
		saveStationWithoutPrice("SINPRECIO", "SHELL", -3.7038, 40.4178);

		var result = stationRepository.findNearby(40.4168, -3.7038, 10_000.0, "GASOLINA_95");

		var sinPrecio = result.stream()
				.filter(p -> p.getOfficialId().equals("SINPRECIO"))
				.findFirst()
				.orElseThrow();
		assertThat(sinPrecio.getPrecio()).isNull();
	}

	@Test
	@DisplayName("Un radio más pequeño excluye estaciones lejanas")
	void smallerRadiusExcludesFarStations() {
		var result = stationRepository.findNearby(40.4168, -3.7038, 1_000.0, "GASOLINA_95");

		assertThat(result).hasSize(1);
		assertThat(result.getFirst().getOfficialId()).isEqualTo("CERCANA");
	}

	private void saveStation(String id, String rotulo, double lon, double lat, String price) {
		Station station = new Station(
				id, rotulo, "DIR", "28001", "Madrid", "Madrid", "Madrid",
				point(lon, lat), "L-D: 06:00-22:00", "P", "D",
				"17/08/2026", Instant.now());
		stationRepository.saveAndFlush(station);

		CurrentPrice cp = new CurrentPrice(
				station, FuelType.GASOLINA_95, new BigDecimal(price), Instant.now());
		currentPriceRepository.saveAndFlush(cp);
	}

	private void saveStationWithoutPrice(String id, String rotulo, double lon, double lat) {
		Station station = new Station(
				id, rotulo, "DIR", "28001", "Madrid", "Madrid", "Madrid",
				point(lon, lat), "L-D: 06:00-22:00", "P", "D",
				"17/08/2026", Instant.now());
		stationRepository.saveAndFlush(station);
	}

	private Point point(double lon, double lat) {
		GeometryFactory factory = new GeometryFactory(new PrecisionModel(), 4326);
		return factory.createPoint(new Coordinate(lon, lat));
	}
}
