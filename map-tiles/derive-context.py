#!/usr/bin/env python3
"""Deriva contexto cartográfico regional y etiquetas sin datos innecesarios."""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path
from typing import Any, Iterator


REGIONAL_UNITS = {"AND", "DZA", "ESP", "FXX", "MAR", "PRX", "SAH"}


def load_feature_collection(path: Path) -> list[dict[str, Any]]:
    with path.open(encoding="utf-8") as source:
        data = json.load(source)
    if data.get("type") != "FeatureCollection" or not isinstance(data.get("features"), list):
        raise ValueError(f"{path.name} no es una FeatureCollection válida")
    return data["features"]


def positions(value: Any) -> Iterator[tuple[float, float]]:
    if (
        isinstance(value, list)
        and len(value) >= 2
        and isinstance(value[0], (int, float))
        and isinstance(value[1], (int, float))
    ):
        lon, lat = float(value[0]), float(value[1])
        if math.isfinite(lon) and math.isfinite(lat):
            yield lon, lat
        return
    if isinstance(value, list):
        for child in value:
            yield from positions(child)


def has_position(feature: dict[str, Any], west: float, south: float, east: float, north: float) -> bool:
    geometry = feature.get("geometry") or {}
    return any(west <= lon <= east and south <= lat <= north for lon, lat in positions(geometry.get("coordinates")))


def derive_land(features: list[dict[str, Any]]) -> dict[str, Any]:
    regional = []
    spain = None
    for feature in features:
        properties = feature.get("properties") or {}
        unit = properties.get("GU_A3")
        if unit not in REGIONAL_UNITS:
            continue
        territory = properties.get("ADM0_A3")
        if territory == "GIB" or properties.get("NAME") == "Gibraltar":
            continue
        derived = {
            "type": "Feature",
            "properties": {"territory": territory},
            "geometry": feature.get("geometry"),
        }
        regional.append(derived)
        if unit == "ESP":
            spain = derived

    if spain is None:
        raise ValueError("La fuente no contiene la unidad territorial de España")
    required_areas = {
        "Península": (-9.5, 35.5, 4.5, 44.2),
        "Baleares": (1.0, 38.4, 4.5, 40.5),
        "Canarias": (-18.5, 27.3, -13.0, 29.6),
    }
    missing = [name for name, bounds in required_areas.items() if not has_position(spain, *bounds)]
    if missing:
        raise ValueError(f"La geometría española no cubre: {', '.join(missing)}")
    regional.sort(key=lambda feature: str(feature["properties"]["territory"]))
    return {"type": "FeatureCollection", "features": regional}


def derive_cities(features: list[dict[str, Any]]) -> dict[str, Any]:
    translations = {"Seville": "Sevilla"}
    cities = []
    for feature in features:
        properties = feature.get("properties") or {}
        if properties.get("adm0name") != "Spain" or float(properties.get("min_zoom", 99)) > 5.1:
            continue
        name = properties.get("namepar") or translations.get(properties.get("name")) or properties.get("name")
        cities.append({
            "type": "Feature",
            "properties": {"name": name, "rank": properties.get("scalerank", 9)},
            "geometry": feature.get("geometry"),
        })
    if not cities:
        raise ValueError("La fuente no contiene ciudades españolas visibles")
    return {"type": "FeatureCollection", "features": cities}


def write_collection(path: Path, collection: dict[str, Any]) -> None:
    with path.open("w", encoding="utf-8") as target:
        json.dump(collection, target, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        target.write("\n")


def main() -> None:
    if len(sys.argv) != 5:
        raise SystemExit("Uso: derive-context.py MAP_UNITS PLACES REGIONAL_LAND CITIES")
    units_source, places_source, land_target, cities_target = map(Path, sys.argv[1:])
    write_collection(land_target, derive_land(load_feature_collection(units_source)))
    write_collection(cities_target, derive_cities(load_feature_collection(places_source)))


if __name__ == "__main__":
    main()
