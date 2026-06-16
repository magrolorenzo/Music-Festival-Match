import { useState } from "react";
import type { SearchResponse } from "@/services/search";
import type { MatchResult } from "@/services/types";
import EventCard from "./EventCard";
import LiveMap, { type SearchCenter } from "./LiveMap";
import DetailPopup from "./DetailPopup";
import { radiusToKm } from "@/services/api";
import { Button } from "@/components/ui/button";
import { ArrowLeft, SlidersHorizontal, Info } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion } from "framer-motion";

export default function Results({ response, onReset }: { response: SearchResponse, onReset: () => void }) {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const selectedEvent = response.results.find(r => r.event.id === selectedEventId) || null;

  const { location, radius, radiusUnit } = response.filters;
  const searchCenter: SearchCenter | null = location
    ? {
        latitude: location.latitude,
        longitude: location.longitude,
        radiusKm: radiusToKm(radius, radiusUnit),
      }
    : null;

  return (
    <div className="w-full h-full flex flex-col md:flex-row bg-background">
      {/* Left List Pane */}
      <div className="w-full md:w-[450px] lg:w-[500px] h-[50vh] md:h-full flex flex-col border-b md:border-b-0 md:border-r border-border bg-card/50 backdrop-blur-md z-20 shadow-xl">
        <div className="p-4 border-b border-white/5 flex items-center justify-between shrink-0">
          <Button variant="ghost" size="sm" onClick={onReset} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div className="text-sm font-medium">
            <span className="text-primary font-bold">{response.results.length}</span> matches
          </div>
        </div>

        {response.source === "mock" && (
          <div
            data-testid="notice-mock-data"
            className="flex items-start gap-2 px-4 py-2.5 bg-amber-500/10 border-b border-amber-500/20 text-amber-300 text-xs shrink-0"
          >
            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>
              Showing sample data — the live events service is unavailable right
              now, so these results are illustrative.
            </span>
          </div>
        )}

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-4">
            {response.results.length === 0 ? (
              <div className="text-center p-8 text-muted-foreground">
                <SlidersHorizontal className="w-8 h-8 mx-auto mb-3 opacity-50" />
                <p>No exact matches found. Try loosening your filters.</p>
              </div>
            ) : (
              response.results.map((result, i) => (
                <motion.div
                  key={result.event.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <EventCard 
                    result={result} 
                    filters={response.filters}
                    isSelected={selectedEventId === result.event.id}
                    onClick={() => setSelectedEventId(result.event.id)}
                  />
                </motion.div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Right Map Pane */}
      <div className="flex-1 h-[50vh] md:h-full relative z-0">
        <LiveMap 
          results={response.results} 
          selectedEventId={selectedEventId} 
          onSelect={setSelectedEventId} 
          searchCenter={searchCenter}
        />
      </div>

      {/* Detail Overlay */}
      {selectedEvent && (
        <DetailPopup 
          result={selectedEvent} 
          filters={response.filters}
          onClose={() => setSelectedEventId(null)} 
        />
      )}
    </div>
  );
}
