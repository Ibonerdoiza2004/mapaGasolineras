package com.example.gasolineras_api.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;

class CorsConfigTests {

	static final class TestableCorsRegistry extends CorsRegistry {
		Map<String, CorsConfiguration> configurations() {
			return getCorsConfigurations();
		}
	}

	@Test
	void parseaLosOrigenesConfiguradosIgnorandoVaciosYEspacios() {
		CorsConfig config = new CorsConfig(" http://localhost:4321 , https://app.example.com ,, ");
		TestableCorsRegistry registry = new TestableCorsRegistry();
		config.addCorsMappings(registry);

		CorsConfiguration cors = registry.configurations().get("/api/**");

		assertThat(cors).isNotNull();
		assertThat(cors.getAllowedOrigins())
				.containsExactly("http://localhost:4321", "https://app.example.com");
	}

	@Test
	void habilitaLosMetodosEsperadosYCualquierCabecera() {
		CorsConfig config = new CorsConfig("http://localhost:4321");
		TestableCorsRegistry registry = new TestableCorsRegistry();
		config.addCorsMappings(registry);

		CorsConfiguration cors = registry.configurations().get("/api/**");

		assertThat(cors.getAllowedMethods())
				.containsExactlyInAnyOrder("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS");
		assertThat(cors.getAllowedHeaders()).containsExactly("*");
	}
}
