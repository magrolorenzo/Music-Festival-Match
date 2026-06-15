import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import type { SearchFilters, GenreKey, MoodKey, LocationFilter, PeriodKey } from "@/services/types";
import { GENRES, MOODS, LOCATIONS, PERIODS, moodHue } from "@/lib/taxonomy";
import { Button } from "@/components/ui/button";

interface LandingProps {
  filters: SearchFilters;
  onSearch: (filters: SearchFilters) => void;
}

export default function Landing({ filters: initialFilters, onSearch }: LandingProps) {
  const [filters, setFilters] = useState<SearchFilters>(initialFilters);

  const activeMoodHue = useMemo(() => {
    return filters.mood !== "any" ? moodHue(filters.mood as MoodKey) : "18 100% 55%";
  }, [filters.mood]);

  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-6 relative">
      {/* Mood reactive backdrop */}
      <motion.div 
        className="absolute inset-0 opacity-20 pointer-events-none transition-colors duration-1000"
        style={{
          background: `radial-gradient(circle at 50% 50%, hsl(${activeMoodHue}) 0%, transparent 60%)`
        }}
        animate={{ 
          scale: [1, 1.05, 1],
          opacity: [0.15, 0.25, 0.15]
        }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="z-10 max-w-2xl w-full flex flex-col items-center text-center gap-8">
        <div className="space-y-4">
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight">
            Live<span className="text-primary">Pulse</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-md mx-auto">
            Pick your next festival by feeling, not scrolling. Choose a vibe and let the pulse find your matches.
          </p>
        </div>

        <div className="w-full space-y-8 bg-card/40 backdrop-blur-xl border border-white/5 p-6 rounded-3xl shadow-2xl">
          
          {/* Location & Period */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3 text-left">
              <label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Where</label>
              <div className="flex flex-wrap gap-2">
                {LOCATIONS.map(loc => (
                  <button
                    key={loc.key}
                    data-testid={`filter-location-${loc.key}`}
                    onClick={() => setFilters({ ...filters, location: loc.key })}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
                      filters.location === loc.key 
                        ? 'bg-primary text-primary-foreground shadow-[0_0_15px_rgba(255,69,0,0.3)]' 
                        : 'bg-white/5 text-muted-foreground hover:bg-white/10'
                    }`}
                  >
                    {loc.emoji} {loc.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3 text-left">
              <label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">When</label>
              <div className="flex flex-wrap gap-2">
                {PERIODS.map(p => (
                  <button
                    key={p.key}
                    data-testid={`filter-period-${p.key}`}
                    onClick={() => setFilters({ ...filters, period: p.key })}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
                      filters.period === p.key 
                        ? 'bg-primary text-primary-foreground shadow-[0_0_15px_rgba(255,69,0,0.3)]' 
                        : 'bg-white/5 text-muted-foreground hover:bg-white/10'
                    }`}
                  >
                    {p.emoji} {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Genre */}
          <div className="space-y-3 text-left">
            <label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex justify-between">
              <span>Genre</span>
              <button 
                onClick={() => setFilters({ ...filters, genre: "any" })}
                className={`text-xs ${filters.genre === "any" ? "text-primary" : "text-muted-foreground hover:text-white"}`}
              >
                Any
              </button>
            </label>
            <div className="flex flex-wrap gap-2">
              {GENRES.map(g => (
                <button
                  key={g.key}
                  data-testid={`filter-genre-${g.key}`}
                  onClick={() => setFilters({ ...filters, genre: g.key })}
                  style={filters.genre === g.key ? { backgroundColor: `hsl(${g.hue})`, color: '#fff', boxShadow: `0 0 15px hsl(${g.hue} / 0.4)` } : {}}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
                    filters.genre !== g.key && 'bg-white/5 text-muted-foreground hover:bg-white/10'
                  }`}
                >
                  {g.emoji} {g.label}
                </button>
              ))}
            </div>
          </div>

          {/* Mood */}
          <div className="space-y-3 text-left">
            <label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex justify-between">
              <span>Mood</span>
              <button 
                onClick={() => setFilters({ ...filters, mood: "any" })}
                className={`text-xs ${filters.mood === "any" ? "text-primary" : "text-muted-foreground hover:text-white"}`}
              >
                Any
              </button>
            </label>
            <div className="flex flex-wrap gap-2">
              {MOODS.map(m => (
                <button
                  key={m.key}
                  data-testid={`filter-mood-${m.key}`}
                  onClick={() => setFilters({ ...filters, mood: m.key })}
                  style={filters.mood === m.key ? { backgroundColor: `hsl(${m.hue})`, color: '#fff', boxShadow: `0 0 15px hsl(${m.hue} / 0.4)` } : {}}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
                    filters.mood !== m.key && 'bg-white/5 text-muted-foreground hover:bg-white/10'
                  }`}
                >
                  {m.emoji} {m.label}
                </button>
              ))}
            </div>
          </div>

        </div>

        <Button 
          data-testid="button-find-experiences"
          onClick={() => onSearch(filters)}
          size="lg"
          className="text-lg px-8 py-6 rounded-full font-bold shadow-[0_0_30px_rgba(255,69,0,0.4)] hover:shadow-[0_0_45px_rgba(255,69,0,0.6)] transition-all hover:scale-105"
        >
          Find Live Experiences
        </Button>
      </div>
    </div>
  );
}
