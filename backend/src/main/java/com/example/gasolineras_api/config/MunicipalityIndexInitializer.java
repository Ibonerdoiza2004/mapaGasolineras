package com.example.gasolineras_api.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Crea la extensión pg_trgm y el índice GIN sobre el nombre de municipio
 * tras el arranque. El índice GIN no puede definirse con anotaciones JPA,
 * por lo que se crea una única vez aquí (idempotente con IF NOT EXISTS).
 */
@Component
public class MunicipalityIndexInitializer implements ApplicationRunner {

	private static final Logger log = LoggerFactory.getLogger(MunicipalityIndexInitializer.class);

	private final JdbcTemplate jdbcTemplate;

	public MunicipalityIndexInitializer(JdbcTemplate jdbcTemplate) {
		this.jdbcTemplate = jdbcTemplate;
	}

	@Override
	public void run(ApplicationArguments args) {
		jdbcTemplate.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm");
		jdbcTemplate.execute(
				"CREATE INDEX IF NOT EXISTS idx_municipalities_nombre_gin "
						+ "ON municipalities USING gin (nombre gin_trgm_ops)");
		log.info("Extensión pg_trgm e índice GIN sobre municipalities.nombre verificados");
	}
}