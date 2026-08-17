package com.example.gasolineras_api.repository;

import com.example.gasolineras_api.domain.FuelType;
import com.example.gasolineras_api.domain.PriceSnapshot;
import com.example.gasolineras_api.domain.Station;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PriceSnapshotRepository extends JpaRepository<PriceSnapshot, Long> {

	List<PriceSnapshot> findByStationOfficialIdOrderByRecordedAtDesc(String stationId);

	boolean existsByStationAndFuelTypeAndDataDate(Station station, FuelType fuelType, String dataDate);
}
