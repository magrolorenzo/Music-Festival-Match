import type { GenreKey, MoodKey } from "@workspace/api-zod";

// ============================================================================
// Server-side taxonomy mapping.
//
// Partner APIs return free-form genre strings and lyric mood/emotion labels.
// We normalize those onto the five genre keys and four mood keys the LivePulse
// matching engine understands. Anything unrecognized is simply dropped, never
// guessed, so the filters stay trustworthy.
// ============================================================================

const GENRE_RULES: Array<{ key: GenreKey; patterns: string[] }> = [
  {
    key: "electronic",
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
    key: "hip-hop",
    patterns: ["hip hop", "hip-hop", "hiphop", "rap", "trap", "grime", "drill"],
  },
  {
    key: "jazz",
    patterns: ["jazz", "blues", "soul", "funk", "swing", "bossa", "fusion"],
  },
  {
    key: "rock",
    patterns: [
      "rock",
      "metal",
      "punk",
      "alternative",
      "indie",
      "grunge",
      "emo",
      "hardcore",
      "garage rock",
    ],
  },
  {
    key: "pop",
    patterns: ["pop", "k-pop", "kpop", "boy band", "girl group", "top 40"],
  },
];

const MOOD_RULES: Array<{ key: MoodKey; patterns: string[] }> = [
  {
    key: "energetic",
    patterns: [
      "energetic",
      "energy",
      "party",
      "upbeat",
      "happy",
      "excited",
      "joy",
      "fun",
      "uplifting",
      "feel good",
    ],
  },
  {
    key: "chill",
    patterns: [
      "chill",
      "calm",
      "relaxed",
      "relaxing",
      "peaceful",
      "mellow",
      "laid back",
      "easy",
      "soft",
      "dreamy",
    ],
  },
  {
    key: "emotional",
    patterns: [
      "emotional",
      "sad",
      "romantic",
      "romance",
      "love",
      "melancholy",
      "melancholic",
      "heartbreak",
      "nostalgic",
      "tender",
      "sentimental",
    ],
  },
  {
    key: "dark",
    patterns: [
      "dark",
      "angry",
      "anger",
      "aggressive",
      "intense",
      "brooding",
      "moody",
      "tension",
      "haunting",
      "sinister",
    ],
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
