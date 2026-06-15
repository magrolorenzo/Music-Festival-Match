import { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import type { DateRange as DayPickerRange } from "react-day-picker";
import type {
  SearchFilters,
  GenreKey,
  MoodKey,
  RadiusUnit,
  GeoLocation,
} from "@/services/types";
import { GENRES, MOODS, moodHue } from "@/lib/taxonomy";
import { geocodeLocation } from "@/services/api";
import { APP_TODAY, fromISODate, toISODate } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Loader2, MapPin, CalendarDays } from "lucide-react";

interface LandingProps {
  filters: SearchFilters;
  onSearch: (filters: SearchFilters) => void;
}

// ----- Mood "cake": a radial, multi-select segmented mood picker -------------

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

function annularSector(
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  startAngle: number,
  endAngle: number,
): string {
  const so = polar(cx, cy, rOuter, endAngle);
  const eo = polar(cx, cy, rOuter, startAngle);
  const si = polar(cx, cy, rInner, startAngle);
  const ei = polar(cx, cy, rInner, endAngle);
  const largeArc = endAngle - startAngle <= 180 ? "0" : "1";
  return [
    "M", so.x, so.y,
    "A", rOuter, rOuter, 0, largeArc, 0, eo.x, eo.y,
    "L", si.x, si.y,
    "A", rInner, rInner, 0, largeArc, 1, ei.x, ei.y,
    "Z",
  ].join(" ");
}

function MoodCake({
  selected,
  onToggle,
}: {
  selected: MoodKey[];
  onToggle: (m: MoodKey) => void;
}) {
  const size = 220;
  const cx = size / 2;
  const cy = size / 2;
  const rOuter = 104;
  const rInner = 52;
  const slice = 360 / MOODS.length;

  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="overflow-visible"
      >
        {MOODS.map((m, i) => {
          const start = i * slice;
          const end = start + slice;
          const isActive = selected.includes(m.key);
          const mid = start + slice / 2;
          const labelPos = polar(cx, cy, (rOuter + rInner) / 2, mid);
          return (
            <g key={m.key} className="cursor-pointer">
              <path
                data-testid={`filter-mood-${m.key}`}
                d={annularSector(cx, cy, rOuter, rInner, start, end)}
                onClick={() => onToggle(m.key)}
                fill={`hsl(${m.hue})`}
                fillOpacity={isActive ? 1 : 0.16}
                stroke="#0a0a0a"
                strokeWidth={3}
                style={{
                  filter: isActive
                    ? `drop-shadow(0 0 12px hsl(${m.hue} / 0.6))`
                    : "none",
                  transition: "fill-opacity 0.3s ease, filter 0.3s ease",
                }}
                className="hover:fill-opacity-100"
              />
              <text
                x={labelPos.x}
                y={labelPos.y - 6}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="22"
                style={{ pointerEvents: "none", userSelect: "none" }}
              >
                {m.emoji}
              </text>
              <text
                x={labelPos.x}
                y={labelPos.y + 14}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="10"
                fontWeight="700"
                fill={isActive ? "#fff" : "rgba(255,255,255,0.55)"}
                style={{
                  pointerEvents: "none",
                  userSelect: "none",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  transition: "fill 0.3s ease",
                }}
              >
                {m.label}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="text-center">
          <div className="text-2xl font-extrabold leading-none">
            {selected.length || "Any"}
          </div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">
            {selected.length === 1
              ? "Mood"
              : selected.length > 1
                ? "Moods"
                : "Vibe"}
          </div>
        </div>
      </div>
    </div>
  );
}

// ----- Landing ---------------------------------------------------------------

export default function Landing({
  filters: initialFilters,
  onSearch,
}: LandingProps) {
  const [locationQuery, setLocationQuery] = useState(
    initialFilters.location?.query ?? "",
  );
  const [radius, setRadius] = useState(initialFilters.radius);
  const [radiusUnit, setRadiusUnit] = useState<RadiusUnit>(
    initialFilters.radiusUnit,
  );
  const [genres, setGenres] = useState<GenreKey[]>(initialFilters.genres);
  const [moods, setMoods] = useState<MoodKey[]>(initialFilters.moods);
  const [range, setRange] = useState<DayPickerRange | undefined>({
    from: fromISODate(initialFilters.startDate),
    to: fromISODate(initialFilters.endDate),
  });
  const [geoError, setGeoError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const [cycleIndex, setCycleIndex] = useState(0);

  // When no mood is chosen, the hero backdrop autonomously cycles through the
  // mood themes. Selecting moods locks the hue to the first selected mood.
  useEffect(() => {
    if (moods.length > 0) return;
    const id = setInterval(() => {
      setCycleIndex((i) => (i + 1) % MOODS.length);
    }, 3500);
    return () => clearInterval(id);
  }, [moods]);

  const activeMoodHue = useMemo(() => {
    if (moods.length > 0) return moodHue(moods[0]);
    return MOODS[cycleIndex].hue;
  }, [moods, cycleIndex]);

  const toggleGenre = (g: GenreKey) =>
    setGenres((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g],
    );

  const toggleMood = (m: MoodKey) =>
    setMoods((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m],
    );

  const dateLabel = useMemo(() => {
    if (!range?.from) return "Any dates";
    const from = format(range.from, "MMM d");
    if (!range.to || range.to.getTime() === range.from.getTime()) {
      return `${from}, ${format(range.from, "yyyy")}`;
    }
    return `${from} – ${format(range.to, "MMM d, yyyy")}`;
  }, [range]);

  const handleSubmit = async () => {
    setGeoError(null);
    setIsSearching(true);
    try {
      let location: GeoLocation | null = null;
      const q = locationQuery.trim();
      if (q) {
        location = await geocodeLocation(q);
        if (!location) {
          setGeoError(
            `We couldn't find "${q}". Try a city, region, or country.`,
          );
          setIsSearching(false);
          return;
        }
      }
      const start = range?.from ?? APP_TODAY;
      const end = range?.to ?? start;
      onSearch({
        location,
        radius,
        radiusUnit,
        genres,
        moods,
        startDate: toISODate(start),
        endDate: toISODate(end),
      });
    } catch {
      setGeoError("Location lookup failed. Check your connection and retry.");
      setIsSearching(false);
    }
  };

  return (
    <div className="w-full h-full overflow-y-auto flex flex-col items-center justify-center p-6 relative">
      {/* Mood reactive backdrop */}
      <motion.div
        className="fixed inset-0 opacity-20 pointer-events-none transition-colors duration-1000"
        style={{
          background: `radial-gradient(circle at 50% 50%, hsl(${activeMoodHue}) 0%, transparent 60%)`,
        }}
        animate={{ scale: [1, 1.05, 1], opacity: [0.15, 0.25, 0.15] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="z-10 max-w-2xl w-full flex flex-col items-center text-center gap-8 py-10">
        <div className="space-y-4">
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight">
            Live<span className="text-primary">Pulse</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-md mx-auto">
            Pick your next festival by feeling, not scrolling. Choose a vibe and
            let the pulse find your matches.
          </p>
        </div>

        <div className="w-full space-y-8 bg-card/40 backdrop-blur-xl border border-white/5 p-6 rounded-3xl shadow-2xl">
          {/* Location & When */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Location free-text + radius */}
            <div className="space-y-3 text-left">
              <label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Where
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input
                  data-testid="input-location"
                  value={locationQuery}
                  onChange={(e) => {
                    setLocationQuery(e.target.value);
                    if (geoError) setGeoError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !isSearching) handleSubmit();
                  }}
                  placeholder='Anywhere — try "Verona, Italy"'
                  className="pl-9 h-11 bg-white/5 border-white/10 rounded-xl"
                />
              </div>
              <div className="flex items-center gap-2">
                <Input
                  data-testid="input-radius"
                  type="number"
                  min={1}
                  value={radius}
                  onChange={(e) =>
                    setRadius(Math.max(1, Number(e.target.value) || 0))
                  }
                  className="h-9 w-20 bg-white/5 border-white/10 rounded-lg"
                />
                <div className="flex rounded-lg overflow-hidden border border-white/10">
                  {(["mi", "km"] as RadiusUnit[]).map((u) => (
                    <button
                      key={u}
                      data-testid={`radius-unit-${u}`}
                      onClick={() => setRadiusUnit(u)}
                      className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                        radiusUnit === u
                          ? "bg-primary text-primary-foreground"
                          : "bg-white/5 text-muted-foreground hover:bg-white/10"
                      }`}
                    >
                      {u}
                    </button>
                  ))}
                </div>
                <span className="text-xs text-muted-foreground">radius</span>
              </div>
              {geoError && (
                <p
                  data-testid="text-geo-error"
                  className="text-xs text-destructive font-medium"
                >
                  {geoError}
                </p>
              )}
            </div>

            {/* When — calendar */}
            <div className="space-y-3 text-left">
              <label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                When
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    data-testid="button-date-range"
                    className="w-full h-11 px-3 flex items-center gap-2 rounded-xl bg-white/5 border border-white/10 text-sm hover:bg-white/10 transition-colors"
                  >
                    <CalendarDays className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="truncate">{dateLabel}</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-auto p-0"
                  align="start"
                  data-testid="popover-calendar"
                >
                  <Calendar
                    mode="range"
                    selected={range}
                    onSelect={setRange}
                    defaultMonth={range?.from ?? APP_TODAY}
                    numberOfMonths={1}
                    disabled={{ before: APP_TODAY }}
                  />
                </PopoverContent>
              </Popover>
              <p className="text-xs text-muted-foreground">
                Defaults from today. Pick a start and end day.
              </p>
            </div>
          </div>

          {/* Genre — multi-select */}
          <div className="space-y-3 text-left">
            <label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex justify-between">
              <span>Genres</span>
              <button
                data-testid="filter-genre-any"
                onClick={() => setGenres([])}
                className={`text-xs ${
                  genres.length === 0
                    ? "text-primary"
                    : "text-muted-foreground hover:text-white"
                }`}
              >
                Any
              </button>
            </label>
            <div className="flex flex-wrap gap-2">
              {GENRES.map((g) => {
                const active = genres.includes(g.key);
                return (
                  <button
                    key={g.key}
                    data-testid={`filter-genre-${g.key}`}
                    aria-pressed={active}
                    onClick={() => toggleGenre(g.key)}
                    style={
                      active
                        ? {
                            backgroundColor: `hsl(${g.hue})`,
                            color: "#fff",
                            boxShadow: `0 0 15px hsl(${g.hue} / 0.4)`,
                          }
                        : {}
                    }
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
                      !active &&
                      "bg-white/5 text-muted-foreground hover:bg-white/10"
                    }`}
                  >
                    {g.emoji} {g.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Mood — radial "cake" multi-select */}
          <div className="space-y-3 text-left">
            <label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex justify-between">
              <span>Mood</span>
              <button
                data-testid="filter-mood-any"
                onClick={() => setMoods([])}
                className={`text-xs ${
                  moods.length === 0
                    ? "text-primary"
                    : "text-muted-foreground hover:text-white"
                }`}
              >
                Any
              </button>
            </label>
            <p className="text-xs text-muted-foreground -mt-1">
              Tap slices to mix multiple moods.
            </p>
            <MoodCake selected={moods} onToggle={toggleMood} />
          </div>
        </div>

        <Button
          data-testid="button-find-experiences"
          onClick={handleSubmit}
          disabled={isSearching}
          size="lg"
          className="text-lg px-8 py-6 rounded-full font-bold shadow-[0_0_30px_rgba(255,69,0,0.4)] hover:shadow-[0_0_45px_rgba(255,69,0,0.6)] transition-all hover:scale-105 disabled:opacity-70 disabled:hover:scale-100"
        >
          {isSearching ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Locating…
            </>
          ) : (
            "Find Live Experiences"
          )}
        </Button>
      </div>
    </div>
  );
}
