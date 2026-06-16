import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvent } from "react-leaflet";
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
  /** Event currently hovered in the sidebar list; the map flies to it. */
  hoveredEventId: string | null;
  onSelect: (id: string) => void;
  /** The verified place the user searched; the map opens framed on this. */
  searchCenter: SearchCenter | null;
}

// Default + highlighted (hovered/selected) marker hues — an all-orange scheme.
const DOT_DEFAULT = "#ff4500";
const DOT_HIGHLIGHT = "#ffb347";

// Venue list: show this many events first, then reveal more in steps.
const VENUE_INITIAL = 3;
const VENUE_STEP = 3;

/** A map marker = one venue (a coordinate) with all its events grouped under it. */
interface VenueGroup {
  id: string;
  latitude: number;
  longitude: number;
  venueName: string;
  city: string;
  results: MatchResult[];
}

/**
 * Collapse the flat result list into one entry per venue (same coordinates), so
 * events that share a location no longer stack invisibly on the same dot. Order
 * within each venue follows the incoming order (soonest-first).
 */
function groupByVenue(results: MatchResult[]): VenueGroup[] {
  const groups = new Map<string, VenueGroup>();
  for (const r of results) {
    const { latitude, longitude, name, city } = r.event.location;
    const key = `${latitude.toFixed(5)},${longitude.toFixed(5)}`;
    let group = groups.get(key);
    if (!group) {
      group = { id: key, latitude, longitude, venueName: name, city, results: [] };
      groups.set(key, group);
    }
    group.results.push(r);
  }
  return Array.from(groups.values());
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

// Clear a pinned venue popup when the user clicks empty map. Marker clicks are
// handled by the marker; clicks inside the popup are ignored explicitly (their
// DOM propagation isn't reliably stopped through the react-leaflet portal).
function MapBackgroundClick({ onClick }: { onClick: () => void }) {
  useMapEvent("click", (e) => {
    const target = e.originalEvent?.target as HTMLElement | null;
    if (target?.closest(".leaflet-popup")) return;
    onClick();
  });
  return null;
}

function VenuePopupItem({
  result,
  onSelect,
}: {
  result: MatchResult;
  onSelect: (id: string) => void;
}) {
  const { event } = result;
  return (
    <button
      type="button"
      data-testid={`venue-event-${event.id}`}
      onClick={() => onSelect(event.id)}
      className="flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left transition-colors hover:bg-white/10"
    >
      {event.image ? (
        <img
          src={event.image}
          alt={event.name}
          className="h-10 w-10 shrink-0 rounded-md object-cover object-top"
        />
      ) : (
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-xs font-bold text-white/80"
          style={{ background: placeholderGradient(event.id) }}
        >
          {initialsFor(event.name)}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-bold text-white">{event.name}</div>
        <div className="truncate text-xs font-medium text-primary">{artistLabelFor(result)}</div>
        <div className="truncate text-[11px] text-white/60">
          {formatEventDate(event.startDate, event.endDate)}
        </div>
      </div>
    </button>
  );
}

export default function LiveMap({ results, selectedEventId, hoveredEventId, onSelect, searchCenter }: LiveMapProps) {
  const selectedResult = results.find(r => r.event.id === selectedEventId) || null;
  const venues = useMemo(() => groupByVenue(results), [results]);

  // The venue whose event list is showing, whether it's a transient hover
  // preview or pinned open by a click.
  const [openVenueId, setOpenVenueId] = useState<string | null>(null);
  const [pinned, setPinned] = useState(false);
  const [shownCount, setShownCount] = useState(VENUE_INITIAL);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const popupInstanceRef = useRef<L.Popup>(null);
  const popupDivRef = useRef<HTMLDivElement>(null);

  // Reset the "show more" expansion whenever the open venue changes.
  useEffect(() => {
    setShownCount(VENUE_INITIAL);
  }, [openVenueId]);

  // If a new result set drops the currently open venue, close + unpin so the
  // popup doesn't get stuck (and hover previews aren't blocked by `pinned`).
  useEffect(() => {
    if (openVenueId && !venues.some((v) => v.id === openVenueId)) {
      setOpenVenueId(null);
      setPinned(false);
    }
  }, [venues, openVenueId]);

  // Clear any pending close timer on unmount.
  useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  // Refresh the Leaflet popup layout when its contents grow/shrink, otherwise
  // newly revealed events are clipped and "Show more" appears to do nothing.
  useEffect(() => {
    popupInstanceRef.current?.update();
  }, [shownCount, openVenueId]);

  // Stop clicks/scrolls inside the popup from reaching (and closing on) the map.
  // Re-applied whenever the popup content changes, because react-leaflet can
  // recreate the content node and drop the listeners on each update.
  useEffect(() => {
    if (popupDivRef.current) {
      L.DomEvent.disableClickPropagation(popupDivRef.current);
      L.DomEvent.disableScrollPropagation(popupDivRef.current);
    }
  }, [openVenueId, shownCount, pinned]);

  const cancelClose = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpenVenueId(null), 180);
  };

  const openVenue = venues.find(v => v.id === openVenueId) || null;
  const remaining = openVenue ? openVenue.results.length - shownCount : 0;

  return (
    <MapContainer 
      center={[40, -10]} 
      zoom={3} 
      style={{ width: "100%", height: "100%", background: "#0a0a0a" }}
      zoomControl={false}
      attributionControl={false}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />

      {venues.map((venue) => {
        const containsActive = venue.results.some(
          (r) => r.event.id === selectedEventId || r.event.id === hoveredEventId,
        );
        const isOpen = openVenueId === venue.id;
        const isHighlighted = containsActive || isOpen;
        const color = isHighlighted ? DOT_HIGHLIGHT : DOT_DEFAULT;
        const count = venue.results.length;

        const icon = L.divIcon({
          className: "",
          html: `<div class="venue-marker"><div class="glow-point ${isHighlighted ? "scale-125" : ""}" style="--marker-color: ${color}"></div>${
            count > 1 ? `<span class="venue-count">${count}</span>` : ""
          }</div>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        });

        return (
          <Marker
            key={venue.id}
            position={[venue.latitude, venue.longitude]}
            icon={icon}
            zIndexOffset={isHighlighted ? 1000 : 100}
            eventHandlers={{
              mouseover: () => {
                cancelClose();
                if (!pinned) setOpenVenueId(venue.id);
              },
              mouseout: () => {
                if (!pinned) scheduleClose();
              },
              click: () => {
                cancelClose();
                if (pinned && openVenueId === venue.id) {
                  setPinned(false);
                  setOpenVenueId(null);
                } else {
                  setPinned(true);
                  setOpenVenueId(venue.id);
                }
              },
            }}
          />
        );
      })}

      {openVenue && (
        <Popup
          ref={popupInstanceRef}
          position={[openVenue.latitude, openVenue.longitude]}
          closeButton={false}
          autoClose={false}
          closeOnClick={false}
          autoPan={pinned}
          offset={[0, -10]}
          className="livepulse-venue-popup"
        >
          <div
            ref={popupDivRef}
            data-testid="venue-popup"
            onMouseEnter={cancelClose}
            onMouseLeave={() => {
              if (!pinned) scheduleClose();
            }}
            className="w-[260px] max-w-[78vw] rounded-xl border border-white/12 bg-[rgba(10,10,10,0.96)] p-2 shadow-[0_8px_24px_rgba(0,0,0,0.6)] backdrop-blur"
          >
            <div className="px-1.5 pb-1.5 pt-0.5">
              <div className="truncate text-sm font-bold text-white">
                {openVenue.venueName || openVenue.city}
              </div>
              <div className="text-[11px] text-white/55">
                {openVenue.city} · {openVenue.results.length}{" "}
                {openVenue.results.length === 1 ? "event" : "events"}
              </div>
            </div>
            <div className="space-y-0.5">
              {openVenue.results.slice(0, shownCount).map((r) => (
                <VenuePopupItem key={r.event.id} result={r} onSelect={onSelect} />
              ))}
            </div>
            {remaining > 0 && (
              <button
                type="button"
                data-testid="venue-show-more"
                onClick={() => setShownCount((c) => c + VENUE_STEP)}
                className="mt-1 w-full rounded-lg bg-white/5 py-1.5 text-xs font-semibold text-white/80 transition-colors hover:bg-white/10"
              >
                Show {Math.min(VENUE_STEP, remaining)} more
              </button>
            )}
          </div>
        </Popup>
      )}

      <MapBackgroundClick
        onClick={() => {
          cancelClose();
          setPinned(false);
          setOpenVenueId(null);
        }}
      />

      <MapController selectedResult={selectedResult} searchCenter={searchCenter} />
    </MapContainer>
  );
}
