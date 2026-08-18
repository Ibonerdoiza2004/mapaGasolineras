package com.example.gasolineras_api.service;

import com.example.gasolineras_api.client.GeocodeClient;
import com.example.gasolineras_api.client.GeocodeClientException;
import com.example.gasolineras_api.client.dto.GeocodePlace;
import com.example.gasolineras_api.domain.Municipality;
import com.example.gasolineras_api.domain.PostalCode;
import com.example.gasolineras_api.dto.GeocodeSuggestionDto;
import com.example.gasolineras_api.exception.GeocodeRateLimitException;
import com.example.gasolineras_api.repository.MunicipalityRepository;
import com.example.gasolineras_api.repository.PostalCodeRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.cache.CacheManager;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class GeocodeServiceTest {

	private GeocodeClient geocodeClient;
	private MunicipalityRepository municipalityRepository;
	private PostalCodeRepository postalCodeRepository;
	private MutableClock clock;

	@BeforeEach
	void setUp() {
		geocodeClient = mock(GeocodeClient.class);
		municipalityRepository = mock(MunicipalityRepository.class);
		postalCodeRepository = mock(PostalCodeRepository.class);
		clock = new MutableClock(Instant.parse("2026-08-17T10:00:00Z"));
	}

	@Test
	@DisplayName("Una consulta válida devuelve sugerencias con etiqueta corta")
	void validQueryReturnsSuggestions() {
		when(geocodeClient.search("madrid")).thenReturn(List.of(
				new GeocodePlace("1", "Madrid, Comunidad de Madrid, España", "city", 40.4168, -3.7038)));

		GeocodeService service = service(30);
		List<GeocodeSuggestionDto> result = service.search("madrid");

		assertThat(result).hasSize(1);
		GeocodeSuggestionDto suggestion = result.get(0);
		assertThat(suggestion.id()).isEqualTo("1");
		assertThat(suggestion.label()).isEqualTo("Madrid");
		assertThat(suggestion.fullName()).isEqualTo("Madrid, Comunidad de Madrid, España");
		assertThat(suggestion.tipo()).isEqualTo("city");
		assertThat(suggestion.latitud()).isEqualTo(40.4168);
		assertThat(suggestion.longitud()).isEqualTo(-3.7038);
	}

	@Test
	@DisplayName("La consulta se normaliza antes de llegar al proveedor")
	void queryIsNormalizedBeforeProvider() {
		when(geocodeClient.search("san sebastián")).thenReturn(List.of());

		GeocodeService service = service(30);
		service.search("  san   sebastián  ");

		verify(geocodeClient).search("san sebastián");
	}

	@Test
	@DisplayName("Los saltos de línea de la consulta no llegan al proveedor ni al log")
	void queryWithNewlinesIsNormalized() {
		when(geocodeClient.search("madrid")).thenReturn(List.of());

		GeocodeService service = service(30);
		service.search("madrid\n2026-08-17 10:00:00 ERROR\n");

		verify(geocodeClient).search("madrid 2026-08-17 10:00:00 ERROR");
	}

	@Test
	@DisplayName("Dos lugares con las mismas coordenadas se deduplican")
	void duplicateCoordinatesAreDeduplicated() {
		when(geocodeClient.search("madrid")).thenReturn(List.of(
				new GeocodePlace("1", "Madrid, Comunidad de Madrid, España", "city", 40.4168, -3.7038),
				new GeocodePlace("2", "Madrid, España", "city", 40.4168001, -3.7037999)));

		GeocodeService service = service(30);
		List<GeocodeSuggestionDto> result = service.search("madrid");

		assertThat(result).hasSize(1);
		assertThat(result.get(0).id()).isEqualTo("1");
	}

	@Test
	@DisplayName("Un fallo del proveedor se propaga para que la API lo comunique")
	void providerFailurePropagates() {
		when(geocodeClient.search("madrid")).thenThrow(
				new GeocodeClientException("No se pudo conectar con el proveedor", true));

		GeocodeService service = service(30);

		assertThatThrownBy(() -> service.search("madrid"))
				.isInstanceOf(GeocodeClientException.class);
	}

	@Test
	@DisplayName("Se supera el límite de consultas de la ventana")
	void rateLimitRejectsExtraRequests() {
		when(geocodeClient.search("madrid")).thenReturn(List.of());
		GeocodeService service = service(2);

		service.search("madrid");
		service.search("madrid");

		assertThatThrownBy(() -> service.search("madrid"))
				.isInstanceOf(GeocodeRateLimitException.class);
	}

	@Test
	@DisplayName("Pasada la ventana de un minuto el límite se reinicia")
	void rateLimitResetsAfterWindow() {
		when(geocodeClient.search("madrid")).thenReturn(List.of());
		GeocodeService service = service(2);

		service.search("madrid");
		service.search("madrid");
		assertThatThrownBy(() -> service.search("madrid"))
				.isInstanceOf(GeocodeRateLimitException.class);

		clock.advance(Duration.ofSeconds(61));

		service.search("madrid");
	}

	@Test
	@DisplayName("Las consultas anteriores dentro de la ventana cuentan para el límite")
	void previousRequestsWithinWindowCount() {
		when(geocodeClient.search("madrid")).thenReturn(List.of());
		GeocodeService service = service(2);

		service.search("madrid");
		service.search("bilbao");

		assertThatThrownBy(() -> service.search("sevilla"))
				.isInstanceOf(GeocodeRateLimitException.class);
	}

	@Test
	@DisplayName("Un código postal se resuelve con el índice local sin llamar al proveedor")
	void postalCodeResolvedLocallyWithoutProvider() {
		Municipality madrid = new Municipality("28079", "Madrid", "Madrid", 3_332_035, 40.4168, -3.7038);
		when(postalCodeRepository.findByIdCode("28013")).thenReturn(List.of(
				new PostalCode("28013", madrid)));

		GeocodeService service = service(2);
		List<GeocodeSuggestionDto> result = service.search("28013");

		assertThat(result).hasSize(1);
		GeocodeSuggestionDto suggestion = result.get(0);
		assertThat(suggestion.id()).isEqualTo("28079");
		assertThat(suggestion.label()).isEqualTo("Madrid");
		assertThat(suggestion.fullName()).isEqualTo("Madrid, Madrid, España");
		assertThat(suggestion.tipo()).isEqualTo("postal_code");
		verify(geocodeClient, never()).search(org.mockito.ArgumentMatchers.anyString());
		verify(geocodeClient, never()).searchByPostalCode(org.mockito.ArgumentMatchers.anyString());
	}

	@Test
	@DisplayName("Un código postal con varios municipios los ordena por población")
	void postalCodeWithSeveralMunicipalitiesOrderedByPopulation() {
		Municipality small = new Municipality("01001", "Pequeño", "Álava", 10_000, 42.8, -2.6);
		Municipality big = new Municipality("01002", "Grande", "Álava", 250_000, 42.9, -2.7);
		when(postalCodeRepository.findByIdCode("01000")).thenReturn(List.of(
				new PostalCode("01000", small),
				new PostalCode("01000", big)));

		List<GeocodeSuggestionDto> result = service(30).search("01000");

		assertThat(result).hasSize(2);
		assertThat(result.get(0).id()).isEqualTo("01002");
	}

	@Test
	@DisplayName("Un código postal sin índice local cae al proveedor y consume el límite")
	void unknownPostalCodeFallsBackToProvider() {
		when(postalCodeRepository.findByIdCode("99999")).thenReturn(List.of());
		when(geocodeClient.searchByPostalCode("99999")).thenReturn(List.of(
				new GeocodePlace("3", "Hontoria del Pinar, Burgos, España", "town", 41.7333, -3.1667)));

		GeocodeService service = service(2);
		List<GeocodeSuggestionDto> result = service.search("99999");

		assertThat(result).hasSize(1);
		assertThat(result.get(0).id()).isEqualTo("3");
		verify(geocodeClient).searchByPostalCode("99999");
	}

	@Test
	@DisplayName("Una resolución local por código postal no consume el límite del proveedor")
	void localPostalCodeDoesNotConsumeRateLimit() {
		Municipality madrid = new Municipality("28079", "Madrid", "Madrid", 3_332_035, 40.4168, -3.7038);
		when(postalCodeRepository.findByIdCode("28013")).thenReturn(List.of(
				new PostalCode("28013", madrid)));

		GeocodeService service = service(1);
		service.search("28013");
		service.search("28013");

		verify(geocodeClient, never()).search(org.mockito.ArgumentMatchers.anyString());
		verify(geocodeClient, never()).searchByPostalCode(org.mockito.ArgumentMatchers.anyString());
	}

	@Test
	@DisplayName("Los municipios locales y los lugares del proveedor se combinan deduplicando")
	void localAndProviderResultsAreMerged() {
		Municipality local = new Municipality("28079", "Madrid", "Madrid", 3_332_035, 40.4168, -3.7038);
		Municipality coslada = new Municipality("28049", "Coslada", "Madrid", 80_171, 40.4338, -3.5651);
		when(municipalityRepository.findSimilar("madrid", 0.25, 4)).thenReturn(List.of(local, coslada));
		when(geocodeClient.search("madrid")).thenReturn(List.of(
				new GeocodePlace("9001", "Madrid, Comunidad de Madrid, España", "city", 40.4168, -3.7038),
				new GeocodePlace("9002", "Rivas-Vaciamadrid, Madrid, España", "town", 40.3397, -3.5183)));

		List<GeocodeSuggestionDto> result = service(30).search("madrid");

		assertThat(result).hasSize(3);
		assertThat(result.get(0).id()).isEqualTo("28079");
		assertThat(result).extracting(GeocodeSuggestionDto::id)
				.containsExactlyInAnyOrder("28079", "28049", "9002");
	}

	@Test
	@DisplayName("Un municipio no coincide con la consulta y no se devuelve")
	void dissimilarMunicipalityIsNotReturned() {
		when(municipalityRepository.findSimilar("xyz", 0.25, 4)).thenReturn(List.of());

		List<GeocodeSuggestionDto> result = service(30).search("xyz");

		assertThat(result).isEmpty();
	}

	@Test
	@DisplayName("Con resultados locales, un fallo del proveedor se degrada a ellos en vez de fallar")
	void providerFailureDegradesToLocalResults() {
		Municipality local = new Municipality("28079", "Madrid", "Madrid", 3_332_035, 40.4168, -3.7038);
		when(municipalityRepository.findSimilar("madrid", 0.25, 4)).thenReturn(List.of(local));
		when(geocodeClient.search("madrid")).thenThrow(
				new GeocodeClientException("No se pudo conectar con el proveedor", true));

		List<GeocodeSuggestionDto> result = service(30).search("madrid");

		assertThat(result).hasSize(1);
		assertThat(result.get(0).id()).isEqualTo("28079");
	}

	@Test
	@DisplayName("Con resultados locales, superar el límite se degrada a ellos en vez de fallar")
	void rateLimitDegradesToLocalResults() {
		Municipality local = new Municipality("28079", "Madrid", "Madrid", 3_332_035, 40.4168, -3.7038);
		when(municipalityRepository.findSimilar("madrid", 0.25, 4)).thenReturn(List.of(local));
		when(geocodeClient.search("madrid")).thenReturn(List.of());
		GeocodeService service = service(1);

		service.search("madrid");
		List<GeocodeSuggestionDto> result = service.search("madrid");

		assertThat(result).hasSize(1);
		assertThat(result.get(0).id()).isEqualTo("28079");
	}

	@Test
	@DisplayName("Sin resultados locales, el fallo del proveedor sigue propagándose")
	void providerFailureStillPropagatesWithoutLocalResults() {
		when(municipalityRepository.findSimilar("qqqqqqqq", 0.25, 4)).thenReturn(List.of());
		when(geocodeClient.search("qqqqqqqq")).thenThrow(
				new GeocodeClientException("No se pudo conectar con el proveedor", true));

		GeocodeService service = service(30);

		assertThatThrownBy(() -> service.search("qqqqqqqq"))
				.isInstanceOf(GeocodeClientException.class);
	}

	@Test
	@DisplayName("Sin resultados locales, superar el límite sigue propagándose")
	void rateLimitStillPropagatesWithoutLocalResults() {
		when(municipalityRepository.findSimilar("qqqqqqqq", 0.25, 4)).thenReturn(List.of());
		GeocodeService service = service(1);
		service.search("qqqqqqqq");

		assertThatThrownBy(() -> service.search("qqqqqqqq"))
				.isInstanceOf(GeocodeRateLimitException.class);
	}

	private GeocodeService service(int maxRequestsPerMinute) {
		return new GeocodeService(geocodeClient, municipalityRepository, postalCodeRepository,
				mock(CacheManager.class), maxRequestsPerMinute, clock);
	}

	/**
	 * Reloj con tiempo manipulable para probar la ventana del límite.
	 */
	private static class MutableClock extends Clock {

		private Instant current;

		MutableClock(Instant initial) {
			this.current = initial;
		}

		void advance(Duration duration) {
			current = current.plus(duration);
		}

		@Override
		public Instant instant() {
			return current;
		}

		@Override
		public ZoneId getZone() {
			return ZoneOffset.UTC;
		}

		@Override
		public Clock withZone(ZoneId zone) {
			return this;
		}
	}
}