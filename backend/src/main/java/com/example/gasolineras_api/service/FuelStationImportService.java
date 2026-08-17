package com.example.gasolineras_api.service;

import com.example.gasolineras_api.client.FuelStationDataClient;
import com.example.gasolineras_api.client.FuelStationDataClientException;
import com.example.gasolineras_api.client.dto.GeoportalResponse;
import com.example.gasolineras_api.mapper.GeoportalStationNormalizer;
import com.example.gasolineras_api.mapper.NormalizationResult;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Instant;

/**
 * Servicio que orquesta la importación de datos del Geoportal:
 * obtención, normalización, persistencia y registro de resultado.
 */
@Service
public class FuelStationImportService {

	private static final Logger log = LoggerFactory.getLogger(FuelStationImportService.class);

	private final FuelStationDataClient client;
	private final GeoportalStationNormalizer normalizer;
	private final FuelStationPersistenceService persistence;

	public FuelStationImportService(FuelStationDataClient client,
			GeoportalStationNormalizer normalizer,
			FuelStationPersistenceService persistence) {
		this.client = client;
		this.normalizer = normalizer;
		this.persistence = persistence;
	}

	/**
	 * Ejecuta una importación completa: obtención → normalización → persistencia.
	 *
	 * @return resultado de la importación con conteos y estado
	 */
	public ImportResult runImport() {
		Instant timestamp = Instant.now();
		log.info("Inicio de importación de datos del Geoportal");

		try {
			GeoportalResponse response = client.fetchAllStations();
			NormalizationResult normalized = normalizer.normalize(
					response.estaciones(), response.fecha());

			int valid = normalized.validStations().size();
			int rejected = normalized.rejectedRecords().size();

			if (valid > 0) {
				persistence.persist(normalized, timestamp);
				log.info("Importación completada: {} estaciones persistidas, {} rechazadas, fecha de datos: {}",
						valid, rejected, response.fecha());
			} else {
				log.warn("Importación sin estaciones válidas: {} rechazadas", rejected);
			}

			if (rejected > 0) {
				normalized.rejectedRecords().forEach(r ->
						log.warn("  Rechazada {}: {}", r.stationId(), r.reason()));
			}

			return ImportResult.success(timestamp, valid, rejected);

		} catch (FuelStationDataClientException e) {
			log.error("Importación fallida (proveedor no disponible): {}", e.getMessage());
			return ImportResult.failure(timestamp, e.getMessage());
		} catch (Exception e) {
			log.error("Importación fallida (error inesperado): {}", e.getMessage(), e);
			return ImportResult.failure(timestamp, e.getMessage());
		}
	}
}
