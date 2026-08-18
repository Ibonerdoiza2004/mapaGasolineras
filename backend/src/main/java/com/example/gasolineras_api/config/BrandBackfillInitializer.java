package com.example.gasolineras_api.config;

import com.example.gasolineras_api.mapper.BrandCatalog;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.List;

import static com.example.gasolineras_api.mapper.BrandCatalog.OTHER;

/**
 * Mantiene la marca de las estaciones alineada con el catálogo actual.
 * Re-normaliza el rótulo de todas las estaciones con el catálogo vigente y
 * actualiza solo las filas cuyo valor difiere. Así se cubren desde el primer
 * arranque: estaciones importadas antes de existir la columna {@code marca},
 * marcas que se añaden al catálogo después de la primera carga y cambios de
 * marca por renombrado del rótulo (el identificador estable IDEESS garantiza
 * que es la misma estación). Es idempotente y converge en cada arranque.
 */
@Component
public class BrandBackfillInitializer implements ApplicationRunner {

	private static final Logger log = LoggerFactory.getLogger(BrandBackfillInitializer.class);

	private final JdbcTemplate jdbcTemplate;

	public BrandBackfillInitializer(JdbcTemplate jdbcTemplate) {
		this.jdbcTemplate = jdbcTemplate;
	}

	@Override
	public void run(ApplicationArguments args) {
		List<Object[]> updates = jdbcTemplate.query(
				"SELECT official_id, rotulo, marca FROM stations",
				(rs, rowNum) -> {
					String normalized = BrandCatalog.normalize(rs.getString("rotulo"));
					String current = rs.getString("marca");
					if (normalized.equals(current)) {
						return null;
					}
					return new Object[] { normalized, rs.getString("official_id") };
				});
		List<Object[]> pending = updates.stream().filter(java.util.Objects::nonNull).toList();
		if (pending.isEmpty()) {
			return;
		}
		jdbcTemplate.batchUpdate("UPDATE stations SET marca = ? WHERE official_id = ?", pending);
		log.info("Marcas actualizadas en {} estaciones", pending.size());
	}
}