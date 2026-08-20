package com.example.gasolineras_api.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.ClientHttpRequestInterceptor;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;
import java.util.List;

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
		RestTemplate restTemplate = new RestTemplate(factory);
		restTemplate.setInterceptors(List.of(geoportalRequestInterceptor()));
		return restTemplate;
	}

	/**
	 * El servidor IIS del Ministerio bloquea el cliente HTTP nativo de Java;
	 * se envían cabeceras de un navegador estándar para que acepte la petición.
	 */
	public static ClientHttpRequestInterceptor geoportalRequestInterceptor() {
		return (request, body, execution) -> {
			request.getHeaders().set(HttpHeaders.USER_AGENT,
					"Mozilla/5.0 (Windows NT 10.0; Win64; x64)");
			request.getHeaders().set(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE);
			return execution.execute(request, body);
		};
	}
}
