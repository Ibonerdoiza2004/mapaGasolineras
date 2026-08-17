package com.example.gasolineras_api.scheduler;

import com.example.gasolineras_api.service.FuelStationImportService;
import com.example.gasolineras_api.service.ImportResult;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Tarea programada que importa periódicamente los datos de estaciones
 * del Geoportal/MITECO. La frecuencia se configura mediante
 * {@code app.import.interval-ms} (por defecto, cada hora).
 */
@Component
@ConditionalOnProperty(name = "app.import.enabled", havingValue = "true", matchIfMissing = true)
public class FuelStationImportScheduler {

	private static final Logger log = LoggerFactory.getLogger(FuelStationImportScheduler.class);

	private final FuelStationImportService importService;

	public FuelStationImportScheduler(FuelStationImportService importService) {
		this.importService = importService;
	}

	@Scheduled(initialDelayString = "${app.import.interval-ms:3600000}", fixedDelayString = "${app.import.interval-ms:3600000}")
	public void importStations() {
		log.info("Ejecutando importación programada");
		ImportResult result = importService.runImport();

		if (result.success()) {
			log.info("Importación programada completada: {} válidas, {} rechazadas",
					result.stationsValid(), result.stationsRejected());
		} else {
			log.error("Importación programada fallida: {}", result.errorMessage());
		}
	}
}
