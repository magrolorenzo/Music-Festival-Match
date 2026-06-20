import { formatEventDate } from "@/lib/dates";
import { initialsFor, placeholderGradient } from "@/lib/images";
import {
  genreLabel,
  genreEmoji,
  moodLabel,
  moodEmoji,
} from "@/lib/taxonomy";
import { matchedFirst, MATCH_BADGE, PLAIN_BADGE } from "@/lib/match-style";
import type { MatchResult, MoodKey, GenreKey } from "@/services/types";
import { MapPin, Calendar, Sparkles, Music } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface EventCardProps {
  result: MatchResult;
  isSelected: boolean;
  onClick: () => void;
  onHoverStart: () => void;
  onHoverEnd: () => void;
}

export default function EventCard({
  result,
  isSelected,
  onClick,
  onHoverStart,
  onHoverEnd,
}: EventCardProps) {
  const { event } = result;
  const image = event.image;

  const headliners = event.performers.filter((p) => p.isHeadliner).map((p) => p.name);
  const artistNames = headliners.length ? headliners : event.performers.map((p) => p.name);
  const artistLabel =
    artistNames.length > 2
      ? `${artistNames.slice(0, 2).join(", ")} and more`
      : artistNames.join(", ");

  const isFestival = event.kind === "festival";
  const kindEmoji = isFestival ? "🎪" : "🎤";
  const kindLabel = isFestival ? "Festival" : "Concert";

  const locationLabel = [event.location.name, event.location.city]
    .filter(Boolean)
    .join(" - ");

  return (
    <div
      data-testid={`card-result-${event.id}`}
      onClick={onClick}
      onMouseEnter={onHoverStart}
      onMouseLeave={onHoverEnd}
      className={`group relative w-full min-w-0 overflow-hidden rounded-2xl border transition-all duration-300 cursor-pointer flex flex-col ${
        isSelected
          ? "border-primary bg-primary/10 shadow-[0_0_20px_rgba(255,69,0,0.15)]"
          : "border-white/5 bg-card/40 hover:bg-card/60 hover:border-white/20"
      }`}
    >
      <div className="flex h-28 relative overflow-hidden bg-muted">
        {image ? (
          <img
            src={image}
            alt={event.name}
            className="w-full h-full object-cover object-top transition-transform duration-700 group-hover:scale-110 opacity-70"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center text-3xl font-extrabold text-white/80 tracking-wide"
            style={{ background: placeholderGradient(event.id) }}
          >
            {initialsFor(event.name)}
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />

        <div className="absolute top-3 left-3 flex gap-2">
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  data-testid={`kind-${event.id}`}
                  className="w-8 h-8 rounded-full bg-black/60 backdrop-blur-md border border-white/15 flex items-center justify-center text-base cursor-help"
                  aria-label={kindLabel}
                >
                  <span aria-hidden="true">{kindEmoji}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="right">{kindLabel}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {result.matchedMoodKeys.length > 0 && (
          <div className="absolute top-3 right-3">
            <Badge
              variant="default"
              className="bg-primary/90 text-primary-foreground backdrop-blur-md shadow-[0_0_10px_rgba(255,69,0,0.5)] border-none"
            >
              <Sparkles className="w-3 h-3 mr-1" /> Perfect Match
            </Badge>
          </div>
        )}
      </div>

      <div className="p-4 flex flex-col gap-2">
        <h3 className="text-xl font-bold leading-tight break-words group-hover:text-primary transition-colors">{event.name}</h3>

        {artistLabel && (
          <div className="flex items-center gap-1.5 text-sm font-medium text-white/80">
            <Music className="w-3.5 h-3.5 text-primary shrink-0" />
            <span className="truncate">{artistLabel}</span>
          </div>
        )}

        <div className="flex flex-col text-sm text-muted-foreground gap-1">
          <div className="flex items-center gap-1">
            <Calendar className="w-4 h-4" />
            <span>{formatEventDate(event.startDate, event.endDate)}</span>
          </div>
          <div className="flex items-center gap-1 min-w-0">
            <MapPin className="w-4 h-4 shrink-0" />
            <span className="truncate">{locationLabel}</span>
          </div>
        </div>

        {(event.genreKeys.length > 0 || event.moodKeys.length > 0) && (
          <div className="mt-2 flex flex-wrap gap-1">
            {matchedFirst(event.genreKeys, result.matchedGenreKeys).map((key) => {
              const isGenreMatch = result.matchedGenreKeys.includes(key as GenreKey);
              return (
                <span
                  key={`g-${key}`}
                  className={`text-xs px-2 py-1 rounded border ${
                    isGenreMatch ? MATCH_BADGE : PLAIN_BADGE
                  }`}
                >
                  {genreEmoji(key)} {genreLabel(key)}
                </span>
              );
            })}
          </div>
        )}

        {(event.genreKeys.length > 0 && event.moodKeys.length > 0) && (
          <div className="w-full h-px bg-white/5 my-1" />
        )}

        {event.moodKeys.length > 0 && (
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Moods
            </span>
            <div className="flex flex-wrap gap-1">
            {matchedFirst(event.moodKeys, result.matchedMoodKeys).map((key) => {
              const isMoodMatch = result.matchedMoodKeys.includes(key as MoodKey);
              return (
                <span
                  key={`m-${key}`}
                  className={`text-xs px-2 py-1 rounded border ${
                    isMoodMatch ? MATCH_BADGE : PLAIN_BADGE
                  }`}
                >
                  {moodEmoji(key)} {moodLabel(key)}
                </span>
              );
            })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
