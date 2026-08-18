package com.example.gasolineras_api.config;

import com.github.benmanes.caffeine.cache.Caffeine;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.caffeine.CaffeineCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Duration;

/**
 * Caché en memoria del geocodificador: evita consultar al proveedor externo
 * por cada pulsación y mantiene la política de uso dentro de límites.
 */
@Configuration
@EnableCaching
public class CacheConfig {

	@Bean
	public CacheManager cacheManager(
		@Value("${app.geocode.cache-max-size:2000}") int maxSize,
		@Value("${app.geocode.cache-ttl-hours:24}") int ttlHours) {
		CaffeineCacheManager manager = new CaffeineCacheManager("geocode");
		manager.setCaffeine(Caffeine.newBuilder()
				.maximumSize(maxSize)
				.expireAfterWrite(Duration.ofHours(ttlHours)));
		return manager;
	}
}