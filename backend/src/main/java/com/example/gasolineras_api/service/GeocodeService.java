package com.example.gasolineras_api.service;

import com.example.gasolineras_api.client.GeocodeClient;
import com.example.gasolineras_api.client.GeocodeClientException;
import com.example.gasolineras_api.client.dto.GeocodePlace;
import com.example.gasolineras_api.domain.Municipality;
import com.example.gasolineras_api.dto.GeocodeSuggestionDto;
import com.example.gasolineras_api.exception.GeocodeRateLimitException;
import com.example.gasolineras_api.repository.MunicipalityRepository;
import com.example.gasolineras_api.repository.PostalCodeRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Deque;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * Búsqueda de ubicaciones por texto con caché y límite de uso. Resuelve
 * primero con el índice local de municipios (tolerante a erratas y
 * priorizado por población) y completa con el proveedor externo solo cuando
 * hace falta, para no gastar su cuota.
 */
@Service
public class GeocodeService {

	private static final Logger log = LoggerFactory.getLogger(GeocodeService.class);

	private static final long WINDOW_MS = 60_000L;
	private static final Pattern POSTAL_CODE = Pattern.compile("\\d{5}");
	private static final double MIN_SIMILARITY = 0.25;
	private static final int LOCAL_LIMIT = 4;
	private static final int MAX_SUGGESTIONS = 8;

	private final GeocodeClient geocodeClient;
	private final MunicipalityRepository municipalityRepository;
	private final PostalCodeRepository postalCodeRepository;
	private final CacheManager cacheManager;
	private final int maxRequestsPerMinute;
	private final Clock clock;
	private final Deque<Long> requestTimes = new ArrayDeque<>();

	@Autowired
	public GeocodeService(
		GeocodeClient geocodeClient,
		MunicipalityRepository municipalityRepository,
		PostalCodeRepository postalCodeRepository,
		CacheManager cacheManager,
		@Value("${app.geocode.max-requests-per-minute:30}") int maxRequestsPerMinute) {
		this(geocodeClient, municipalityRepository, postalCodeRepository, cacheManager,
				maxRequestsPerMinute, Clock.systemUTC());
	}

	GeocodeService(
		GeocodeClient geocodeClient,
		MunicipalityRepository municipalityRepository,
		PostalCodeRepository postalCodeRepository,
		CacheManager cacheManager,
		int maxRequestsPerMinute,
		Clock clock) {
		this.geocodeClient = geocodeClient;
		this.municipalityRepository = municipalityRepository;
		this.postalCodeRepository = postalCodeRepository;
		this.cacheManager = cacheManager;
		this.maxRequestsPerMinute = maxRequestsPerMinute;
		this.clock = clock;
	}

	/**
	 * Busca lugares que coinciden con la consulta. Las consultas repetidas
	 * se sirven desde caché sin consumir el límite de uso.
	 *
	 * <p>Si el proveedor falla pero existen coincidencias locales, se
	 * devuelven estas (resultado degradado) sin cachearlo, para que al
	 * recuperarse el proveedor se vuelva a consultar.
	 *
	 * @param query texto de búsqueda
	 * @return sugerencias ordenadas por relevancia
	 * @throws GeocodeRateLimitException si se supera el límite de la ventana
	 *         y no hay coincidencias locales que ofrecer
	 */
	public List<GeocodeSuggestionDto> search(String query) {
		String normalized = normalize(query);
		Cache cache = cacheManager.getCache("geocode");
		List<GeocodeSuggestionDto> cached = cache == null ? null : cache.get(query, List.class);
		if (cached != null) {
			return cached;
		}
		try {
			List<GeocodeSuggestionDto> result = doSearch(normalized);
			if (cache != null) {
				cache.put(query, result);
			}
			return result;
		} catch (GeocodeClientException | GeocodeRateLimitException e) {
			List<GeocodeSuggestionDto> local = localSuggestions(normalized);
			if (local.isEmpty()) {
				throw e;
			}
			log.warn("Geocodificación de \"{}\" degradada a resultados locales ({}): {}",
					normalized, e.getClass().getSimpleName(), e.getMessage());
			return local;
		}
	}

	private List<GeocodeSuggestionDto> doSearch(String normalized) {
		if (POSTAL_CODE.matcher(normalized).matches()) {
			List<GeocodeSuggestionDto> local = municipalitiesByPostalCode(normalized);
			if (!local.isEmpty()) {
				return local;
			}
			return searchProvider(normalized, true);
		}
		List<GeocodeSuggestionDto> result = municipalitySuggestions(normalized);
		if (result.size() < MAX_SUGGESTIONS) {
			appendUnique(result, searchProvider(normalized, false));
		}
		return result;
	}

	private List<GeocodeSuggestionDto> localSuggestions(String normalized) {
		if (POSTAL_CODE.matcher(normalized).matches()) {
			return municipalitiesByPostalCode(normalized);
		}
		return municipalitySuggestions(normalized);
	}

	private List<GeocodeSuggestionDto> municipalitiesByPostalCode(String postalCode) {
		List<Municipality> municipalities = postalCodeRepository.findByIdCode(postalCode).stream()
				.map(pc -> pc.getMunicipality())
				.distinct()
				.sorted(Comparator.comparingLong(Municipality::getPoblacion).reversed())
				.toList();
		return toSuggestions(municipalities, "postal_code");
	}

	private List<GeocodeSuggestionDto> municipalitySuggestions(String query) {
		List<Municipality> municipalities =
				municipalityRepository.findSimilar(query, MIN_SIMILARITY, LOCAL_LIMIT);
		return toSuggestions(municipalities, "municipality");
	}

	private List<GeocodeSuggestionDto> searchProvider(String query, boolean postalCode) {
		checkRateLimit();
		List<GeocodePlace> places = postalCode
				? geocodeClient.searchByPostalCode(query)
				: geocodeClient.search(query);
		log.info("Geocodificación de \"{}\": {} lugares", query, places.size());
		return toSuggestions(places);
	}

	private void appendUnique(List<GeocodeSuggestionDto> target, List<GeocodeSuggestionDto> extra) {
		Map<String, GeocodeSuggestionDto> unique = new LinkedHashMap<>();
		for (GeocodeSuggestionDto suggestion : target) {
			unique.put(dedupeKey(suggestion), suggestion);
		}
		for (GeocodeSuggestionDto suggestion : extra) {
			unique.putIfAbsent(dedupeKey(suggestion), suggestion);
		}
		List<GeocodeSuggestionDto> merged = new ArrayList<>(unique.values());
		target.clear();
		target.addAll(merged.subList(0, Math.min(merged.size(), MAX_SUGGESTIONS)));
	}

	private void checkRateLimit() {
		long now = clock.millis();
		synchronized (requestTimes) {
			while (!requestTimes.isEmpty() && now - requestTimes.peekFirst() >= WINDOW_MS) {
				requestTimes.removeFirst();
			}
			if (requestTimes.size() >= maxRequestsPerMinute) {
				throw new GeocodeRateLimitException(
						"Se ha alcanzado el límite de búsquedas; espera un momento e inténtalo de nuevo");
			}
			requestTimes.addLast(now);
		}
	}

	private String normalize(String query) {
		return query.trim().replaceAll("\\s+", " ");
	}

	private List<GeocodeSuggestionDto> toSuggestions(List<Municipality> municipalities, String tipo) {
		Map<String, GeocodeSuggestionDto> unique = new LinkedHashMap<>();
		for (Municipality municipality : municipalities) {
			GeocodeSuggestionDto suggestion = new GeocodeSuggestionDto(
					municipality.getCode(),
					municipality.getNombre(),
					municipality.getNombre() + ", " + municipality.getProvincia() + ", España",
					tipo,
					municipality.getLatitud(),
					municipality.getLongitud());
			unique.putIfAbsent(dedupeKey(suggestion), suggestion);
		}
		return new ArrayList<>(unique.values());
	}

	private List<GeocodeSuggestionDto> toSuggestions(List<GeocodePlace> places) {
		Map<String, GeocodeSuggestionDto> unique = new LinkedHashMap<>();
		for (GeocodePlace place : places) {
			unique.putIfAbsent(dedupeKey(place), new GeocodeSuggestionDto(
					place.id(),
					shortLabel(place.displayName()),
					place.displayName(),
					place.tipo(),
					place.lat(),
					place.lon()));
		}
		return new ArrayList<>(unique.values());
	}

	private String dedupeKey(GeocodePlace place) {
		return Math.round(place.lat() * 1_000_000) + "/" + Math.round(place.lon() * 1_000_000);
	}

	private String dedupeKey(GeocodeSuggestionDto suggestion) {
		return Math.round(suggestion.latitud() * 1_000_000) + "/"
				+ Math.round(suggestion.longitud() * 1_000_000);
	}

	private String shortLabel(String displayName) {
		if (displayName == null || displayName.isBlank()) {
			return "";
		}
		String first = displayName.split(",", 2)[0].trim();
		return first.isEmpty() ? displayName : first;
	}
}