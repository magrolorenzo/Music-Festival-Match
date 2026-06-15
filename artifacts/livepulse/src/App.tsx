import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { runSearch, type SearchResponse } from "@/services/search";
import type { SearchFilters } from "@/services/types";
import { defaultDateRange } from "@/lib/dates";
import Landing from "@/components/Landing";
import Loading from "@/components/Loading";
import Results from "@/components/Results";

export default function App() {
  const [appState, setAppState] = useState<"landing" | "loading" | "results">("landing");
  const [filters, setFilters] = useState<SearchFilters>(() => {
    const { startDate, endDate } = defaultDateRange();
    return {
      location: null,
      radius: 100,
      radiusUnit: "mi",
      genres: [],
      moods: [],
      startDate,
      endDate,
    };
  });
  const [searchResponse, setSearchResponse] = useState<SearchResponse | null>(null);

  const handleSearch = async (newFilters: SearchFilters) => {
    setFilters(newFilters);
    setAppState("loading");
    try {
      const response = await runSearch(newFilters);
      setSearchResponse(response);
      setAppState("results");
    } catch (e) {
      console.error(e);
      // fallback
      setAppState("landing");
    }
  };

  const handleReset = () => {
    setAppState("landing");
    setSearchResponse(null);
  };

  return (
    <div className="min-h-[100dvh] w-full bg-background text-foreground overflow-hidden relative selection:bg-primary/30">
      <AnimatePresence mode="wait">
        {appState === "landing" && (
          <motion.div
            key="landing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0 z-10"
          >
            <Landing filters={filters} onSearch={handleSearch} />
          </motion.div>
        )}
        {appState === "loading" && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 z-20"
          >
            <Loading filters={filters} />
          </motion.div>
        )}
        {appState === "results" && searchResponse && (
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0 z-30"
          >
            <Results response={searchResponse} onReset={handleReset} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
