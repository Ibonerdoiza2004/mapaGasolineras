package com.example.gasolineras_api.service;

import com.example.gasolineras_api.domain.Municipality;
import com.example.gasolineras_api.domain.PostalCode;
import com.example.gasolineras_api.repository.MunicipalityRepository;
import com.example.gasolineras_api.repository.PostalCodeRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ByteArrayResource;

import java.nio.charset.StandardCharsets;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class MunicipalityImportServiceTest {

	private MunicipalityRepository municipalityRepository;
	private PostalCodeRepository postalCodeRepository;

	private static final String MUNICIPALITIES_CSV = """
			28079,Madrid,Madrid,3332035,40.4168,-3.7038
			48020,Bilbao,Bizkaia,345821,43.2630,-2.9350
			28049,"Coslada, Madrid",Madrid,80171,40.4338,-3.5651
			""";

	private static final String POSTAL_CODES_CSV = """
			codigo_postal,municipio_id,municipio_nombre
			28013,28079,Madrid
			48007,48020,Bilbao
			18011,18914,Valderrubio
			""";

	@BeforeEach
	void setUp() {
		municipalityRepository = mock(MunicipalityRepository.class);
		postalCodeRepository = mock(PostalCodeRepository.class);
		when(municipalityRepository.findAll()).thenReturn(catalogMunicipalities());
		when(municipalityRepository.getReferenceById(anyString())).thenAnswer(invocation ->
				catalogMunicipalities().stream()
						.filter(m -> m.getCode().equals(invocation.getArgument(0)))
						.findFirst()
						.orElseThrow());
	}

	@Test
	@DisplayName("Un catálogo vacío se importa completo al arrancar")
	void runImportsBothCatalogsWhenEmpty() throws Exception {
		MunicipalityImportService service = service(MUNICIPALITIES_CSV, POSTAL_CODES_CSV);

		service.run(null);

		verify(municipalityRepository).saveAll(anyList());
		verify(postalCodeRepository).saveAll(anyList());
	}

	@Test
	@DisplayName("Un catálogo ya importado se omite")
	void runSkipsWhenAlreadyImported() throws Exception {
		when(municipalityRepository.count()).thenReturn(5L);
		MunicipalityImportService service = service(MUNICIPALITIES_CSV, POSTAL_CODES_CSV);

		service.run(null);

		verify(municipalityRepository, never()).saveAll(anyList());
		verify(postalCodeRepository, never()).saveAll(anyList());
	}

	@Test
	@DisplayName("Los municipios se importan con nombre, población y coordenadas")
	void municipalitiesAreImportedWithAllFields() throws Exception {
		MunicipalityImportService service = service(MUNICIPALITIES_CSV, POSTAL_CODES_CSV);

		service.importMunicipalities();

		var captor = org.mockito.ArgumentCaptor.forClass(List.class);
		verify(municipalityRepository).saveAll(captor.capture());
		List<Municipality> saved = captor.getValue();
		assertThat(saved).hasSize(3);
		Municipality madrid = saved.stream()
				.filter(m -> m.getCode().equals("28079"))
				.findFirst().orElseThrow();
		assertThat(madrid.getNombre()).isEqualTo("Madrid");
		assertThat(madrid.getPoblacion()).isEqualTo(3_332_035);
		assertThat(madrid.getLatitud()).isEqualTo(40.4168);
		assertThat(madrid.getLongitud()).isEqualTo(-3.7038);
	}

	@Test
	@DisplayName("Un nombre entre comillas con comas internas se parsea como un solo campo")
	void quotedNameWithCommasIsParsedAsSingleField() throws Exception {
		MunicipalityImportService service = service(MUNICIPALITIES_CSV, POSTAL_CODES_CSV);

		service.importMunicipalities();

		var captor = org.mockito.ArgumentCaptor.forClass(List.class);
		verify(municipalityRepository).saveAll(captor.capture());
		List<Municipality> saved = captor.getValue();
		assertThat(saved).anySatisfy(m -> {
			assertThat(m.getCode()).isEqualTo("28049");
			assertThat(m.getNombre()).isEqualTo("Coslada, Madrid");
		});
	}

	@Test
	@DisplayName("Una línea con campos de más se rechaza")
	void malformedMunicipalityLineIsRejected() {
		MunicipalityImportService service = service("28079,Madrid,Madrid,3332035,40.4168\n", POSTAL_CODES_CSV);

		assertThatThrownBy(service::importMunicipalities)
				.isInstanceOf(IllegalArgumentException.class)
				.hasMessageContaining("5 campos");
	}

	@Test
	@DisplayName("Un código postal sin municipio en el catálogo se omite")
	void postalCodeWithoutMunicipalityIsSkipped() throws Exception {
		MunicipalityImportService service = service(MUNICIPALITIES_CSV, POSTAL_CODES_CSV);
		service.importPostalCodes();

		var captor = org.mockito.ArgumentCaptor.forClass(List.class);
		verify(postalCodeRepository).saveAll(captor.capture());
		List<PostalCode> saved = captor.getValue();
		assertThat(saved).hasSize(2);
		assertThat(saved).extracting(pc -> pc.getId().getCode())
				.containsExactlyInAnyOrder("28013", "48007");
	}

	@Test
	@DisplayName("La cabecera del CSV de códigos postales se ignora")
	void postalCodesHeaderIsIgnored() throws Exception {
		MunicipalityImportService service = service(MUNICIPALITIES_CSV, """
				codigo_postal,municipio_id,municipio_nombre
				28013,28079,Madrid
				""");
		service.importPostalCodes();

		var captor = org.mockito.ArgumentCaptor.forClass(List.class);
		verify(postalCodeRepository).saveAll(captor.capture());
		List<PostalCode> saved = captor.getValue();
		assertThat(saved).extracting(pc -> pc.getId().getCode())
				.containsExactly("28013");
	}

	@Test
	@DisplayName("El parser respeta comillas escapadas en el nombre")
	void escapedQuotesAreParsed() {
		List<String> fields = MunicipalityImportService.parseCsvLine(
				"99999,\"O \"\"Quijote\"\"\",Granada,1,37.1,-3.6");

		assertThat(fields).containsExactly("99999", "O \"Quijote\"", "Granada", "1", "37.1", "-3.6");
	}

	@Test
	@DisplayName("El parser rechaza una línea con comillas sin cerrar")
	void unclosedQuoteIsRejected() {
		assertThatThrownBy(() -> MunicipalityImportService.parseCsvLine("\"Madrid,España,1"))
				.isInstanceOf(IllegalArgumentException.class)
				.hasMessageContaining("Comillas sin cerrar");
	}

	private List<Municipality> catalogMunicipalities() {
		return List.of(
				new Municipality("28079", "Madrid", "Madrid", 3_332_035, 40.4168, -3.7038),
				new Municipality("48020", "Bilbao", "Bizkaia", 345_821, 43.2630, -2.9350),
				new Municipality("28049", "Coslada, Madrid", "Madrid", 80_171, 40.4338, -3.5651));
	}

	private MunicipalityImportService service(String municipalitiesCsv, String postalCodesCsv) {
		return new MunicipalityImportService(
				municipalityRepository,
				postalCodeRepository,
				new ByteArrayResource(municipalitiesCsv.getBytes(StandardCharsets.UTF_8)),
				new ByteArrayResource(postalCodesCsv.getBytes(StandardCharsets.UTF_8)));
	}
}