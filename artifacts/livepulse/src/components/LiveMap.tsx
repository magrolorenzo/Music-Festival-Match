import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import { formatEventDate } from "@/lib/dates";
import { getImageForId } from "@/lib/images";
import type { MatchResult } from "@/services/types";

function artistLabelFor(result: MatchResult): string {
  const performers = result.event.performers;
  const headliners = performers.filter((p) => p.isHeadliner).map((p) => p.name);
  const names = headliners.length ? headliners : performers.map((p) => p.name);
  return names.length > 2 ? `${names.slice(0, 2).join(", ")} +${names.length - 2} more` : names.join(", ");
}

interface LiveMapProps {
  results: MatchResult[];
  selectedEventId: string | null;
  onSelect: (id: string) => void;
}

// Controller to fly to selected marker
function MapController({ selectedResult, results }: { selectedResult: MatchResult | null, results: MatchResult[] }) {
  const map = useMap();
  
  useEffect(() => {
    if (selectedResult) {
      map.flyTo(
        [selectedResult.event.location.latitude, selectedResult.event.location.longitude], 
        10, 
        { duration: 1.5 }
      );
    } else if (results.length > 0) {
      // Fly to the geographic center of the top-ranked results (results are
      // already sorted best-first). Spread of the top set drives the zoom.
      const top = results.slice(0, Math.min(3, results.length));
      const centerLat = top.reduce((s, r) => s + r.event.location.latitude, 0) / top.length;
      const centerLng = top.reduce((s, r) => s + r.event.location.longitude, 0) / top.length;
      const zoom =
        top.length > 1
          ? Math.min(
              6,
              map.getBoundsZoom(
                L.latLngBounds(
                  top.map((r) => [r.event.location.latitude, r.event.location.longitude]),
                ),
                false,
                L.point(60, 60),
              ),
            )
          : 6;
      map.flyTo([centerLat, centerLng], zoom, { duration: 1.5 });
    }
  }, [selectedResult, results, map]);

  return null;
}

export default function LiveMap({ results, selectedEventId, onSelect }: LiveMapProps) {
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
        const image = getImageForId(result.event.id);
        
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
                {image && (
                  <img
                    src={image}
                    alt={result.event.name}
                    className="w-12 h-12 rounded-md object-cover shrink-0"
                  />
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

      <MapController selectedResult={selectedResult} results={results} />
    </MapContainer>
  );
}
