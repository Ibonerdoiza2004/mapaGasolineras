package com.example.gasolineras_api.service;

import com.example.gasolineras_api.domain.Municipality;
import com.example.gasolineras_api.domain.PostalCode;
import com.example.gasolineras_api.repository.MunicipalityRepository;
import com.example.gasolineras_api.repository.PostalCodeRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Importa al arranque el catálogo estático de municipios (código INE,
 * nombre, provincia, población y centroide) y sus códigos postales desde
 * recursos del classpath. Idempotente: si la tabla ya tiene datos, no
 * reimporta.
 */
@Component
@ConditionalOnProperty(name = "app.municipios.import-enabled", havingValue = "true", matchIfMissing = true)
public class MunicipalityImportService implements ApplicationRunner {

	private static final Logger log = LoggerFactory.getLogger(MunicipalityImportService.class);
	private static final int BATCH_SIZE = 500;

	private final MunicipalityRepository municipalityRepository;
	private final PostalCodeRepository postalCodeRepository;
	private final Resource municipalitiesResource;
	private final Resource postalCodesResource;

	@Autowired
	public MunicipalityImportService(
			MunicipalityRepository municipalityRepository,
			PostalCodeRepository postalCodeRepository,
			@Value("classpath:municipios.csv") Resource municipalitiesResource,
			@Value("classpath:codigos-postales.csv") Resource postalCodesResource) {
		this.municipalityRepository = municipalityRepository;
		this.postalCodeRepository = postalCodeRepository;
		this.municipalitiesResource = municipalitiesResource;
		this.postalCodesResource = postalCodesResource;
	}

	@Override
	@Transactional
	public void run(ApplicationArguments args) throws IOException {
		if (municipalityRepository.count() > 0) {
			log.info("Catálogo de municipios ya importado; se omite la importación");
			return;
		}
		importMunicipalities();
		importPostalCodes();
	}

	void importMunicipalities() throws IOException {
		List<Municipality> batch = new ArrayList<>(BATCH_SIZE);
		int imported = 0;
		try (BufferedReader reader = new BufferedReader(
				new InputStreamReader(municipalitiesResource.getInputStream(), StandardCharsets.UTF_8))) {
			String line;
			while ((line = reader.readLine()) != null) {
				if (line.isBlank()) {
					continue;
				}
				List<String> fields = parseCsvLine(line);
				if (fields.size() != 6) {
					throw new IllegalArgumentException(
							"Línea de municipio con " + fields.size() + " campos: " + line);
				}
				batch.add(new Municipality(
						fields.get(0),
						fields.get(1),
						fields.get(2),
						Long.parseLong(fields.get(3)),
						Double.parseDouble(fields.get(4)),
						Double.parseDouble(fields.get(5))));
				imported++;
				if (batch.size() >= BATCH_SIZE) {
					municipalityRepository.saveAll(batch);
					batch.clear();
				}
			}
		}
		if (!batch.isEmpty()) {
			municipalityRepository.saveAll(batch);
		}
		log.info("Importados {} municipios", imported);
	}

	void importPostalCodes() throws IOException {
		Set<String> existingCodes = new HashSet<>(municipalityRepository.findAll().stream()
				.map(Municipality::getCode)
				.toList());
		List<PostalCode> batch = new ArrayList<>(BATCH_SIZE);
		int imported = 0;
		int skipped = 0;
		try (BufferedReader reader = new BufferedReader(
				new InputStreamReader(postalCodesResource.getInputStream(), StandardCharsets.UTF_8))) {
			// Cabecera: codigo_postal,municipio_id,municipio_nombre
			reader.readLine();
			String line;
			while ((line = reader.readLine()) != null) {
				if (line.isBlank()) {
					continue;
				}
				List<String> fields = parseCsvLine(line);
				if (fields.size() != 3) {
					throw new IllegalArgumentException(
							"Línea de código postal con " + fields.size() + " campos: " + line);
				}
				String code = fields.get(0);
				String municipalityCode = fields.get(1);
				if (!existingCodes.contains(municipalityCode)) {
					skipped++;
					continue;
				}
				batch.add(new PostalCode(code, municipalityRepository.getReferenceById(municipalityCode)));
				imported++;
				if (batch.size() >= BATCH_SIZE) {
					postalCodeRepository.saveAll(batch);
					batch.clear();
				}
			}
		}
		if (!batch.isEmpty()) {
			postalCodeRepository.saveAll(batch);
		}
		if (skipped > 0) {
			log.warn("Códigos postales sin municipio en el catálogo (omitidos): {}", skipped);
		}
		log.info("Importados {} códigos postales", imported);
	}

	/**
	 * Divide una línea CSV (RFC 4180, una única línea) respetando campos
	 * entre comillas con comas internas y comillas escapadas ("").
	 */
	static List<String> parseCsvLine(String line) {
		List<String> fields = new ArrayList<>();
		StringBuilder current = new StringBuilder();
		boolean inQuotes = false;
		for (int i = 0; i < line.length(); i++) {
			char c = line.charAt(i);
			if (inQuotes) {
				if (c == '"') {
					if (i + 1 < line.length() && line.charAt(i + 1) == '"') {
						current.append('"');
						i++;
					} else {
						inQuotes = false;
					}
				} else {
					current.append(c);
				}
			} else if (c == '"') {
				inQuotes = true;
			} else if (c == ',') {
				fields.add(current.toString());
				current.setLength(0);
			} else {
				current.append(c);
			}
		}
		if (inQuotes) {
			throw new IllegalArgumentException("Comillas sin cerrar en la línea CSV: " + line);
		}
		fields.add(current.toString());
		return fields;
	}
}