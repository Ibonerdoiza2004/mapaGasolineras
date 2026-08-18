package com.example.gasolineras_api.service;

import com.example.gasolineras_api.client.GeocodeClient;
import com.example.gasolineras_api.client.GeocodeClientException;
import com.example.gasolineras_api.client.dto.GeocodePlace;
import com.example.gasolineras_api.config.CacheConfig;
import com.example.gasolineras_api.domain.Municipality;
import com.example.gasolineras_api.dto.GeocodeSuggestionDto;
import com.example.gasolineras_api.repository.MunicipalityRepository;
import com.example.gasolineras_api.repository.PostalCodeRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.CacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Verifica el comportamiento de la caché del geocodificador: una consulta
 * repetida se sirve desde caché sin consultar de nuevo al proveedor.
 */
@SpringJUnitConfig(GeocodeServiceCacheTest.Context.class)
class GeocodeServiceCacheTest {

	@Configuration
	@Import(CacheConfig.class)
	static class Context {

		@Bean
		GeocodeClient geocodeClient() {
			return mock(GeocodeClient.class);
		}

		@Bean
		MunicipalityRepository municipalityRepository() {
			return mock(MunicipalityRepository.class);
		}

		@Bean
		PostalCodeRepository postalCodeRepository() {
			return mock(PostalCodeRepository.class);
		}

		@Bean
		GeocodeService geocodeService(GeocodeClient geocodeClient,
				MunicipalityRepository municipalityRepository,
				PostalCodeRepository postalCodeRepository,
				CacheManager cacheManager) {
			return new GeocodeService(geocodeClient, municipalityRepository, postalCodeRepository,
					cacheManager, 30);
		}
	}

	@Autowired
	private GeocodeClient geocodeClient;

	@Autowired
	private MunicipalityRepository municipalityRepository;

	@Autowired
	private GeocodeService geocodeService;

	@Autowired
	private CacheManager cacheManager;

	@BeforeEach
	void resetMocksAndCache() {
		org.mockito.Mockito.reset(geocodeClient, municipalityRepository);
		cacheManager.getCache("geocode").clear();
	}

	@Test
	@DisplayName("Una consulta repetida se sirve desde caché sin consultar de nuevo al proveedor")
	void repeatedQueryUsesCache() {
		when(geocodeClient.search("madrid")).thenReturn(List.of(
				new GeocodePlace("1", "Madrid, Comunidad de Madrid, España", "city", 40.4168, -3.7038)));

		geocodeService.search("madrid");
		geocodeService.search("madrid");

		verify(geocodeClient).search("madrid");
		assertThat(geocodeService.search("madrid")).hasSize(1);
	}

	@Test
	@DisplayName("Una consulta distinta no usa la caché de la anterior")
	void differentQueryBypassesPreviousCacheEntry() {
		when(geocodeClient.search("madrid")).thenReturn(List.of(
				new GeocodePlace("1", "Madrid, Comunidad de Madrid, España", "city", 40.4168, -3.7038)));
		when(geocodeClient.search("bilbao")).thenReturn(List.of(
				new GeocodePlace("2", "Bilbao, País Vasco, España", "city", 43.2630, -2.9350)));

		assertThat(geocodeService.search("madrid").get(0).id()).isEqualTo("1");
		assertThat(geocodeService.search("bilbao").get(0).id()).isEqualTo("2");

		verify(geocodeClient).search("madrid");
		verify(geocodeClient).search("bilbao");
	}

	@Test
	@DisplayName("Una consulta sin resultados se cachea igualmente")
	void emptyResultIsCached() {
		when(geocodeClient.search("zzz")).thenReturn(List.of());

		assertThat(geocodeService.search("zzz")).isEmpty();
		assertThat(geocodeService.search("zzz")).isEmpty();

		verify(geocodeClient).search("zzz");
	}

	@Test
	@DisplayName("Un resultado degradado no se cachea: al recuperarse el proveedor se consulta de nuevo")
	void degradedResultIsNotCached() {
		Municipality local = new Municipality("28079", "Madrid", "Madrid", 3_332_035, 40.4168, -3.7038);
		when(municipalityRepository.findSimilar("madrid", 0.25, 4)).thenReturn(List.of(local));
		when(geocodeClient.search("madrid"))
				.thenThrow(new GeocodeClientException("proveedor caído", true))
				.thenReturn(List.of(new GeocodePlace("9001", "Rivas-Vaciamadrid, Madrid, España", "town",
						40.3397, -3.5183)));

		assertThat(geocodeService.search("madrid")).extracting(GeocodeSuggestionDto::id)
				.containsExactly("28079");
		assertThat(geocodeService.search("madrid")).extracting(GeocodeSuggestionDto::id)
				.containsExactly("28079", "9001");

		verify(geocodeClient, org.mockito.Mockito.times(2)).search("madrid");
	}
}