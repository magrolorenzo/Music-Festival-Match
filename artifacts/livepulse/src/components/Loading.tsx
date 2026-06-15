import { motion } from "framer-motion";
import type { SearchFilters, MoodKey, GenreKey } from "@/services/types";
import { moodHue, moodEmoji, genreEmoji, GENRE_BY_KEY, MOOD_BY_KEY } from "@/lib/taxonomy";

export default function Loading({ filters }: { filters: SearchFilters }) {
  const mKey: MoodKey = filters.moods[0] ?? "energetic";
  const gKey: GenreKey | null = filters.genres[0] ?? null;
  const hue = moodHue(mKey);
  const mEmoji = moodEmoji(mKey);
  const gEmoji = gKey ? genreEmoji(gKey) : "✨";
  
  const moodDef = MOOD_BY_KEY[mKey];

  return (
    <div className="w-full h-full flex flex-col items-center justify-center relative overflow-hidden bg-background">
      <motion.div 
        className="absolute inset-0 opacity-30"
        style={{
          background: `radial-gradient(circle at 50% 50%, hsl(${hue}) 0%, transparent 50%)`
        }}
        animate={{ 
          scale: [1, 1.2, 1],
          opacity: [0.2, 0.4, 0.2]
        }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
      />
      
      <div className="z-10 flex flex-col items-center gap-6">
        <div className="flex gap-4 text-6xl">
          <motion.div
            animate={{ y: [0, -20, 0], rotate: [0, 10, -10, 0] }}
            transition={{ duration: 1, repeat: Infinity }}
          >
            {gEmoji}
          </motion.div>
          <motion.div
            animate={{ y: [0, -20, 0], rotate: [0, -10, 10, 0] }}
            transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
          >
            {mEmoji}
          </motion.div>
        </div>
        
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold tracking-wide">Pulsing the network...</h2>
          <p className="text-muted-foreground">
            Seeking {moodDef ? moodDef.vibe : "unforgettable nights"} 
            {filters.location ? ` near ${filters.location.query}` : ""}...
          </p>
        </div>
      </div>
    </div>
  );
}
