package com.example.gasolineras_api.mapper;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class BrandCatalogTest {

	@Test
	@DisplayName("Los alias del Geoportal se asignan a la marca comercial")
	void aliasesAreMappedToCommercialBrand() {
		assertThat(BrandCatalog.normalize("PLENERGY")).isEqualTo("plenoil");
		assertThat(BrandCatalog.normalize("PLENOIL")).isEqualTo("plenoil");
		assertThat(BrandCatalog.normalize("ESCLATOIL")).isEqualTo("esclave");
		assertThat(BrandCatalog.normalize("ESCLAVE OIL")).isEqualTo("esclave");
		assertThat(BrandCatalog.normalize("AUTONETOIL")).isEqualTo("autonetoil");
		assertThat(BrandCatalog.normalize("GM OIL")).isEqualTo("gmoil");
		assertThat(BrandCatalog.normalize("GMOIL")).isEqualTo("gmoil");
		// Cepsa y Moeve son la misma empresa (renombrada en 2024) pero se
		// mantienen separadas según el rótulo: la búsqueda ignora mayúsculas.
		assertThat(BrandCatalog.normalize("CEPSA")).isEqualTo("cepsa");
		assertThat(BrandCatalog.normalize("CEPSA E.S. ROCA")).isEqualTo("cepsa");
		assertThat(BrandCatalog.normalize("MOEVE")).isEqualTo("moeve");
		assertThat(BrandCatalog.normalize("Moeve")).isEqualTo("moeve");
		assertThat(BrandCatalog.normalize("GRUPO CACHO - MOEVE")).isEqualTo("moeve");
	}

	@Test
	@DisplayName("Los rótulos con marca y ubicación se reconocen por la palabra clave")
	void rotuloWithBrandAndLocationIsRecognized() {
		assertThat(BrandCatalog.normalize("REPSOL AVD. DE LA PAZ")).isEqualTo("repsol");
		assertThat(BrandCatalog.normalize("E.S. MURCHANTE AVIA")).isEqualTo("avia");
		assertThat(BrandCatalog.normalize("BP OIL ESPAÑA, S.A.U.")).isEqualTo("bp");
		assertThat(BrandCatalog.normalize("PETROCAT DIRECTE")).isEqualTo("petrocat");
	}

	@Test
	@DisplayName("Las marcas sin estaciones en el dataset caen en «otras»")
	void brandsWithoutStationsFallToOtras() {
		assertThat(BrandCatalog.normalize("ALDI")).isEqualTo(BrandCatalog.OTHER);
		assertThat(BrandCatalog.normalize("MERCADONA")).isEqualTo(BrandCatalog.OTHER);
		assertThat(BrandCatalog.normalize("IBEROIL")).isEqualTo(BrandCatalog.OTHER);
	}

	@Test
	@DisplayName("Un rótulo vacío o desconocido se asigna a «otras»")
	void blankOrUnknownRotuloFallsToOtras() {
		assertThat(BrandCatalog.normalize(null)).isEqualTo(BrandCatalog.OTHER);
		assertThat(BrandCatalog.normalize("  ")).isEqualTo(BrandCatalog.OTHER);
		assertThat(BrandCatalog.normalize("COOPERATIVA LOCAL")).isEqualTo(BrandCatalog.OTHER);
	}

	@Test
	@DisplayName("El catálogo expone todos los códigos con su etiqueta y valida los conocidos")
	void catalogExposesAllCodesAndValidatesKnown() {
		var catalog = BrandCatalog.catalog();

		assertThat(catalog).isNotEmpty();
		assertThat(catalog).extracting(BrandCatalog.BrandEntry::code)
				.contains("repsol", "plenoil", "esclave", "cepsa", "moeve", "q8", "bonarea");
		// Cepsa y Moeve se exponen por separado (misma empresa, distinto rótulo).
		assertThat(catalog).extracting(BrandCatalog.BrandEntry::label)
				.contains("Cepsa", "Moeve", "Repsol", "Plenoil", "Esclave", "BonÀrea")
				.doesNotContain("Moove");
		assertThat(BrandCatalog.isKnown("repsol")).isTrue();
		assertThat(BrandCatalog.isKnown("plenoil")).isTrue();
		assertThat(BrandCatalog.isKnown("moeve")).isTrue();
		assertThat(BrandCatalog.isKnown("ibeirol")).isFalse();
		assertThat(BrandCatalog.isKnown(BrandCatalog.OTHER)).isFalse();
	}
}