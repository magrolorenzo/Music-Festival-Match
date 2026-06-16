import type { GenreKey, MoodKey } from "@workspace/api-zod";

// ============================================================================
// Server-side taxonomy mapping.
//
// Partner APIs return free-form genre strings and lyric mood/emotion labels.
// We normalize those onto the 16 genre keys and 20 mood keys the LivePulse
// matching engine understands. Anything unrecognized is simply dropped, never
// guessed, so the filters stay trustworthy.
//
// Order matters only for readability — every matching rule contributes its key,
// so a string can map to several keys (e.g. "soul-funk" -> R&B/Soul).
// ============================================================================

const GENRE_RULES: Array<{ key: GenreKey; patterns: string[] }> = [
  {
    key: "kpop",
    patterns: ["k-pop", "kpop", "k pop"],
  },
  {
    key: "pop",
    patterns: ["pop", "boy band", "girl group", "top 40", "dance-pop", "synth-pop"],
  },
  {
    key: "rock",
    patterns: ["rock", "grunge", "garage rock", "psychedelic", "classic rock"],
  },
  {
    key: "indie",
    patterns: ["indie", "alternative", "alt-rock", "shoegaze", "lo-fi"],
  },
  {
    key: "metal",
    patterns: [
      "metal",
      "metalcore",
      "thrash",
      "death metal",
      "doom",
      "hardcore",
    ],
  },
  {
    key: "punk",
    patterns: ["punk", "emo", "post-punk"],
  },
  {
    key: "edm",
    patterns: [
      "electronic",
      "electronica",
      "edm",
      "house",
      "techno",
      "trance",
      "dubstep",
      "drum and bass",
      "drum & bass",
      "dnb",
      "dance",
      "dj",
      "synth",
      "ambient",
      "garage",
    ],
  },
  {
    key: "hip-hop-rap",
    patterns: ["hip hop", "hip-hop", "hiphop", "rap", "trap", "grime", "drill"],
  },
  {
    key: "rhythm-and-blues-soul",
    patterns: ["r&b", "rnb", "rhythm and blues", "soul", "funk", "motown", "neo-soul"],
  },
  {
    key: "blues",
    patterns: ["blues", "delta blues"],
  },
  {
    key: "jazz",
    patterns: ["jazz", "swing", "bossa", "fusion", "big band", "bebop"],
  },
  {
    key: "classical",
    patterns: ["classical", "orchestra", "orchestral", "opera", "symphony", "baroque"],
  },
  {
    key: "country-music",
    patterns: ["country", "americana", "bluegrass", "honky-tonk"],
  },
  {
    key: "folk",
    patterns: ["folk", "singer-songwriter", "acoustic"],
  },
  {
    key: "latin",
    patterns: [
      "latin",
      "reggaeton",
      "salsa",
      "bachata",
      "cumbia",
      "tango",
      "mariachi",
    ],
  },
  {
    key: "reggae",
    patterns: ["reggae", "ska", "dancehall", "dub"],
  },
];

const MOOD_RULES: Array<{ key: MoodKey; patterns: string[] }> = [
  { key: "love", patterns: ["love", "romance", "romantic", "affection"] },
  {
    key: "heartbreak",
    patterns: ["heartbreak", "heartbroken", "breakup", "broken heart"],
  },
  { key: "joy", patterns: ["joy", "joyful", "happy", "happiness", "cheerful"] },
  {
    key: "empowerment",
    patterns: ["empowerment", "empowering", "empowered", "confidence", "confident"],
  },
  {
    key: "angst",
    patterns: ["angst", "anxiety", "anxious", "restless", "tension"],
  },
  {
    key: "reflection",
    patterns: ["reflection", "reflective", "introspective", "contemplative", "thoughtful"],
  },
  {
    key: "inspiration",
    patterns: ["inspiration", "inspiring", "inspirational", "uplifting", "motivational"],
  },
  { key: "nostalgia", patterns: ["nostalgia", "nostalgic", "wistful"] },
  {
    key: "despair",
    patterns: ["despair", "sad", "sadness", "sorrow", "melancholy", "melancholic", "grief", "depressing"],
  },
  {
    key: "celebration",
    patterns: ["celebration", "celebrate", "celebratory", "triumphant", "victory"],
  },
  {
    key: "anger",
    patterns: ["anger", "angry", "rage", "aggressive", "furious"],
  },
  {
    key: "peace",
    patterns: ["peace", "peaceful", "calm", "serene", "relaxed", "relaxing", "chill", "mellow"],
  },
  {
    key: "solitude",
    patterns: ["solitude", "lonely", "loneliness", "alone", "isolation"],
  },
  {
    key: "adventure",
    patterns: ["adventure", "adventurous", "wanderlust", "journey"],
  },
  {
    key: "social-commentary",
    patterns: ["social commentary", "social-commentary", "protest", "political", "activism"],
  },
  {
    key: "hope",
    patterns: ["hope", "hopeful", "optimistic", "optimism"],
  },
  {
    key: "spirituality",
    patterns: ["spirituality", "spiritual", "faith", "worship", "sacred", "gospel"],
  },
  {
    key: "freedom",
    patterns: ["freedom", "free", "liberation", "liberating", "independence"],
  },
  {
    key: "party",
    patterns: ["party", "energetic", "energy", "upbeat", "excited", "fun", "feel good"],
  },
  {
    key: "nature",
    patterns: ["nature", "natural", "earth", "outdoors", "wilderness"],
  },
];

function normalize(value: string): string {
  return value.toLowerCase().trim();
}

/** Maps a list of raw genre strings to unique normalized genre keys. */
export function mapGenres(raw: string[]): GenreKey[] {
  const out = new Set<GenreKey>();
  for (const item of raw) {
    const text = normalize(item);
    for (const rule of GENRE_RULES) {
      if (rule.patterns.some((p) => text.includes(p))) {
        out.add(rule.key);
      }
    }
  }
  return [...out];
}

/** Maps a list of raw mood/emotion labels to unique normalized mood keys. */
export function mapMoods(raw: string[]): MoodKey[] {
  const out = new Set<MoodKey>();
  for (const item of raw) {
    const text = normalize(item);
    for (const rule of MOOD_RULES) {
      if (rule.patterns.some((p) => text.includes(p))) {
        out.add(rule.key);
      }
    }
  }
  return [...out];
}

/** Stable lookup key for caching an artist's enrichment by name. */
export function artistKeyOf(name: string): string {
  return name.toLowerCase().replace(/\s+/g, " ").trim();
}
