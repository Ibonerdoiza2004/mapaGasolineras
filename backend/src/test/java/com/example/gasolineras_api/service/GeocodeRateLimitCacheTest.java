package com.example.gasolineras_api.service;

import com.example.gasolineras_api.client.GeocodeClient;
import com.example.gasolineras_api.client.dto.GeocodePlace;
import com.example.gasolineras_api.config.CacheConfig;
import com.example.gasolineras_api.exception.GeocodeRateLimitException;
import com.example.gasolineras_api.repository.MunicipalityRepository;
import com.example.gasolineras_api.repository.PostalCodeRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.CacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Verifica la interacción entre la caché y el límite de uso: un acierto de
 * caché no consume el límite de consultas al proveedor.
 */
@SpringJUnitConfig(GeocodeRateLimitCacheTest.LimitedContext.class)
class GeocodeRateLimitCacheTest {

	@Configuration
	@Import(CacheConfig.class)
	static class LimitedContext {

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
					cacheManager, 1);
		}
	}

	@Autowired
	private GeocodeClient geocodeClient;

	@Autowired
	private GeocodeService geocodeService;

	@Test
	@DisplayName("Un acierto de caché no consume el límite de uso")
	void cacheHitDoesNotConsumeRateLimit() {
		when(geocodeClient.search("madrid")).thenReturn(List.of(
				new GeocodePlace("1", "Madrid, Comunidad de Madrid, España", "city", 40.4168, -3.7038)));

		geocodeService.search("madrid");
		geocodeService.search("madrid");

		assertThatThrownBy(() -> geocodeService.search("bilbao"))
				.isInstanceOf(GeocodeRateLimitException.class);
	}
}