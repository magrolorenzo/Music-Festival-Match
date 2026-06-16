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
  /** Event currently hovered in the sidebar list; only recolors the matching marker (no map movement). */
  hoveredEventId: string | null;
  onSelect: (id: string) => void;
  /** The verified place the user searched; the map opens framed on this. */
  searchCenter: SearchCenter | null;
}

// Default + highlighted (hovered/selected) marker hues — an all-orange scheme.
const DOT_DEFAULT = "#ff4500";
const DOT_HIGHLIGHT = "#ffb347";

// Below this Leaflet zoom we collapse venues into one pin per city; at or above
// it (or right after clicking a city) we split into individual venue pins.
const CITY_SPLIT_ZOOM = 12;

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

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

/** A city cluster: all venues that share a city, shown as one pin until split. */
interface CityGroup {
  id: string;
  city: string;
  latitude: number;
  longitude: number;
  venues: VenueGroup[];
  totalEvents: number;
}

/**
 * Collapse venues into one entry per city, positioned at the venues' centroid,
 * carrying the total event count for the city badge.
 */
function groupByCity(venues: VenueGroup[]): CityGroup[] {
  const groups = new Map<string, VenueGroup[]>();
  for (const v of venues) {
    const key = v.city || v.id;
    const list = groups.get(key);
    if (list) list.push(v);
    else groups.set(key, [v]);
  }
  return Array.from(groups.entries()).map(([key, vs]) => ({
    id: key,
    city: vs[0].city || vs[0].venueName,
    latitude: vs.reduce((s, v) => s + v.latitude, 0) / vs.length,
    longitude: vs.reduce((s, v) => s + v.longitude, 0) / vs.length,
    venues: vs,
    totalEvents: vs.reduce((s, v) => s + v.results.length, 0),
  }));
}

/** Bounds enclosing every venue in a city — used to frame the city on click. */
function boundsForVenues(venues: VenueGroup[]): L.LatLngBounds {
  return L.latLngBounds(
    venues.map((v) => [v.latitude, v.longitude] as [number, number]),
  );
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
  // Depend on the primitive lat/lng/radius values — NOT the searchCenter object
  // reference — because the parent recreates that object on every render (e.g.
  // when hover state changes), which would otherwise re-fly the map on hover.
  const centerLat = searchCenter?.latitude ?? null;
  const centerLng = searchCenter?.longitude ?? null;
  const centerRadiusKm = searchCenter?.radiusKm ?? null;
  useEffect(() => {
    if (centerLat == null || centerLng == null || centerRadiusKm == null) return;
    const bounds = boundsForRadius(centerLat, centerLng, centerRadiusKm);
    map.flyToBounds(bounds, {
      duration: 1.5,
      padding: L.point(48, 48),
      maxZoom: 11,
    });
  }, [centerLat, centerLng, centerRadiusKm, map]);

  // Marker selection: fly to the chosen event's exact coordinates.
  useEffect(() => {
    if (selectedResult) {
      map.flyTo(
        [selectedResult.event.location.latitude, selectedResult.event.location.longitude],
        13,
        { duration: 1.5 }
      );
    }
  }, [selectedResult, map]);

  return null;
}

// Tracks the live zoom level so the parent can switch between city clusters
// (zoomed out) and individual venue pins (zoomed in).
function ZoomWatcher({ onZoom }: { onZoom: (zoom: number) => void }) {
  const map = useMapEvent("zoomend", () => onZoom(map.getZoom()));
  useEffect(() => {
    onZoom(map.getZoom());
  }, [map, onZoom]);
  return null;
}

// Flies to a clicked city's bounds, zooming in past the split threshold so the
// city's venues fan out into individual pins.
function CityFocusController({
  cities,
  targetId,
  onConsumed,
}: {
  cities: CityGroup[];
  targetId: string | null;
  onConsumed: () => void;
}) {
  const map = useMap();
  useEffect(() => {
    if (!targetId) return;
    const target = cities.find((c) => c.id === targetId);
    if (target) {
      map.flyToBounds(boundsForVenues(target.venues), {
        duration: 1.2,
        padding: L.point(60, 60),
        maxZoom: 13,
      });
    }
    onConsumed();
    // Only react to a fresh click target; cities/map/onConsumed stay stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetId]);
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
  const cities = useMemo(() => groupByCity(venues), [venues]);

  // Current zoom decides whether we show one pin per city or split venue pins.
  const [zoom, setZoom] = useState(3);
  const showCities = zoom < CITY_SPLIT_ZOOM;
  // The city the user clicked, queued for the fly-and-split controller.
  const [focusCityId, setFocusCityId] = useState<string | null>(null);

  // The venue whose event list is showing, whether it's a transient hover
  // preview or pinned open by a click.
  const [openVenueId, setOpenVenueId] = useState<string | null>(null);
  const [pinned, setPinned] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const popupInstanceRef = useRef<L.Popup>(null);
  const popupDivRef = useRef<HTMLDivElement>(null);

  // Collapsing back to the city view closes any open venue popup.
  useEffect(() => {
    if (showCities) {
      setOpenVenueId(null);
      setPinned(false);
    }
  }, [showCities]);

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

  // Refresh the Leaflet popup layout when the open venue changes so its content
  // isn't clipped on first open.
  useEffect(() => {
    popupInstanceRef.current?.update();
  }, [openVenueId]);

  // Stop clicks/scrolls inside the popup from reaching (and closing on) the map.
  // Re-applied when the popup opens, because react-leaflet can recreate the
  // content node and drop the listeners.
  useEffect(() => {
    if (popupDivRef.current) {
      L.DomEvent.disableClickPropagation(popupDivRef.current);
      L.DomEvent.disableScrollPropagation(popupDivRef.current);
    }
  }, [openVenueId, pinned]);

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

  return (
    <MapContainer 
      center={[40, -10]} 
      zoom={3} 
      style={{ width: "100%", height: "100%", background: "#0a0a0a" }}
      zoomControl={true}
      attributionControl={false}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />

      {showCities
        ? cities.map((city) => {
            const containsActive = city.venues.some((v) =>
              v.results.some(
                (r) =>
                  r.event.id === selectedEventId || r.event.id === hoveredEventId,
              ),
            );
            const color = containsActive ? DOT_HIGHLIGHT : DOT_DEFAULT;
            const icon = L.divIcon({
              className: "",
              html: `<div class="city-marker ${
                containsActive ? "is-active" : ""
              }" data-testid="city-pin" style="--marker-color: ${color}"><span class="city-count">${
                city.totalEvents
              }</span><span class="city-label">${escapeHtml(city.city)}</span></div>`,
              iconSize: [44, 44],
              iconAnchor: [22, 22],
            });
            return (
              <Marker
                key={city.id}
                position={[city.latitude, city.longitude]}
                icon={icon}
                zIndexOffset={containsActive ? 1000 : 200}
                eventHandlers={{ click: () => setFocusCityId(city.id) }}
              />
            );
          })
        : venues.map((venue) => {
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

      {!showCities && openVenue && (
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
            <div className="max-h-[280px] space-y-0.5 overflow-y-auto pr-0.5 livepulse-scroll">
              {openVenue.results.map((r) => (
                <VenuePopupItem key={r.event.id} result={r} onSelect={onSelect} />
              ))}
            </div>
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
      <ZoomWatcher onZoom={setZoom} />
      <CityFocusController
        cities={cities}
        targetId={focusCityId}
        onConsumed={() => setFocusCityId(null)}
      />
    </MapContainer>
  );
}
