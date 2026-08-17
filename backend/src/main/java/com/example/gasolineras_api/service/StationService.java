package com.example.gasolineras_api.service;

import com.example.gasolineras_api.domain.CurrentPrice;
import com.example.gasolineras_api.domain.FuelType;
import com.example.gasolineras_api.domain.Station;
import com.example.gasolineras_api.dto.NearbyStationDto;
import com.example.gasolineras_api.dto.StationDetailDto;
import com.example.gasolineras_api.exception.ResourceNotFoundException;
import com.example.gasolineras_api.repository.CurrentPriceRepository;
import com.example.gasolineras_api.repository.NearbyStationProjection;
import com.example.gasolineras_api.repository.StationRepository;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

/**
 * Servicio de consulta de estaciones.
 */
@Service
public class StationService {

	public enum OrderBy {
		PRECIO, DISTANCIA, AHORRO
	}

	private final StationRepository stationRepository;
	private final CurrentPriceRepository currentPriceRepository;

	public StationService(StationRepository stationRepository,
			CurrentPriceRepository currentPriceRepository) {
		this.stationRepository = stationRepository;
		this.currentPriceRepository = currentPriceRepository;
	}

	/**
	 * Devuelve la ficha completa de una estación con sus precios disponibles.
	 *
	 * @param id identificador oficial de la estación
	 * @return ficha detallada
	 * @throws ResourceNotFoundException si la estación no existe
	 */
	public StationDetailDto getStationDetail(String id) {
		Station station = stationRepository.findById(id)
				.orElseThrow(() -> new ResourceNotFoundException("La estación " + id + " no existe"));

		Map<FuelType, BigDecimal> precios = new EnumMap<>(FuelType.class);
		for (CurrentPrice cp : currentPriceRepository.findByStation(station)) {
			precios.put(cp.getFuelType(), cp.getPrice());
		}

		return new StationDetailDto(
				station.getOfficialId(),
				station.getRotulo(),
				station.getDireccion(),
				station.getCodigoPostal(),
				station.getLocalidad(),
				station.getMunicipio(),
				station.getProvincia(),
				station.getLocation().getY(),
				station.getLocation().getX(),
				station.getHorario(),
				station.getTipoVenta(),
				station.getMargen(),
				precios,
				station.getDataDate()
		);
	}

	/**
	 * Busca estaciones dentro de un radio con el precio del combustible
	 * solicitado y calcula la distancia, el ahorro frente a la mejor opción
	 * y el orden solicitado.
	 *
	 * @param lat        latitud del centro
	 * @param lon        longitud del centro
	 * @param radioKm    radio de búsqueda en kilómetros
	 * @param fuelType   combustible
	 * @param orderBy    criterio de ordenación
	 * @return lista de estaciones cercanas con distancia, precio y ahorro
	 */
	public List<NearbyStationDto> findNearby(double lat, double lon, double radioKm,
			FuelType fuelType, OrderBy orderBy) {
		double radiusMeters = radioKm * 1000.0;

		List<NearbyStationProjection> projections =
				stationRepository.findNearby(lat, lon, radiusMeters, fuelType.name());

		BigDecimal bestPrice = projections.stream()
				.map(NearbyStationProjection::getPrecio)
				.filter(p -> p != null)
				.min(BigDecimal::compareTo)
				.orElse(null);

		return projections.stream()
				.map(p -> toDto(p, bestPrice))
				.sorted(comparator(orderBy))
				.toList();
	}

	private NearbyStationDto toDto(NearbyStationProjection p, BigDecimal bestPrice) {
		BigDecimal ahorro = null;
		if (p.getPrecio() != null && bestPrice != null) {
			ahorro = p.getPrecio().subtract(bestPrice);
		}
		return new NearbyStationDto(
				p.getOfficialId(),
				p.getRotulo(),
				p.getDireccion(),
				p.getLocalidad(),
				p.getProvincia(),
				p.getLatitud(),
				p.getLongitud(),
				p.getDistanciaKm(),
				p.getPrecio(),
				ahorro,
				p.getDataDate()
		);
	}

	private Comparator<NearbyStationDto> comparator(OrderBy orderBy) {
		return switch (orderBy) {
			case DISTANCIA -> Comparator.comparingDouble(NearbyStationDto::distanciaKm)
					.thenComparingDouble(NearbyStationDto::latitud);
			case AHORRO -> Comparator
					.comparing(NearbyStationDto::ahorro, Comparator.nullsLast(Comparator.naturalOrder()))
					.thenComparing(NearbyStationDto::precio, Comparator.nullsLast(Comparator.naturalOrder()));
			case PRECIO -> Comparator
					.comparing(NearbyStationDto::precio, Comparator.nullsLast(Comparator.naturalOrder()))
					.thenComparingDouble(NearbyStationDto::distanciaKm);
		};
	}
}
