package com.example.gasolineras_api.mapper;

import java.text.Normalizer;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;

/**
 * Catálogo de marcas conocidas para etiquetar las estaciones durante la
 * importación. El catálogo se ajusta a los rótulos reales del Geoportal/MITECO:
 * cada marca puede tener varios alias (p. ej. Plenoil aparece como
 * {@code PLENERGY} y Esclave como {@code ESCLATOIL}). Cepsa y Moeve se
 * mantienen separadas: son la misma empresa (Cepsa pasó a llamarse Moeve en
 * 2024), pero sus estaciones conservan su rótulo histórico y el identificador
 * estable (IDEESS) permite seguir el cambio de marca sin perder el historial.
 * Todo rótulo que no coincida con ninguna marca se asigna a {@link #OTHER},
 * de modo que el buscador puede filtrar por marcas concretas o por el resto
 * con un único valor en la columna {@code marca}.
 */
public final class BrandCatalog {

	/** Código de la marca de reserva que agrupa todo rótulo no reconocido. */
	public static final String OTHER = "otras";

	/** Entrada del catálogo expuesta a la API (código y etiqueta legible). */
	public record BrandEntry(String code, String label) {
	}

	private record Brand(String code, String label, List<Pattern> patterns) {
	}

	private static final List<Brand> BRANDS = List.of(
			brand("repsol", "Repsol", "REPSOL"),
			brand("cepsa", "Cepsa", "CEPSA"),
			brand("moeve", "Moeve", "MOEVE"),
			brand("bp", "BP", "BP"),
			brand("shell", "Shell", "SHELL"),
			brand("ballenoil", "Ballenoil", "BALLENOIL"),
			brand("esclave", "Esclave", "ESCLAVE", "ESCLATOIL"),
			brand("petronor", "Petronor", "PETRONOR"),
			brand("campsa", "Campsa", "CAMPSA"),
			brand("carrefour", "Carrefour", "CARREFOUR"),
			brand("supeco", "Supeco", "SUPECO"),
			brand("galp", "Galp", "GALP"),
			brand("disa", "Disa", "DISA"),
			brand("avia", "Avia", "AVIA"),
			brand("plenoil", "Plenoil", "PLENOIL", "PLENERGY"),
			brand("petroprix", "Petroprix", "PETROPRIX"),
			brand("q8", "Q8", "Q8"),
			brand("bonarea", "BonÀrea", "BONAREA"),
			brand("agla", "Agla", "AGLA"),
			brand("valcarce", "Valcarce", "VALCARCE"),
			brand("alcampo", "Alcampo", "ALCAMPO"),
			brand("eni", "Eni", "ENI"),
			brand("ham", "Ham", "HAM"),
			brand("eroski", "Eroski", "EROSKI"),
			brand("meroil", "Meroil", "MEROIL"),
			brand("gasexpress", "Gasexpress", "GASEXPRESS"),
			brand("beroil", "Beroil", "BEROIL"),
			brand("tamoil", "Tamoil", "TAMOIL"),
			brand("molgas", "Molgas", "MOLGAS"),
			brand("ids", "IDS", "IDS"),
			brand("autonetoil", "Autonet", "AUTONETOIL", "AUTONET"),
			brand("iberdoex", "Iberdoex", "IBERDOEX"),
			brand("naturgy", "Naturgy", "NATURGY"),
			brand("easygas", "Easygas", "EASYGAS"),
			brand("agropal", "Agropal", "AGROPAL"),
			brand("petrocat", "Petrocatalana", "PETROCAT"),
			brand("petromiralles", "Petromiralles", "PETROMIRALLES"),
			brand("familyenergy", "Family Energy", "FAMILY ENERGY"),
			brand("gmoil", "GMOil", "GMOIL", "GM OIL"),
			brand("fastfuel", "Fast Fuel", "FAST FUEL")
	);

	private BrandCatalog() {
	}

	/** Asigna una marca al rótulo de la estación; {@code otras} si no se reconoce. */
	public static String normalize(String rotulo) {
		if (rotulo == null || rotulo.isBlank()) {
			return OTHER;
		}
		String text = stripAccents(rotulo).toUpperCase(Locale.ROOT);
		for (Brand brand : BRANDS) {
			for (Pattern pattern : brand.patterns()) {
				if (pattern.matcher(text).find()) {
					return brand.code();
				}
			}
		}
		return OTHER;
	}

	/** Comprueba si el código es una marca conocida (excluye {@code otras}). */
	public static boolean isKnown(String code) {
		return BRANDS.stream().anyMatch(brand -> brand.code().equals(code));
	}

	/** Catálogo de marcas conocidas, en el orden en que se muestran en la interfaz. */
	public static List<BrandEntry> catalog() {
		return BRANDS.stream()
				.map(brand -> new BrandEntry(brand.code(), brand.label()))
				.toList();
	}

	private static Brand brand(String code, String label, String... keywords) {
		List<Pattern> patterns = java.util.Arrays.stream(keywords)
				.map(keyword -> Pattern.compile("\\b" + Pattern.quote(keyword) + "\\b"))
				.toList();
		return new Brand(code, label, patterns);
	}

	private static String stripAccents(String value) {
		String decomposed = Normalizer.normalize(value, Normalizer.Form.NFD);
		return decomposed.replaceAll("\\p{M}", "");
	}
}