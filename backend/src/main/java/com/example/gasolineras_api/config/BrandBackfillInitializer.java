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
 * Asigna la marca a las estaciones que se importaron antes de que existiera la
 * columna {@code marca} o que quedaron en la marca de reserva «otras» cuando el
 * catálogo no reconocía su rótulo. Re-evalúa también las «otras» para recoger
 * marcas que se añadan al catálogo después de la primera carga. Normaliza el
 * rótulo con el mismo catálogo de la importación, de modo que los conteos del
 * filtro por marca suman siempre el total de estaciones y filtrar por una
 * marca conocida devuelve resultados desde el primer arranque.
 *
 * <p>Es idempotente: solo toca filas sin marca o marcadas como «otras».</p>
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
				"SELECT official_id, rotulo FROM stations WHERE marca IS NULL OR marca = ?",
				(rs, rowNum) -> new Object[] { BrandCatalog.normalize(rs.getString("rotulo")), rs.getString("official_id") },
				OTHER);
		if (updates.isEmpty()) {
			return;
		}
		jdbcTemplate.batchUpdate(
				"UPDATE stations SET marca = ? WHERE official_id = ? AND (marca IS NULL OR marca = ?)",
				updates.stream().map(argsRow -> new Object[] { argsRow[0], argsRow[1], OTHER }).toList());
		log.info("Marcas reevaluadas en {} estaciones pendientes", updates.size());
	}
}