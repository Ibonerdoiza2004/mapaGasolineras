package com.example.gasolineras_api.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;

/**
 * Configuración del cliente HTTP para el Geoportal/MITECO.
 */
@Configuration
public class GeoportalClientConfig {

	@Bean
	public RestTemplate geoportalRestTemplate(
		@Value("${app.geoportal.timeout-seconds:30}") int timeoutSeconds) {
		SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
		factory.setConnectTimeout(Duration.ofSeconds(10));
		factory.setReadTimeout(Duration.ofSeconds(timeoutSeconds));
		return new RestTemplate(factory);
	}
}
