package com.example.gasolineras_api.service;

import com.example.gasolineras_api.domain.FuelType;
import com.example.gasolineras_api.domain.NormalizedStation;
import com.example.gasolineras_api.mapper.NormalizationResult;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Persiste datos normalizados en la base de datos mediante upserts masivos
 * (JDBC por lotes) para que una importación completa del Geoportal (~11.400
 * estaciones) termine en segundos. Reglas de idempotencia equivalentes al
 * modelo anterior:
 * - Estaciones: upsert por official_id; los campos de texto solo se
 *   sobrescriben si el nuevo valor no es nulo.
 * - Precios actuales: upsert por (station_id, fuel_type).
 * - Snapshots históricos: solo se inserta si no existe ya uno con la misma
 *   estación, combustible y fecha de datos (se precarga el conjunto existente).
 *
 * <p>El normalizador ya descarta coordenadas fuera de rango antes de llegar
 * aquí, por lo que no es necesario repetir esa validación por fila.</p>
 */
@Service
public class FuelStationPersistenceService {

	private static final Logger log = LoggerFactory.getLogger(FuelStationPersistenceService.class);
	private static final int BATCH_SIZE = 1000;

	private static final String UPSERT_STATION = """
			INSERT INTO stations (official_id, rotulo, direccion, codigo_postal, localidad, municipio,
				provincia, location, horario, tipo_venta, margen, data_date, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ST_SetSRID(ST_MakePoint(?, ?), 4326), ?, ?, ?, ?, ?)
			ON CONFLICT (official_id) DO UPDATE SET
				rotulo = COALESCE(EXCLUDED.rotulo, stations.rotulo),
				direccion = COALESCE(EXCLUDED.direccion, stations.direccion),
				localidad = COALESCE(EXCLUDED.localidad, stations.localidad),
				municipio = COALESCE(EXCLUDED.municipio, stations.municipio),
				provincia = COALESCE(EXCLUDED.provincia, stations.provincia),
				location = EXCLUDED.location,
				horario = EXCLUDED.horario,
				tipo_venta = EXCLUDED.tipo_venta,
				margen = EXCLUDED.margen,
				data_date = EXCLUDED.data_date,
				updated_at = EXCLUDED.updated_at
			""";

	private static final String UPSERT_CURRENT_PRICE = """
			INSERT INTO current_prices (station_id, fuel_type, price, updated_at)
			VALUES (?, ?, ?, ?)
			ON CONFLICT (station_id, fuel_type) DO UPDATE SET
				price = EXCLUDED.price,
				updated_at = EXCLUDED.updated_at
			""";

	private static final String INSERT_SNAPSHOT = """
			INSERT INTO price_snapshots (station_id, fuel_type, price, data_date, recorded_at)
			VALUES (?, ?, ?, ?, ?)
			""";

	private final JdbcTemplate jdbcTemplate;

	public FuelStationPersistenceService(JdbcTemplate jdbcTemplate) {
		this.jdbcTemplate = jdbcTemplate;
	}

	/**
	 * Persiste el resultado normalizado de una importación en una única
	 * transacción, con inserciones por lotes.
	 *
	 * @param normalized resultado de la normalización
	 * @param importTime timestamp de la importación
	 */
	@Transactional
	public void persist(NormalizationResult normalized, Instant importTime) {
		List<NormalizedStation> valid = normalized.validStations();
		if (valid.isEmpty()) {
			return;
		}
		String dataDate = normalized.fechaActualizacion();
		Timestamp timestamp = Timestamp.from(importTime);

		Set<String> existingStationIds = new HashSet<>(
				jdbcTemplate.queryForList("SELECT official_id FROM stations", String.class));
		Set<String> existingSnapshotKeys = new HashSet<>(jdbcTemplate.query(
				"SELECT station_id || '|' || fuel_type || '|' || data_date FROM price_snapshots",
				(rs, rowNum) -> rs.getString(1)));

		List<Object[]> stationArgs = new ArrayList<>(valid.size());
		List<Object[]> priceArgs = new ArrayList<>(valid.size() * 3);
		List<Object[]> snapshotArgs = new ArrayList<>(valid.size() * 3);

		for (NormalizedStation ns : valid) {
			stationArgs.add(new Object[] {
					ns.id(), ns.rotulo(), ns.direccion(), ns.codigoPostal(),
					ns.localidad(), ns.municipio(), ns.provincia(),
					ns.longitud(), ns.latitud(),
					ns.horario(), ns.tipoVenta(), ns.margen(),
					dataDate, timestamp
			});
			for (Map.Entry<FuelType, BigDecimal> entry : ns.precios().entrySet()) {
				FuelType fuelType = entry.getKey();
				BigDecimal price = entry.getValue();
				priceArgs.add(new Object[] { ns.id(), fuelType.name(), price, timestamp });
				String snapshotKey = ns.id() + '|' + fuelType.name() + '|' + dataDate;
				if (existingSnapshotKeys.add(snapshotKey)) {
					snapshotArgs.add(new Object[] {
							ns.id(), fuelType.name(), price, dataDate, timestamp
					});
				}
			}
		}

		batchUpdate(UPSERT_STATION, stationArgs);
		batchUpdate(UPSERT_CURRENT_PRICE, priceArgs);
		batchUpdate(INSERT_SNAPSHOT, snapshotArgs);

		int newStations = (int) stationArgs.stream()
				.filter(args -> !existingStationIds.contains(args[0]))
				.count();
		log.info("Persistidas {} estaciones ({} nuevas), {} precios, {} snapshots",
				valid.size(), newStations, priceArgs.size(), snapshotArgs.size());
	}

	private void batchUpdate(String sql, List<Object[]> args) {
		if (args.isEmpty()) {
			return;
		}
		for (int i = 0; i < args.size(); i += BATCH_SIZE) {
			List<Object[]> chunk = args.subList(i, Math.min(i + BATCH_SIZE, args.size()));
			jdbcTemplate.batchUpdate(sql, chunk);
		}
	}
}