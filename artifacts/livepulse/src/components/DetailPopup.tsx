import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { formatEventDate } from "@/lib/dates";
import { initialsFor, placeholderGradient } from "@/lib/images";
import { pickArtistQuotes, splitQuote } from "@/services/api";
import spotifyLogo from "../assets/spotify-logo.png";
import type {
  MatchResult,
  SearchFilters,
  Performer,
  MoodKey,
  GenreKey,
} from "@/services/types";
import {
  moodLabel,
  moodEmoji,
  genreLabel,
  genreEmoji,
} from "@/lib/taxonomy";
import { matchedFirst, MATCH_BADGE, PLAIN_BADGE } from "@/lib/match-style";
import {
  MapPin,
  Calendar,
  X,
  ExternalLink,
  Music,
  Quote,
  Disc3,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import type { CarouselApi } from "@/components/ui/carousel";

interface DetailPopupProps {
  result: MatchResult;
  filters: SearchFilters;
  onClose: () => void;
}

function PerformerCard({
  performer,
  selectedMoods,
  selectedGenres,
  preferredMood,
}: {
  performer: Performer;
  selectedMoods: MoodKey[];
  selectedGenres: GenreKey[];
  preferredMood?: MoodKey;
}) {
  const image = performer.image;
  const quotes = pickArtistQuotes(performer, preferredMood);
  const moods = matchedFirst(performer.cyanite.moodKeys, selectedMoods);
  const genres = matchedFirst(performer.cyanite.genreKeys, selectedGenres);

  return (
    <div className="w-full flex flex-col gap-6 bg-white/5 rounded-2xl p-6 border border-white/10 h-full relative">
      {/* Artist name */}
      <h4 className="text-3xl font-bold pr-20">{performer.name}</h4>
      {/* Headliner badge */}
      {performer.isHeadliner && (
        <Badge className="absolute top-6 right-6 bg-primary/20 text-primary hover:bg-primary/30 border-none z-10">
          Headliner
        </Badge>
      )}
      {/* Artist image + genre + mood badges */}
      <div className="flex flex-col md:flex-row gap-6">
        <div className="w-32 h-32 md:w-40 md:h-40 shrink-0 rounded-xl overflow-hidden bg-muted relative">
          {image ? (
            <img
              src={image}
              alt={performer.name}
              className="w-full h-full object-cover object-top"
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center text-3xl font-bold text-white/80"
              style={{ background: placeholderGradient(performer.id) }}
            >
              {initialsFor(performer.name)}
            </div>
          )}
        </div>

        <div className="flex-1 flex flex-col gap-3 justify-center">
          {/* Genre badges */}
          {genres.length > 0 && (
            <div className="flex flex-col gap-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Genres
              </p>
              <div className="flex flex-wrap gap-2">
                {genres.map((genre) => {
                  const isMatch = selectedGenres.includes(genre);
                  return (
                    <span
                      key={genre}
                      className={`text-xs px-2 py-1 rounded border ${
                        isMatch ? MATCH_BADGE : PLAIN_BADGE
                      }`}
                    >
                      {genreEmoji(genre)} {genreLabel(genre)}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Mood badges — same style as EventCard, with match highlighting */}
          {moods.length > 0 && (
            <div className="flex flex-col gap-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Moods
              </p>
              <div className="flex flex-wrap gap-2">
                {moods.map((mood) => {
                  const isMatch = selectedMoods.includes(mood);
                  return (
                    <span
                      key={mood}
                      className={`text-xs px-2 py-1 rounded border ${
                        isMatch ? MATCH_BADGE : PLAIN_BADGE
                      }`}
                    >
                      {moodEmoji(mood)} {moodLabel(mood)}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
      {/* Quote box — 2 quotes in 2 columns, or placeholder */}
      {quotes.length > 0 ? (
        <div className="relative bg-gradient-to-br from-primary/10 to-transparent p-6 rounded-xl border border-primary/20 pl-[24px] pr-[24px] pt-[12px] pb-[12px]">
          <Quote className="absolute top-4 left-4 w-8 h-8 text-primary/20" />
          <div className="pl-6 flex flex-col gap-[1px]">
            {quotes.map((q, i) => (
              <p
                key={i}
                className="text-base md:text-xl font-serif italic leading-relaxed text-white/90"
              >
                "{q.quote}"
              </p>
            ))}
          </div>
          <div className="pl-6 mt-4 flex items-center gap-2 text-sm text-primary font-medium">
            <Music className="w-4 h-4" /> {quotes[0].trackName}
          </div>
        </div>
      ) : (
        <div className="relative bg-gradient-to-br from-primary/10 to-transparent p-6 rounded-xl border border-primary/20 min-h-[120px] flex items-center justify-center">
          <Quote className="absolute top-4 left-4 w-8 h-8 text-primary/20" />
          <p className="text-sm text-white/40 italic">
            No lyrics available for this artist
          </p>
        </div>
      )}
      {/* Top tracks list */}
      {performer.tracks.length > 0 && (
        <div className="space-y-3">
          <h5 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Top Tracks
          </h5>
          <div className="flex flex-col gap-2">
            {performer.tracks.map((track, i) => (
              <div
                key={track.trackId}
                className="flex items-center gap-3 p-3 rounded-lg bg-black/30 border border-white/5"
              >
                <span className="text-muted-foreground text-sm w-4 shrink-0">
                  {i + 1}
                </span>
                <Disc3 className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">
                    {track.trackName}
                  </p>
                  {track.albumName && (
                    <p className="text-xs text-muted-foreground truncate">
                      {track.albumName}
                    </p>
                  )}
                </div>
                {track.spotifyId && (
                  <a
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary font-medium"
                    href={`https://open.spotify.com/track/${track.spotifyId}`}
                  >
                    <img src={spotifyLogo} alt="Spotify" className="w-5 h-5" />
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function DetailPopup({
  result,
  filters,
  onClose,
}: DetailPopupProps) {
  const { event, reasons, matchingPerformers } = result;
  const image = event.image;
  const performerIds = new Set(matchingPerformers.map((p) => p.id));
  const otherPerformers = event.performers.filter(
    (p) => !performerIds.has(p.id),
  );
  const displayPerformers = [...matchingPerformers, ...otherPerformers];

  const [api, setApi] = useState<CarouselApi | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (!api) return;
    const handleSelect = () => setActiveIndex(api.selectedScrollSnap());
    api.on("select", handleSelect);
    handleSelect();
    return () => {
      api.off("select", handleSelect);
    };
  }, [api]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-10 pointer-events-none">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto"
        onClick={onClose}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="w-full max-w-4xl max-h-full bg-[#0f0f0f] border border-white/10 rounded-3xl shadow-2xl flex flex-col pointer-events-auto relative z-10"
      >
        <div className="absolute top-4 right-4 z-20">
          <Button
            data-testid="popup-close-button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="rounded-full bg-black/40 hover:bg-black/80 text-white backdrop-blur-md"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto livepulse-scroll rounded-3xl">
          {/* Hero */}
          <div className="h-64 md:h-80 relative overflow-hidden bg-muted">
            {image ? (
              <img
                src={image}
                alt={event.name}
                className="w-full h-full object-cover object-top"
              />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center text-6xl font-extrabold text-white/80"
                style={{ background: placeholderGradient(event.id) }}
              >
                {initialsFor(event.name)}
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[#0f0f0f] via-[#0f0f0f]/60 to-transparent" />

            <div className="absolute bottom-0 left-0 p-6 md:p-10 w-full flex flex-col gap-4">
              <h2 className="text-4xl md:text-6xl font-extrabold tracking-tight text-white">
                {event.name}
              </h2>
              <div className="flex flex-wrap items-center text-white/80 gap-6 font-medium text-lg">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-primary" />
                  <span>{formatEventDate(event.startDate, event.endDate)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-primary" />
                  <span>
                    {event.location.name}, {event.location.city}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 md:p-10 space-y-12">
            {/* Description */}
            <div className="max-w-3xl">
              <p className="text-xl leading-relaxed text-muted-foreground">
                {event.description}
              </p>
            </div>

            {/* Lineup */}
            <div className="space-y-6">
              <h3 className="shrink-0 text-2xl font-bold border-b border-white/10 pb-4">
                The Lineup{" "}
                <span className="text-muted-foreground text-lg ml-2 font-normal">
                  Pulse Matches
                </span>
              </h3>

              {displayPerformers.length === 1 ? (
                <PerformerCard
                  performer={displayPerformers[0]}
                  selectedMoods={filters.moods}
                  selectedGenres={filters.genres}
                  preferredMood={filters.moods[0]}
                />
              ) : (
                <Carousel
                  opts={{ align: "start" }}
                  setApi={setApi}
                  className="w-full h-full"
                >
                  <CarouselContent className="h-full -ml-0 gap-2">
                    {displayPerformers.map((performer, i) => (
                      <CarouselItem
                        key={performer.id}
                        className="basis-[calc(100%-18px)] md:basis-[calc(100%-28px)] flex pl-0 pr-0 cursor-pointer"
                        role="button"
                        tabIndex={0}
                        aria-label={`View ${performer.name}`}
                        onClick={() => api?.scrollTo(i)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            api?.scrollTo(i);
                          }
                        }}
                      >
                        <PerformerCard
                          performer={performer}
                          selectedMoods={filters.moods}
                          selectedGenres={filters.genres}
                          preferredMood={filters.moods[0]}
                        />
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                  <div className="flex items-center justify-center gap-3 mt-10">
                    <CarouselPrevious className="static transform-none h-10 w-10 [&_svg]:size-5 bg-white/5 border-white/10 hover:bg-white/10 text-white" />
                    <CarouselNext className="static transform-none h-10 w-10 [&_svg]:size-5 bg-white/5 border-white/10 hover:bg-white/10 text-white" />
                  </div>
                </Carousel>
              )}
            </div>

            {event.ticketUrl && (
                <div className="flex justify-center pt-8 border-t border-white/5">
                  <Button
                      asChild
                      size="lg"
                      className="rounded-full px-8 bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-[0_0_20px_rgba(255,69,0,0.3)]"
                  >
                    <a
                        href={event.ticketUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                      Get Tickets <ExternalLink className="w-4 h-4 ml-2" />
                    </a>
                  </Button>
                </div>
            )}

          </div>
        </div>
      </motion.div>
    </div>
  );
}
