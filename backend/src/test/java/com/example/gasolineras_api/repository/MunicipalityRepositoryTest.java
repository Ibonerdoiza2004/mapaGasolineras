package com.example.gasolineras_api.repository;

import com.example.gasolineras_api.domain.Municipality;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(properties = "app.municipios.import-enabled=false")
@Transactional
class MunicipalityRepositoryTest {

	@Autowired
	private MunicipalityRepository municipalityRepository;

	@Autowired
	private PostalCodeRepository postalCodeRepository;

	@Test
	@DisplayName("Un municipio se persiste y recupera con todos sus campos")
	void municipalityIsPersisted() {
		Municipality saved = municipalityRepository.save(
				new Municipality("28079", "Madrid", "Madrid", 3_332_035, 40.4168, -3.7038));
		municipalityRepository.flush();

		Municipality found = municipalityRepository.findById("28079").orElseThrow();
		assertThat(found.getNombre()).isEqualTo("Madrid");
		assertThat(found.getProvincia()).isEqualTo("Madrid");
		assertThat(found.getPoblacion()).isEqualTo(3_332_035);
		assertThat(found.getLatitud()).isEqualTo(40.4168);
		assertThat(found.getLongitud()).isEqualTo(-3.7038);
		assertThat(found.getCode()).isEqualTo(saved.getCode());
	}

	@Test
	@DisplayName("Una coincidencia exacta devuelve el municipio")
	void exactMatchIsFound() {
		municipalityRepository.save(new Municipality(
				"48020", "Bilbao", "Bizkaia", 345_821, 43.2630, -2.9350));
		municipalityRepository.flush();

		List<Municipality> found = municipalityRepository.findSimilar("bilbao", 0.3, 4);

		assertThat(found).hasSize(1);
		assertThat(found.getFirst().getCode()).isEqualTo("48020");
	}

	@Test
	@DisplayName("Una errata en el nombre se tolera")
	void typoIsTolerated() {
		municipalityRepository.save(new Municipality(
				"28079", "Madrid", "Madrid", 3_332_035, 40.4168, -3.7038));
		municipalityRepository.flush();

		List<Municipality> found = municipalityRepository.findSimilar("madird", 0.25, 4);

		assertThat(found).hasSize(1);
		assertThat(found.getFirst().getNombre()).isEqualTo("Madrid");
	}

	@Test
	@DisplayName("Los resultados se ordenan por población descendente")
	void resultsAreOrderedByPopulationDesc() {
		municipalityRepository.save(new Municipality(
				"01001", "Vitoria-Gasteiz", "Álava", 253_996, 42.8467, -2.6721));
		municipalityRepository.save(new Municipality(
				"01002", "Vitoria la pequeña", "Álava", 1_200, 42.8, -2.6));
		municipalityRepository.save(new Municipality(
				"01003", "Vitoria del monte", "Álava", 500, 42.7, -2.5));
		municipalityRepository.flush();

		List<Municipality> found = municipalityRepository.findSimilar("vitoria", 0.3, 4);

		assertThat(found).isNotEmpty();
		assertThat(found.getFirst().getPoblacion()).isEqualTo(253_996);
	}

	@Test
	@DisplayName("El límite de resultados se respeta")
	void limitIsRespected() {
		municipalityRepository.save(new Municipality(
				"01001", "Vitoria-Gasteiz", "Álava", 253_996, 42.8467, -2.6721));
		municipalityRepository.save(new Municipality(
				"01002", "Vitoria la pequeña", "Álava", 1_200, 42.8, -2.6));
		municipalityRepository.save(new Municipality(
				"01003", "Vitoria del monte", "Álava", 500, 42.7, -2.5));
		municipalityRepository.save(new Municipality(
				"01004", "Vitoria del norte", "Álava", 300, 42.6, -2.4));
		municipalityRepository.flush();

		List<Municipality> found = municipalityRepository.findSimilar("vitoria", 0.3, 2);

		assertThat(found).hasSize(2);
	}

	@Test
	@DisplayName("Una consulta sin coincidencias devuelve lista vacía")
	void noMatchReturnsEmpty() {
		municipalityRepository.save(new Municipality(
				"28079", "Madrid", "Madrid", 3_332_035, 40.4168, -3.7038));
		municipalityRepository.flush();

		List<Municipality> found = municipalityRepository.findSimilar("qqqqqqqq", 0.3, 4);

		assertThat(found).isEmpty();
	}

	@Test
	@DisplayName("Un código postal se resuelve a su municipio")
	void postalCodeResolvesToMunicipality() {
		Municipality madrid = municipalityRepository.save(
				new Municipality("28079", "Madrid", "Madrid", 3_332_035, 40.4168, -3.7038));
		postalCodeRepository.save(new com.example.gasolineras_api.domain.PostalCode("28013", madrid));
		postalCodeRepository.flush();

		var found = postalCodeRepository.findByIdCode("28013");

		assertThat(found).hasSize(1);
		assertThat(found.getFirst().getMunicipality().getNombre()).isEqualTo("Madrid");
	}

	@Test
	@DisplayName("Un código postal desconocido devuelve lista vacía")
	void unknownPostalCodeReturnsEmpty() {
		var found = postalCodeRepository.findByIdCode("99999");

		assertThat(found).isEmpty();
	}
}