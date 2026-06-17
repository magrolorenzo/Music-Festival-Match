import { motion } from "framer-motion";
import { formatEventDate } from "@/lib/dates";
import { initialsFor, placeholderGradient } from "@/lib/images";
import { pickArtistQuote } from "@/services/api";
import type { MatchResult, SearchFilters, Performer, MoodKey } from "@/services/types";
import { MapPin, Calendar, X, ExternalLink, Music, Quote, Disc3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

interface DetailPopupProps {
  result: MatchResult;
  filters: SearchFilters;
  onClose: () => void;
}

function moodLabel(key: MoodKey): string {
  return key
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function PerformerCard({
  performer,
  preferredMood,
}: {
  performer: Performer;
  preferredMood?: MoodKey;
}) {
  const image = performer.image;
  const quote = pickArtistQuote(performer, preferredMood);
  const moods = performer.cyanite.moodKeys;

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

      {/* Artist image */}
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

        {/* Mood badges */}
        {moods.length > 0 && (
          <div className="flex-1 flex flex-col justify-center gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Vibes
            </p>
            <div className="flex flex-wrap gap-2">
              {moods.map((mood) => (
                <Badge
                  key={mood}
                  variant="outline"
                  className="text-xs border-white/15 text-white/70 bg-white/5"
                >
                  {moodLabel(mood)}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Quote box */}
      {quote && (
        <div className="relative bg-gradient-to-br from-primary/10 to-transparent p-6 rounded-xl border border-primary/20">
          <Quote className="absolute top-4 left-4 w-8 h-8 text-primary/20" />
          <p className="text-xl font-serif italic leading-relaxed pl-6 text-white/90">
            "{quote.quote}"
          </p>
          <div className="pl-6 mt-4 flex items-center gap-2 text-sm text-primary font-medium">
            <Music className="w-4 h-4" /> {quote.trackName}
          </div>
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
                  <p className="font-medium text-sm truncate">{track.trackName}</p>
                  {track.albumName && (
                    <p className="text-xs text-muted-foreground truncate">
                      {track.albumName}
                    </p>
                  )}
                </div>
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
        className="w-full max-w-4xl max-h-full bg-[#0f0f0f] border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col pointer-events-auto relative z-10"
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

        <div className="flex-1 min-h-0 overflow-y-auto livepulse-scroll">
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
              <div className="flex flex-wrap gap-2">
                {reasons.map((r, i) => (
                  <Badge
                    key={i}
                    variant="outline"
                    className="bg-primary/20 text-primary border-primary/30 text-sm font-semibold py-1 px-3"
                  >
                    {r.label}
                  </Badge>
                ))}
              </div>
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
                  preferredMood={filters.moods[0]}
                />
              ) : (
                <Carousel opts={{ align: "center" }} className="w-full h-full">
                  <CarouselContent className="h-full">
                    {displayPerformers.map((performer) => (
                      <CarouselItem
                        key={performer.id}
                        className="basis-[90%] md:basis-[50%] h-full flex"
                      >
                        <PerformerCard
                          performer={performer}
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

            <div className="flex justify-center pt-8 border-t border-white/5">
              <Button
                size="lg"
                className="rounded-full px-8 bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-[0_0_20px_rgba(255,69,0,0.3)]"
              >
                Get Tickets <ExternalLink className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
