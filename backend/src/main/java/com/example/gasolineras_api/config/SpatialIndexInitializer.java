package com.example.gasolineras_api.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Crea los índices espaciales de PostGIS tras el arranque de la aplicación.
 * El índice GIST no puede definirse con anotaciones JPA, por lo que se crea
 * una única vez aquí (idempotente con IF NOT EXISTS).
 */
@Component
public class SpatialIndexInitializer implements ApplicationRunner {

	private static final Logger log = LoggerFactory.getLogger(SpatialIndexInitializer.class);

	private final JdbcTemplate jdbcTemplate;

	public SpatialIndexInitializer(JdbcTemplate jdbcTemplate) {
		this.jdbcTemplate = jdbcTemplate;
	}

	@Override
	public void run(ApplicationArguments args) {
		jdbcTemplate.execute(
				"CREATE INDEX IF NOT EXISTS idx_stations_location ON stations USING GIST (location)");
		log.info("Índice espacial GIST sobre stations.location verificado");
	}
}
