import { useState, useRef, useCallback } from "react";
import type { SearchResponse } from "@/services/search";
import type { MatchResult } from "@/services/types";
import EventCard from "./EventCard";
import LiveMap, { type SearchCenter } from "./LiveMap";
import DetailPopup from "./DetailPopup";
import { radiusToKm } from "@/services/api";
import { Button } from "@/components/ui/button";
import { ArrowLeft, SlidersHorizontal, CalendarX } from "lucide-react";
import { motion } from "framer-motion";

export default function Results({ response, onReset }: { response: SearchResponse, onReset: () => void }) {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [hoveredEventId, setHoveredEventId] = useState<string | null>(null);
  const selectedEvent = response.results.find(r => r.event.id === selectedEventId) || null;

  const scrollRef = useRef<HTMLDivElement>(null);
  const dragState = useRef({
    isDragging: false,
    startY: 0,
    scrollTop: 0,
    hasMoved: false,
  });

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    // Only enable drag-to-scroll for mouse; touch uses native scroll
    if (e.pointerType !== "mouse") return;
    const el = scrollRef.current;
    if (!el) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragState.current = {
      isDragging: true,
      startY: e.clientY,
      scrollTop: el.scrollTop,
      hasMoved: false,
    };
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const state = dragState.current;
    const el = scrollRef.current;
    if (!state.isDragging || !el) return;
    const dy = e.clientY - state.startY;
    if (!state.hasMoved && Math.abs(dy) > 5) {
      state.hasMoved = true;
    }
    if (state.hasMoved) {
      e.preventDefault();
      el.scrollTop = state.scrollTop - dy;
    }
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    const state = dragState.current;
    if (state.isDragging && !state.hasMoved) {
      // If it was a short click without movement, allow the event to propagate
      // (e.g. clicking an EventCard). The card's onClick will still fire.
    }
    dragState.current.isDragging = false;
    dragState.current.hasMoved = false;
    (e.target as Element).releasePointerCapture?.(e.pointerId);
  }, []);

  const onPointerLeave = useCallback(() => {
    dragState.current.isDragging = false;
    dragState.current.hasMoved = false;
  }, []);

  // Sidebar + map share the same set, ordered by event start date (soonest
  // first). Scoring is untouched; only the display order changes.
  const orderedResults = [...response.results].sort((a, b) =>
    a.event.startDate.localeCompare(b.event.startDate),
  );

  const { location, radius, radiusUnit } = response.filters;
  const hasFilters =
    response.filters.genres.length > 0 || response.filters.moods.length > 0;
  const searchCenter: SearchCenter | null = location
    ? {
        latitude: location.latitude,
        longitude: location.longitude,
        radiusKm: radiusToKm(radius, radiusUnit),
      }
    : null;

  return (
    <div className="w-full h-full flex flex-col md:flex-row bg-background">
      {/* Left List Pane — on mobile this sits BELOW the map (order-2) */}
      <div className="order-2 md:order-none w-full md:w-[450px] lg:w-[500px] h-[50vh] md:h-full flex flex-col border-t md:border-t-0 md:border-r border-border bg-card/50 backdrop-blur-md z-20 shadow-xl">
        <div className="p-4 border-b border-white/5 flex items-center justify-between shrink-0">
          <Button variant="ghost" size="sm" onClick={onReset} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div className="text-sm font-medium">
            <span className="text-primary font-bold">{orderedResults.length}</span>{" "}
            {hasFilters ? "matches" : "events"}
          </div>
        </div>

        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto livepulse-scroll cursor-grab active:cursor-grabbing select-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerLeave}
        >
          <div className="p-4 space-y-4">
            {orderedResults.length === 0 ? (
              <div
                data-testid="empty-no-events"
                className="flex flex-col items-center text-center px-6 py-12 gap-4"
              >
                <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                  <CalendarX className="w-7 h-7 text-muted-foreground" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-lg font-bold">No events found</h3>
                  <p className="text-sm text-muted-foreground max-w-xs">
                    {hasFilters
                      ? "Nothing matched here for these dates and filters. Try a different place, wider dates, or other genres and moods."
                      : "Nothing's happening in this area for the dates you picked. Try a different place or wider dates."}
                  </p>
                </div>
                <Button
                  data-testid="button-back-to-filters"
                  onClick={onReset}
                  className="rounded-full font-semibold"
                >
                  <SlidersHorizontal className="w-4 h-4 mr-2" />
                  Adjust filters
                </Button>
              </div>
            ) : (
              orderedResults.map((result, i) => (
                <motion.div
                  key={result.event.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <EventCard
                    result={result}
                    isSelected={selectedEventId === result.event.id}
                    onClick={() => setSelectedEventId(result.event.id)}
                    onHoverStart={() => setHoveredEventId(result.event.id)}
                    onHoverEnd={() => setHoveredEventId(null)}
                  />
                </motion.div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Right Map Pane — on mobile this sits ABOVE the list (order-1) */}
      <div className="order-1 md:order-none flex-1 h-[50vh] md:h-full relative z-0">
        <LiveMap 
          results={orderedResults} 
          selectedEventId={selectedEventId} 
          hoveredEventId={hoveredEventId}
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
