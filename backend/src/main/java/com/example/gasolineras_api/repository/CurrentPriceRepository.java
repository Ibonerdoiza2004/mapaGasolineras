package com.example.gasolineras_api.repository;

import com.example.gasolineras_api.domain.CurrentPrice;
import com.example.gasolineras_api.domain.FuelType;
import com.example.gasolineras_api.domain.Station;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CurrentPriceRepository extends JpaRepository<CurrentPrice, Long> {

	Optional<CurrentPrice> findByStationAndFuelType(Station station, FuelType fuelType);

	List<CurrentPrice> findByStation(Station station);
}
