import { motion } from "framer-motion";
import { formatEventDate } from "@/lib/dates";
import { matchStrength } from "@/services/matching";
import { getImageForId } from "@/lib/images";
import type { MatchResult, SearchFilters } from "@/services/types";
import { MapPin, Calendar, Star, Sparkles, Music } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface EventCardProps {
  result: MatchResult;
  filters: SearchFilters;
  isSelected: boolean;
  onClick: () => void;
}

export default function EventCard({ result, filters, isSelected, onClick }: EventCardProps) {
  const { event, isExactMatch, score } = result;
  const { matched, total } = matchStrength(result, filters);
  const image = getImageForId(event.id);

  const headliners = event.performers.filter((p) => p.isHeadliner).map((p) => p.name);
  const artistNames = (headliners.length ? headliners : event.performers.map((p) => p.name));
  const artistLabel =
    artistNames.length > 2
      ? `${artistNames.slice(0, 2).join(", ")} +${artistNames.length - 2} more`
      : artistNames.join(", ");

  return (
    <div 
      data-testid={`card-result-${event.id}`}
      onClick={onClick}
      className={`group relative overflow-hidden rounded-2xl border transition-all duration-300 cursor-pointer flex flex-col ${
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
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 opacity-70"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/20 to-purple-900/20" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
        
        <div className="absolute top-3 left-3 flex gap-2">
          {!isExactMatch && total > 0 && (
            <Badge variant="secondary" className="bg-black/60 backdrop-blur-md border-white/10 text-white font-medium">
              Partial ({matched}/{total})
            </Badge>
          )}
          {isExactMatch && total > 0 && (
            <Badge variant="default" className="bg-primary/90 text-primary-foreground backdrop-blur-md shadow-[0_0_10px_rgba(255,69,0,0.5)] border-none">
              <Sparkles className="w-3 h-3 mr-1" /> Perfect Match
            </Badge>
          )}
        </div>
        
        <div className="absolute bottom-3 right-3 text-xs font-bold px-2 py-1 rounded bg-black/60 backdrop-blur-md border border-white/10 flex items-center text-primary">
          <Star className="w-3 h-3 mr-1 fill-primary" /> {score}
        </div>
      </div>

      <div className="p-4 flex flex-col gap-2">
        <h3 className="text-xl font-bold leading-tight group-hover:text-primary transition-colors">{event.name}</h3>

        {artistLabel && (
          <div className="flex items-center gap-1.5 text-sm font-medium text-white/80">
            <Music className="w-3.5 h-3.5 text-primary shrink-0" />
            <span className="truncate">{artistLabel}</span>
          </div>
        )}

        <div className="flex items-center text-sm text-muted-foreground gap-4">
          <div className="flex items-center gap-1">
            <Calendar className="w-4 h-4" />
            <span>{formatEventDate(event.startDate, event.endDate)}</span>
          </div>
          <div className="flex items-center gap-1">
            <MapPin className="w-4 h-4" />
            <span>{event.location.city}, {event.location.country}</span>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap gap-1">
          {result.reasons.map((r, i) => (
            <span key={i} className="text-xs px-2 py-1 rounded bg-white/5 text-white/70 border border-white/5">
              {r.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
