import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import { formatEventDate } from "@/lib/dates";
import { initialsFor, placeholderGradient } from "@/lib/images";
import type { MatchResult } from "@/services/types";

function artistLabelFor(result: MatchResult): string {
  const performers = result.event.performers;
  const headliners = performers.filter((p) => p.isHeadliner).map((p) => p.name);
  const names = headliners.length ? headliners : performers.map((p) => p.name);
  return names.length > 2 ? `${names.slice(0, 2).join(", ")} +${names.length - 2} more` : names.join(", ");
}

export interface SearchCenter {
  latitude: number;
  longitude: number;
  /** Search radius in km — drives the initial map extent (country vs city). */
  radiusKm: number;
}

interface LiveMapProps {
  results: MatchResult[];
  selectedEventId: string | null;
  onSelect: (id: string) => void;
  /** The verified place the user searched; the map opens framed on this. */
  searchCenter: SearchCenter | null;
}

/**
 * Builds a lat/lng bounds box of `radiusKm` around a center point. Flying to
 * these bounds makes Leaflet pick a zoom that reflects the search extent — a
 * country-scale radius zooms out, a city-scale radius zooms in.
 */
function boundsForRadius(
  latitude: number,
  longitude: number,
  radiusKm: number,
): L.LatLngBounds {
  const latDelta = radiusKm / 111;
  const lngDelta =
    radiusKm / (111 * Math.max(0.1, Math.cos((latitude * Math.PI) / 180)));
  return L.latLngBounds(
    [latitude - latDelta, longitude - lngDelta],
    [latitude + latDelta, longitude + lngDelta],
  );
}

// Controller: open framed on the chosen search coordinates (extent-based zoom),
// then fly straight to a marker when the user selects an event.
function MapController({
  selectedResult,
  searchCenter,
}: {
  selectedResult: MatchResult | null;
  searchCenter: SearchCenter | null;
}) {
  const map = useMap();

  // Initial framing: drive the view from the user's selected place + radius.
  useEffect(() => {
    if (!searchCenter) return;
    const bounds = boundsForRadius(
      searchCenter.latitude,
      searchCenter.longitude,
      searchCenter.radiusKm,
    );
    map.flyToBounds(bounds, {
      duration: 1.5,
      padding: L.point(48, 48),
      maxZoom: 11,
    });
  }, [searchCenter, map]);

  // Marker selection: fly to the chosen event's exact coordinates.
  useEffect(() => {
    if (selectedResult) {
      map.flyTo(
        [selectedResult.event.location.latitude, selectedResult.event.location.longitude],
        10,
        { duration: 1.5 }
      );
    }
  }, [selectedResult, map]);

  return null;
}

export default function LiveMap({ results, selectedEventId, onSelect, searchCenter }: LiveMapProps) {
  const selectedResult = results.find(r => r.event.id === selectedEventId) || null;

  return (
    <MapContainer 
      center={[40, -10]} 
      zoom={3} 
      style={{ width: "100%", height: "100%", background: "#0a0a0a" }}
      zoomControl={false}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
      />
      
      {results.map((result) => {
        const isSelected = result.event.id === selectedEventId;
        const color = isSelected ? "hsl(var(--primary))" : (result.isExactMatch ? "#ffffff" : "#666");
        const image = result.event.image;
        
        const icon = L.divIcon({
          className: "",
          html: `<div class="glow-point ${isSelected ? "scale-125" : ""}" style="--marker-color: ${color}"></div>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8]
        });

        return (
          <Marker 
            key={result.event.id}
            position={[result.event.location.latitude, result.event.location.longitude]}
            icon={icon}
            eventHandlers={{
              click: () => onSelect(result.event.id)
            }}
            zIndexOffset={isSelected ? 1000 : result.isExactMatch ? 500 : 100}
          >
            <Tooltip direction="top" offset={[0, -8]} opacity={1} className="livepulse-tooltip">
              <div className="flex gap-2.5 items-center">
                {image ? (
                  <img
                    src={image}
                    alt={result.event.name}
                    className="w-12 h-12 rounded-md object-cover object-top shrink-0"
                  />
                ) : (
                  <div
                    className="w-12 h-12 rounded-md shrink-0 flex items-center justify-center text-sm font-bold text-white/80"
                    style={{ background: placeholderGradient(result.event.id) }}
                  >
                    {initialsFor(result.event.name)}
                  </div>
                )}
                <div className="space-y-0.5">
                  <div className="font-bold text-sm text-white">{result.event.name}</div>
                  <div className="text-xs text-primary font-medium">{artistLabelFor(result)}</div>
                  <div className="text-[11px] text-white/60">
                    {formatEventDate(result.event.startDate, result.event.endDate)} · {result.event.location.city}
                  </div>
                </div>
              </div>
            </Tooltip>
          </Marker>
        );
      })}

      <MapController selectedResult={selectedResult} searchCenter={searchCenter} />
    </MapContainer>
  );
}
