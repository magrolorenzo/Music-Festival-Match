import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import type { MatchResult } from "@/services/types";

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
      // Fit all
      const bounds = L.latLngBounds(results.map(r => [r.event.location.latitude, r.event.location.longitude]));
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 6 });
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
          />
        );
      })}

      <MapController selectedResult={selectedResult} results={results} />
    </MapContainer>
  );
}
