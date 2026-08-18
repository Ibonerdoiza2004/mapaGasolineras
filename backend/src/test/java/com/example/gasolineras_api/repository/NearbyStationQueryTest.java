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

@SpringBootTest(properties = "app.municipios.import-enabled=false")
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
		var result = stationRepository.findNearby(40.4168, -3.7038, 10_000.0, "GASOLINA_95", "precio", 200, null, null);

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

		var result = stationRepository.findNearby(40.4168, -3.7038, 10_000.0, "GASOLINA_95", "precio", 200, null, null);

		var sinPrecio = result.stream()
				.filter(p -> p.getOfficialId().equals("SINPRECIO"))
				.findFirst()
				.orElseThrow();
		assertThat(sinPrecio.getPrecio()).isNull();
	}

	@Test
	@DisplayName("Un radio más pequeño excluye estaciones lejanas")
	void smallerRadiusExcludesFarStations() {
		var result = stationRepository.findNearby(40.4168, -3.7038, 1_000.0, "GASOLINA_95", "precio", 200, null, null);

		assertThat(result).hasSize(1);
		assertThat(result.getFirst().getOfficialId()).isEqualTo("CERCANA");
	}

	@Test
	@DisplayName("Sin radio se devuelven todas las estaciones con su distancia")
	void noRadiusReturnsAllStations() {
		var result = stationRepository.findNearbyAll(40.4168, -3.7038, "GASOLINA_95", "precio", 200, null, null);

		assertThat(result).hasSize(3);
		assertThat(result).extracting("officialId")
				.containsExactlyInAnyOrder("CERCANA", "A5KM", "LEJOS");

		var lejos = result.stream()
				.filter(p -> p.getOfficialId().equals("LEJOS"))
				.findFirst()
				.orElseThrow();
		assertThat(lejos.getDistanciaKm()).isGreaterThan(40.0);
		assertThat(lejos.getPrecio()).isEqualByComparingTo(new BigDecimal("1.700"));
	}

	@Test
	@DisplayName("El viewport del mapa limita las estaciones al rectángulo geográfico")
	void boundsLimitStationsToViewport() {
		// Rectángulo que excluye a A5KM (~5 km al oeste) pero incluye a LEJOS.
		var result = stationRepository.findInBounds(39.0, 41.0, -3.75, -3.6, 40.0, -3.675, "GASOLINA_95", "precio", 200, 0, null, null);

		assertThat(result).extracting("officialId")
				.containsExactlyInAnyOrder("CERCANA", "LEJOS");
	}

	@Test
	@DisplayName("Un viewport pequeño devuelve solo lo visible en él")
	void smallViewportReturnsOnlyVisibleStations() {
		var result = stationRepository.findInBounds(40.40, 40.42, -3.72, -3.70, 40.41, -3.71, "GASOLINA_95", "precio", 200, 0, null, null);

		assertThat(result).extracting("officialId").containsExactly("CERCANA");
	}

	@Test
	@DisplayName("El offset del viewport pagina de forma determinista sin repetir estaciones")
	void viewportOffsetReturnsNextPage() {
		// Con límite 1 y offset 0 devuelve la primera del orden; con offset 1
		// devuelve la segunda, sin repetir la primera (orden estable por id).
		var first = stationRepository.findInBounds(39.0, 41.0, -3.75, -3.6, 40.0, -3.675, "GASOLINA_95", "precio", 1, 0, null, null);
		var second = stationRepository.findInBounds(39.0, 41.0, -3.75, -3.6, 40.0, -3.675, "GASOLINA_95", "precio", 1, 1, null, null);

		assertThat(first).hasSize(1);
		assertThat(second).hasSize(1);
		assertThat(first.getFirst().getOfficialId()).isNotEqualTo(second.getFirst().getOfficialId());
	}

	@Test
	@DisplayName("El rango de precio filtra las estaciones antes del límite")
	void priceRangeFiltersStations() {
		// Rectángulo amplio que incluye las tres; solo las de precio en [1.60, 1.70].
		var result = stationRepository.findInBounds(39.5, 41.0, -4.0, -3.5, 40.0, -3.5, "GASOLINA_95", "precio", 200, 0, 1.60, 1.70);

		assertThat(result).extracting("officialId").containsExactlyInAnyOrder("A5KM", "LEJOS");
	}

	@Test
	@DisplayName("El límite recorta la lista a los mejores del orden pedido")
	void limitReturnsOnlyTopStations() {
		var result = stationRepository.findNearby(40.4168, -3.7038, 10_000.0, "GASOLINA_95", "precio", 1, null, null);

		assertThat(result).hasSize(1);
		assertThat(result.getFirst().getOfficialId()).isEqualTo("CERCANA");
		assertThat(result.getFirst().getPrecio()).isEqualByComparingTo(new BigDecimal("1.599"));
	}

	@Test
	@DisplayName("Sin límite un radio devuelve todas las estaciones del rango")
	void radiusWithoutLimitReturnsAllInRange() {
		var result = stationRepository.findNearby(
				40.4168, -3.7038, 10_000.0, "GASOLINA_95", "precio", Integer.MAX_VALUE, null, null);

		assertThat(result).hasSize(2);
		assertThat(result).extracting("officialId")
				.containsExactlyInAnyOrder("CERCANA", "A5KM");
		// Sigue ordenado por el criterio pedido (primero el más barato).
		assertThat(result.getFirst().getOfficialId()).isEqualTo("CERCANA");
	}

	@Test
	@DisplayName("Ordenar por precio devuelve primero el más barato")
	void priceOrderReturnsCheapestFirst() {
		// CERCANA (1.599) es más barata que A5KM (1.650).
		var result = stationRepository.findNearby(40.4168, -3.7038, 10_000.0, "GASOLINA_95", "precio", 200, null, null);

		assertThat(result.getFirst().getOfficialId()).isEqualTo("CERCANA");
		assertThat(result.getLast().getOfficialId()).isEqualTo("A5KM");
	}

	@Test
	@DisplayName("Ordenar por distancia devuelve primero la más cercana")
	void distanceOrderReturnsNearestFirst() {
		var result = stationRepository.findNearby(40.4168, -3.7038, 10_000.0, "GASOLINA_95", "distancia", 200, null, null);

		assertThat(result.getFirst().getOfficialId()).isEqualTo("CERCANA");
		assertThat(result.getLast().getOfficialId()).isEqualTo("A5KM");
	}

	@Test
	@DisplayName("El precio mínimo del radio es el del combustible consultado")
	void minPriceNearbyReturnsCheapestInRadius() {
		var min = stationRepository.findMinPriceNearby(40.4168, -3.7038, 10_000.0, "GASOLINA_95");

		assertThat(min).isEqualByComparingTo(new BigDecimal("1.599"));
	}

	@Test
	@DisplayName("El precio mínimo del viewport solo mira dentro del rectángulo")
	void minPriceInBoundsIsBoundedToRectangle() {
		// Rectángulo que excluye a CERCANA (la más barata): solo queda A5KM.
		var min = stationRepository.findMinPriceInBounds(39.0, 41.0, -3.78, -3.75, "GASOLINA_95");

		assertThat(min).isEqualByComparingTo(new BigDecimal("1.650"));
	}

	@Test
	@DisplayName("El precio mínimo global considera todas las estaciones")
	void minPriceAllIsGlobal() {
		var min = stationRepository.findMinPriceAll("GASOLINA_95");

		assertThat(min).isEqualByComparingTo(new BigDecimal("1.599"));
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
