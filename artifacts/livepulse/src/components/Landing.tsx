import { useState, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import type { DateRange as DayPickerRange } from "react-day-picker";
import type {
  SearchFilters,
  GenreKey,
  MoodKey,
  RadiusUnit,
  GeoLocation,
} from "@/services/types";
import {
  GENRES,
  MOODS,
  MOOD_GROUPS,
  moodGroupGradient,
  moodsRadialGradient,
  type MoodGroupDef,
} from "@/lib/taxonomy";
import { fetchPlaces } from "@/services/places";
import { APP_TODAY, fromISODate, toISODate } from "@/lib/dates";
import { defaultFilters } from "@/lib/filters";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Slider } from "@/components/ui/slider";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Loader2, MapPin, CalendarDays, Check, RotateCcw } from "lucide-react";

interface LandingProps {
  filters: SearchFilters;
  onSearch: (filters: SearchFilters) => void;
}

const RADIUS_MIN = 50;
const RADIUS_MAX = 500;
const RADIUS_STEP = 10;
const SUGGEST_DEBOUNCE_MS = 300;

function clampRadius(value: number): number {
  return Math.min(RADIUS_MAX, Math.max(RADIUS_MIN, value));
}

// ----- Mood groups: four color-blended cards; each selects a whole family ----

function MoodGroupCards({
  selected,
  onToggleGroup,
}: {
  selected: MoodKey[];
  onToggleGroup: (group: MoodGroupDef) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {MOOD_GROUPS.map((group) => {
        const selectedCount = group.moods.filter((m) =>
          selected.includes(m),
        ).length;
        const active = selectedCount === group.moods.length;
        const partial = selectedCount > 0 && !active;
        const moodLabels = group.moods
          .map((m) => MOODS.find((d) => d.key === m)?.label ?? m)
          .join(" · ");

        return (
          <button
            key={group.key}
            type="button"
            data-testid={`filter-mood-group-${group.key}`}
            aria-pressed={active}
            onClick={() => onToggleGroup(group)}
            style={{
              backgroundImage: moodGroupGradient(
                group.moods,
                active ? 1 : partial ? 0.45 : 0.22,
              ),
              boxShadow: active
                ? "0 0 28px -4px rgba(255,255,255,0.25)"
                : undefined,
            }}
            className={`group relative flex flex-col items-start gap-1 p-4 rounded-2xl text-left overflow-hidden transition-all duration-300 ring-1 ${
              active
                ? "ring-white/70 text-white"
                : "ring-white/10 text-white/85 hover:ring-white/30"
            }`}
          >
            <div className="flex items-center gap-2 w-full">
              <span className="text-xl leading-none shrink-0">
                {group.emoji}
              </span>
              <span className="text-sm font-bold uppercase tracking-wider">
                {group.label}
              </span>
              {active && (
                <Check className="w-4 h-4 ml-auto shrink-0 drop-shadow" />
              )}
            </div>
            <span className="text-[11px] leading-snug text-white/75">
              {moodLabels}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ----- Landing ---------------------------------------------------------------

export default function Landing({
  filters: initialFilters,
  onSearch,
}: LandingProps) {
  const [locationQuery, setLocationQuery] = useState(
    initialFilters.location?.label ?? "",
  );
  const [selectedPlace, setSelectedPlace] = useState<GeoLocation | null>(
    initialFilters.location,
  );
  const [suggestions, setSuggestions] = useState<GeoLocation[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const [radius, setRadius] = useState(clampRadius(initialFilters.radius));
  const [radiusUnit, setRadiusUnit] = useState<RadiusUnit>(
    initialFilters.radiusUnit,
  );
  const [genres, setGenres] = useState<GenreKey[]>(initialFilters.genres);
  const [moods, setMoods] = useState<MoodKey[]>(initialFilters.moods);
  const [showAllGenres, setShowAllGenres] = useState(false);

  // Curated "popular" genres show up-front; the rest sit behind "More". A
  // selected genre always stays visible so the choice is never hidden.
  const visibleGenres = useMemo(
    () =>
      showAllGenres
        ? GENRES
        : GENRES.filter((g) => g.popular || genres.includes(g.key)),
    [showAllGenres, genres],
  );
  const hiddenGenreCount = GENRES.length - visibleGenres.length;
  const [range, setRange] = useState<DayPickerRange | undefined>({
    from: fromISODate(initialFilters.startDate),
    to: fromISODate(initialFilters.endDate),
  });
  const [fromOpen, setFromOpen] = useState(false);
  const [toOpen, setToOpen] = useState(false);
  const [whenWidth, setWhenWidth] = useState<number>();
  const [geoError, setGeoError] = useState<string | null>(null);

  const [cycleIndex, setCycleIndex] = useState(0);

  const locationBoxRef = useRef<HTMLDivElement>(null);
  const whenRef = useRef<HTMLDivElement>(null);

  // Keep each From/To calendar dropdown as wide as the whole When column.
  useEffect(() => {
    const el = whenRef.current;
    if (!el) return;
    const update = () => setWhenWidth(el.offsetWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Debounced place autocomplete. Each keystroke (re)starts a 300ms timer and an
  // AbortController so superseded requests are cancelled and never overwrite a
  // fresher result. We skip fetching when the text already matches the selected
  // place (i.e. right after a selection) so the dropdown doesn't reopen.
  useEffect(() => {
    const q = locationQuery.trim();
    if (selectedPlace && locationQuery === selectedPlace.label) return;
    if (q.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      setLoadingSuggestions(false);
      return;
    }

    const controller = new AbortController();
    setLoadingSuggestions(true);
    const timer = setTimeout(async () => {
      try {
        const results = await fetchPlaces(q, controller.signal);
        setSuggestions(results);
        setShowSuggestions(true);
        setActiveIndex(-1);
      } catch {
        if (!controller.signal.aborted) {
          setSuggestions([]);
          setShowSuggestions(true);
        }
      } finally {
        if (!controller.signal.aborted) setLoadingSuggestions(false);
      }
    }, SUGGEST_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [locationQuery, selectedPlace]);

  // Close the dropdown on outside click.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (
        locationBoxRef.current &&
        !locationBoxRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // When no mood is chosen, the hero backdrop autonomously cycles through the
  // mood themes. Selecting moods blends their colors into the backdrop instead.
  useEffect(() => {
    if (moods.length > 0) return;
    const id = setInterval(() => {
      setCycleIndex((i) => (i + 1) % MOODS.length);
    }, 3500);
    return () => clearInterval(id);
  }, [moods]);

  // The backdrop blends every selected mood's color into a saturated wash; with
  // nothing selected it gently cycles through the mood palette.
  const backdrop = useMemo(() => {
    if (moods.length > 0) return moodsRadialGradient(moods);
    return moodsRadialGradient([MOODS[cycleIndex].key]);
  }, [moods, cycleIndex]);

  const toggleGenre = (g: GenreKey) =>
    setGenres((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g],
    );

  // A mood card selects/deselects its whole family at once.
  const toggleMoodGroup = (group: MoodGroupDef) =>
    setMoods((prev) => {
      const allSelected = group.moods.every((m) => prev.includes(m));
      if (allSelected) {
        return prev.filter((m) => !group.moods.includes(m));
      }
      const next = new Set(prev);
      group.moods.forEach((m) => next.add(m));
      return Array.from(next);
    });

  const fromLabel = range?.from
    ? format(range.from, "MMM d, yyyy")
    : "Pick a date";
  const toLabel = range?.to ? format(range.to, "MMM d, yyyy") : "Pick a date";

  const selectPlace = (place: GeoLocation) => {
    setSelectedPlace(place);
    setLocationQuery(place.label);
    setSuggestions([]);
    setShowSuggestions(false);
    setActiveIndex(-1);
    setGeoError(null);
  };

  const handleLocationChange = (value: string) => {
    setLocationQuery(value);
    // Editing the text invalidates any previously verified selection.
    if (selectedPlace) setSelectedPlace(null);
    if (geoError) setGeoError(null);
  };

  const handleLocationKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (showSuggestions && suggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % suggestions.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
        return;
      }
      if (e.key === "Enter" && activeIndex >= 0) {
        e.preventDefault();
        selectPlace(suggestions[activeIndex]);
        return;
      }
      if (e.key === "Escape") {
        setShowSuggestions(false);
        return;
      }
    }
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Resets every filter on the form back to the shared app defaults.
  const handleReset = () => {
    const d = defaultFilters();
    setSelectedPlace(d.location);
    setLocationQuery(d.location?.label ?? "");
    setSuggestions([]);
    setShowSuggestions(false);
    setActiveIndex(-1);
    setRadius(clampRadius(d.radius));
    setRadiusUnit(d.radiusUnit);
    setGenres(d.genres);
    setMoods(d.moods);
    setShowAllGenres(false);
    setRange({ from: fromISODate(d.startDate), to: fromISODate(d.endDate) });
    setFromOpen(false);
    setToOpen(false);
    setGeoError(null);
  };

  const handleSubmit = () => {
    if (!selectedPlace) {
      setGeoError("Select a place from the list to search.");
      setShowSuggestions(suggestions.length > 0);
      return;
    }
    setGeoError(null);
    const start = range?.from ?? APP_TODAY;
    const end = range?.to ?? start;
    onSearch({
      location: selectedPlace,
      radius,
      radiusUnit,
      genres,
      moods,
      startDate: toISODate(start),
      endDate: toISODate(end),
    });
  };

  return (
    <div className="w-full h-full overflow-y-auto relative">
      {/* Mood reactive backdrop. The wrapper breathes (scale + opacity) while an
          inner crossfade layer smoothly fades between gradient colors — CSS
          can't transition gradient backgrounds, so we fade stacked layers. */}
      <motion.div
        className="fixed inset-0 pointer-events-none blur-2xl"
        animate={{ scale: [1, 1.08, 1], opacity: [0.45, 0.7, 0.45] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      >
        <AnimatePresence>
          <motion.div
            key={backdrop}
            className="absolute inset-0"
            style={{ background: backdrop }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2, ease: "easeInOut" }}
          />
        </AnimatePresence>
      </motion.div>

      <div className="relative min-h-full flex flex-col items-center justify-center p-6">
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
            {/* Location autocomplete + radius */}
            <div className="space-y-3 text-left">
              <label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Where
              </label>
              <div className="space-y-1.5">
              <span className="text-xs text-muted-foreground">Location</span>
              <div className="relative" ref={locationBoxRef}>
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none z-10" />
                <Input
                  data-testid="input-location"
                  value={locationQuery}
                  onChange={(e) => handleLocationChange(e.target.value)}
                  onFocus={() => {
                    if (suggestions.length > 0 && !selectedPlace) {
                      setShowSuggestions(true);
                    }
                  }}
                  onKeyDown={handleLocationKeyDown}
                  placeholder="try with Bologna ..."
                  autoComplete="off"
                  className="pl-9 pr-9 h-11 bg-white/5 border-white/10 rounded-xl"
                />
                {selectedPlace ? (
                  <Check
                    data-testid="icon-location-verified"
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400"
                  />
                ) : loadingSuggestions ? (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
                ) : null}

                {/* Dark autocomplete dropdown */}
                {showSuggestions && !selectedPlace && (
                  <div
                    data-testid="location-suggestions"
                    className="absolute z-50 mt-2 w-full rounded-xl border border-white/10 bg-neutral-900/95 backdrop-blur-xl shadow-2xl overflow-hidden"
                  >
                    {suggestions.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-muted-foreground">
                        {loadingSuggestions
                          ? "Searching…"
                          : "No places found."}
                      </div>
                    ) : (
                      suggestions.map((place, i) => (
                        <button
                          key={`${place.latitude},${place.longitude}`}
                          data-testid={`place-suggestion-${i}`}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            selectPlace(place);
                          }}
                          onMouseEnter={() => setActiveIndex(i)}
                          className={`w-full flex items-start gap-2 px-4 py-2.5 text-left text-sm transition-colors ${
                            activeIndex === i
                              ? "bg-primary/20 text-white"
                              : "text-white/80 hover:bg-white/5"
                          }`}
                        >
                          <MapPin className="w-3.5 h-3.5 mt-0.5 text-primary shrink-0" />
                          <span className="truncate">{place.label}</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
              </div>

              {/* Radius slider + unit toggle */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Radius</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold tabular-nums">
                      {radius} {radiusUnit}
                    </span>
                    <div className="flex rounded-lg overflow-hidden border border-white/10">
                      {(["mi", "km"] as RadiusUnit[]).map((u) => (
                        <button
                          key={u}
                          data-testid={`radius-unit-${u}`}
                          type="button"
                          onClick={() => setRadiusUnit(u)}
                          className={`px-2.5 py-1 text-xs font-medium transition-colors ${
                            radiusUnit === u
                              ? "bg-primary text-primary-foreground"
                              : "bg-white/5 text-muted-foreground hover:bg-white/10"
                          }`}
                        >
                          {u}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <Slider
                  data-testid="input-radius"
                  value={[radius]}
                  min={RADIUS_MIN}
                  max={RADIUS_MAX}
                  step={RADIUS_STEP}
                  onValueChange={(v) => setRadius(v[0])}
                />
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
            <div ref={whenRef} className="space-y-3 text-left">
              <label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                When
              </label>
              <div className="grid grid-cols-2 gap-2">
                {/* From */}
                <div className="space-y-1.5">
                  <span className="text-xs text-muted-foreground">From</span>
                  <Popover open={fromOpen} onOpenChange={setFromOpen}>
                    <PopoverTrigger asChild>
                      <button
                        data-testid="button-date-from"
                        className="w-full h-11 px-3 flex items-center gap-2 rounded-xl bg-white/5 border border-white/10 text-sm hover:bg-white/10 transition-colors"
                      >
                        <CalendarDays className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span className="truncate">{fromLabel}</span>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="p-0 overflow-hidden"
                      align="start"
                      style={whenWidth ? { width: whenWidth } : undefined}
                      data-testid="popover-date-from"
                    >
                      <Calendar
                        className="w-full"
                        mode="single"
                        selected={range?.from}
                        onSelect={(day) => {
                          if (!day) return;
                          setRange((prev) => {
                            const to =
                              prev?.to && prev.to.getTime() < day.getTime()
                                ? day
                                : prev?.to;
                            return { from: day, to };
                          });
                          setFromOpen(false);
                        }}
                        defaultMonth={range?.from ?? APP_TODAY}
                        numberOfMonths={1}
                        disabled={{ before: APP_TODAY }}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                {/* To */}
                <div className="space-y-1.5">
                  <span className="text-xs text-muted-foreground">To</span>
                  <Popover open={toOpen} onOpenChange={setToOpen}>
                    <PopoverTrigger asChild>
                      <button
                        data-testid="button-date-to"
                        className="w-full h-11 px-3 flex items-center gap-2 rounded-xl bg-white/5 border border-white/10 text-sm hover:bg-white/10 transition-colors"
                      >
                        <CalendarDays className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span className="truncate">{toLabel}</span>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="p-0 overflow-hidden"
                      align="end"
                      style={whenWidth ? { width: whenWidth } : undefined}
                      data-testid="popover-date-to"
                    >
                      <Calendar
                        className="w-full"
                        mode="single"
                        selected={range?.to}
                        onSelect={(day) => {
                          if (!day) return;
                          setRange((prev) => ({ from: prev?.from, to: day }));
                          setToOpen(false);
                        }}
                        defaultMonth={range?.to ?? range?.from ?? APP_TODAY}
                        numberOfMonths={1}
                        disabled={{ before: range?.from ?? APP_TODAY }}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                From defaults to today, To to 15 days later. Change either date.
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
                className={`text-xs rounded-full px-2.5 py-0.5 transition-colors ${
                  genres.length === 0
                    ? "bg-primary/15 text-primary ring-1 ring-primary/40"
                    : "text-muted-foreground hover:text-white"
                }`}
              >
                Any
              </button>
            </label>
            <div className="flex flex-wrap gap-2">
              {visibleGenres.map((g) => {
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
              {(hiddenGenreCount > 0 || showAllGenres) && (
                <button
                  data-testid="filter-genre-toggle"
                  onClick={() => setShowAllGenres((v) => !v)}
                  className="px-4 py-2 rounded-full text-sm font-medium bg-white/5 text-muted-foreground hover:bg-white/10 transition-all duration-300"
                >
                  {showAllGenres ? "Less ▴" : `More +${hiddenGenreCount} ▾`}
                </button>
              )}
            </div>
          </div>

          {/* Mood — four color-blended family cards */}
          <div className="space-y-3 text-left">
            <label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex justify-between">
              <span>Mood</span>
              <button
                data-testid="filter-mood-any"
                onClick={() => setMoods([])}
                className={`text-xs rounded-full px-2.5 py-0.5 transition-colors ${
                  moods.length === 0
                    ? "bg-primary/15 text-primary ring-1 ring-primary/40"
                    : "text-muted-foreground hover:text-white"
                }`}
              >
                Any
              </button>
            </label>
            <p className="text-xs text-muted-foreground -mt-1">
              Pick a vibe — each card selects a whole family of moods.
            </p>
            <MoodGroupCards selected={moods} onToggleGroup={toggleMoodGroup} />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <Button
            data-testid="button-find-experiences"
            onClick={handleSubmit}
            size="lg"
            className="text-lg px-8 py-6 rounded-full font-bold shadow-[0_0_30px_rgba(255,69,0,0.4)] hover:shadow-[0_0_45px_rgba(255,69,0,0.6)] transition-all hover:scale-105"
          >
            Find Live Experiences
          </Button>
          <Button
            data-testid="button-reset-filters"
            onClick={handleReset}
            variant="ghost"
            size="lg"
            className="rounded-full text-muted-foreground hover:text-white hover:bg-white/5"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset filters
          </Button>
        </div>
      </div>
      </div>
    </div>
  );
}
