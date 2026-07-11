import { useEffect, useRef } from "react";
import L from "leaflet";
import type { MonsterHabitat, Npc } from "./types";

type Props = {
  npcs: Npc[];
  monsters: MonsterHabitat[];
  selectedMonsterIds: Set<number>;
  showMonsterAreas: boolean;
  selectedNpcId: number | null;
  giverNpcId: number | null;
  relatedNpcIds: Set<number>;
  matchedNpcIds: Set<number>;
  filtered: boolean;
  onSelectNpc: (id: number) => void;
};

class SilkroadTileLayer extends L.TileLayer {
  override getTileUrl(coords: L.Coords) {
    return super.getTileUrl({ ...coords, y: -coords.y } as L.Coords);
  }
}

const TILE_URL = "https://jellybitz.github.io/xSROMap/assets/img/silkroad/minimap/{z}/{x}x{y}.jpg";

export default function QuestMap({ npcs, monsters, selectedMonsterIds, showMonsterAreas, selectedNpcId, giverNpcId, relatedNpcIds, matchedNpcIds, filtered, onSelectNpc }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerLayerRef = useRef<L.LayerGroup | null>(null);
  const habitatLayerRef = useRef<L.LayerGroup | null>(null);
  const markersRef = useRef(new Map<number, L.Marker>());
  const onSelectRef = useRef(onSelectNpc);
  onSelectRef.current = onSelectNpc;

  useEffect(() => {
    if (!hostRef.current || mapRef.current) return;
    const map = L.map(hostRef.current, {
      crs: L.CRS.Simple,
      minZoom: 0,
      maxZoom: 9,
      zoomControl: true,
    }).setView([91, 135], 7);
    new SilkroadTileLayer(TILE_URL, {
      minZoom: 0,
      maxZoom: 9,
      attribution: 'Map data and tiles: <a href="https://github.com/JellyBitz/xSROMap">xSROMap</a>',
    }).addTo(map);
    habitatLayerRef.current = L.layerGroup().addTo(map);
    markerLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(hostRef.current);
    return () => {
      observer.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const layer = markerLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    markersRef.current.clear();

    for (const npc of npcs) {
      const state = npc.id === selectedNpcId ? "selected"
        : npc.id === giverNpcId ? "giver"
          : relatedNpcIds.has(npc.id) ? "related"
            : matchedNpcIds.has(npc.id) ? "matched" : "default";
      const marker = L.marker([npc.mapPosition.lat, npc.mapPosition.lng], {
        title: npc.name,
        alt: `${npc.name} NPC marker`,
        icon: L.divIcon({
          className: `npc-marker npc-marker--${state}`,
          html: "<span aria-hidden=\"true\"></span>",
          iconSize: state === "selected" ? [18, 18] : [12, 12],
          iconAnchor: state === "selected" ? [9, 9] : [6, 6],
        }),
      }).bindTooltip(npc.name, { direction: "top", offset: [0, -8] });
      marker.on("click", () => onSelectRef.current(npc.id));
      marker.addTo(layer);
      markersRef.current.set(npc.id, marker);
    }
  }, [npcs, selectedNpcId, giverNpcId, relatedNpcIds, matchedNpcIds]);

  useEffect(() => {
    const layer = habitatLayerRef.current;
    if (!layer) return;
    layer.clearLayers();

    const regions = new Map<string, { bounds: L.LatLngBoundsExpression; names: string[]; selected: boolean }>();
    for (const monster of monsters) {
      const selected = selectedMonsterIds.has(monster.id);
      for (const region of monster.habitatRegions) {
        const key = `${region.bounds.south}:${region.bounds.west}:${region.bounds.north}:${region.bounds.east}`;
        const existing = regions.get(key);
        if (existing) {
          if (!existing.names.includes(monster.name)) existing.names.push(monster.name);
          existing.selected ||= selected;
        } else {
          regions.set(key, {
            bounds: [[region.bounds.south, region.bounds.west], [region.bounds.north, region.bounds.east]],
            names: [monster.name],
            selected,
          });
        }
      }
    }

    for (const region of showMonsterAreas ? regions.values() : []) {
      L.rectangle(region.bounds, {
        color: region.selected ? "#ff8a8a" : "#e14b5a",
        weight: region.selected ? 3 : 2,
        opacity: .9,
        fillColor: "#d92332",
        fillOpacity: .25,
        dashArray: "7 5",
      }).bindTooltip(`Known habitat: ${region.names.join(", ")}`).addTo(layer);
    }

    for (const monster of monsters) {
      if (!monster.guidePosition) continue;
      const selected = selectedMonsterIds.has(monster.id);
      L.marker([monster.guidePosition.lat, monster.guidePosition.lng], {
        title: `${monster.name} representative guide pin`,
        alt: `${monster.name} representative guide pin within its known habitat`,
        icon: L.divIcon({
          className: `monster-marker${selected ? " monster-marker--selected" : ""}`,
          html: "<span aria-hidden=\"true\"></span>",
          iconSize: selected ? [20, 20] : [16, 16],
          iconAnchor: selected ? [10, 10] : [8, 8],
        }),
      }).bindTooltip(`${monster.name} (Lv. ${monster.level}) — representative guide pin`, { direction: "top", offset: [0, -8] }).addTo(layer);
    }
  }, [monsters, selectedMonsterIds, showMonsterAreas]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const selectedMonsters = monsters.filter((monster) => selectedMonsterIds.has(monster.id));
    if (selectedMonsters.length > 0) {
      const points = selectedMonsters.flatMap((monster) => [
        ...(monster.guidePosition ? [[monster.guidePosition.lat, monster.guidePosition.lng] as [number, number]] : []),
        ...(showMonsterAreas ? monster.habitatRegions : []).flatMap((region) => [
          [region.bounds.south, region.bounds.west] as [number, number],
          [region.bounds.north, region.bounds.east] as [number, number],
        ]),
      ]);
      if (points.length > 0) map.fitBounds(L.latLngBounds(points), { padding: [36, 36], maxZoom: 8 });
      return;
    }
    if (selectedNpcId) {
      const marker = markersRef.current.get(selectedNpcId);
      if (marker) {
        map.flyTo(marker.getLatLng(), Math.max(map.getZoom(), 8), { duration: 0.35 });
        marker.openTooltip();
      }
      return;
    }
    if (filtered && npcs.length > 0 && npcs.length <= 100) {
      map.fitBounds(L.latLngBounds(npcs.map((npc) => [npc.mapPosition.lat, npc.mapPosition.lng])), { padding: [36, 36], maxZoom: 8 });
    }
  }, [filtered, monsters, npcs, selectedMonsterIds, selectedNpcId, showMonsterAreas]);

  return <div ref={hostRef} className="quest-map" role="region" aria-label="Silkroad world map with searchable NPC markers and known monster habitats" />;
}
