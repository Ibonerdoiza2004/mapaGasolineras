/** Elemento geolocalizado que participa en la agrupación de marcadores. */
export interface ClusterItem {
	id: string;
	lat: number;
	lon: number;
}

/** Grupo de estaciones próximas entre sí en la rejilla de píxeles del mapa. */
export interface MarkerCluster<T extends ClusterItem = ClusterItem> {
	lat: number;
	lon: number;
	count: number;
	items: T[];
}

/**
 * Agrupa estaciones por proximidad en el espacio de píxeles del mapa: las que
 * caen en la misma celda de `gridSizePx` píxeles se funden en un clúster con
 * la posición centrada en su centroide. Al acercar el zoom los puntos se
 * separan en pantalla y los clústeres se disuelven de forma natural.
 */
export function clusterizeStations<T extends ClusterItem>(
	items: readonly T[],
	project: (latlng: [number, number], zoom: number) => { x: number; y: number },
	zoom: number,
	gridSizePx: number,
): MarkerCluster<T>[] {
	const grid = gridSizePx > 0 ? gridSizePx : 1;
	const cells = new Map<string, T[]>();
	for (const item of items) {
		const point = project([item.lat, item.lon], zoom);
		const key = `${Math.floor(point.x / grid)}:${Math.floor(point.y / grid)}`;
		const existing = cells.get(key);
		if (existing) {
			existing.push(item);
		} else {
			cells.set(key, [item]);
		}
	}

	const clusters: MarkerCluster<T>[] = [];
	for (const members of cells.values()) {
		const lat = members.reduce((sum, member) => sum + member.lat, 0) / members.length;
		const lon = members.reduce((sum, member) => sum + member.lon, 0) / members.length;
		clusters.push({ lat, lon, count: members.length, items: members });
	}
	return clusters;
}
