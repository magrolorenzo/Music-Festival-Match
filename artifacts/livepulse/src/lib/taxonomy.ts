// ============================================================================
// Filter taxonomy — the single source of truth for the four sidebar filters.
//
// Each genre and mood carries an emoji and an accent hue so the UI can apply
// dynamic, mood-driven color cues on top of the Musixmatch (orange/white/black)
// base palette. The design layer decides exactly how to use these.
// ============================================================================

import type { GenreKey, MoodKey } from "@/services/types";

export interface GenreDef {
  key: GenreKey;
  label: string;
  emoji: string;
  /** HSL components "H S% L%" for an accent tied to this genre. */
  hue: string;
  /** Curated "popular" subset shown up-front; the rest sit behind "More". */
  popular?: boolean;
}

export interface MoodDef {
  key: MoodKey;
  label: string;
  emoji: string;
  /** HSL components "H S% L%" for the dynamic mood hue. */
  hue: string;
  /** A short evocative descriptor used in justification copy. */
  vibe: string;
}

export const GENRES: GenreDef[] = [
  { key: "rock", label: "Rock", emoji: "🎸", hue: "8 85% 58%", popular: true },
  { key: "pop", label: "Pop", emoji: "🎤", hue: "330 85% 62%", popular: true },
  { key: "hip-hop-rap", label: "Hip-Hop / Rap", emoji: "🎙️", hue: "45 95% 55%", popular: true },
  { key: "edm", label: "EDM", emoji: "🎧", hue: "190 90% 55%", popular: true },
  { key: "indie", label: "Indie", emoji: "🎶", hue: "260 60% 62%", popular: true },
  { key: "latin", label: "Latin", emoji: "💃", hue: "12 90% 58%", popular: true },
  { key: "metal", label: "Metal", emoji: "🤘", hue: "0 0% 45%", popular: true },
  { key: "country-music", label: "Country", emoji: "🤠", hue: "30 75% 55%", popular: true },
  { key: "blues", label: "Blues", emoji: "🎺", hue: "210 70% 55%" },
  { key: "classical", label: "Classical", emoji: "🎻", hue: "45 30% 65%" },
  { key: "folk", label: "Folk", emoji: "🪕", hue: "100 45% 50%" },
  { key: "jazz", label: "Jazz", emoji: "🎷", hue: "275 60% 62%" },
  { key: "kpop", label: "K-Pop", emoji: "✨", hue: "330 90% 65%" },
  { key: "punk", label: "Punk", emoji: "🧷", hue: "350 85% 55%" },
  {
    key: "rhythm-and-blues-soul",
    label: "R&B / Soul",
    emoji: "🎶",
    hue: "300 55% 58%",
  },
  { key: "reggae", label: "Reggae", emoji: "🌴", hue: "140 65% 45%" },
];

export const MOODS: MoodDef[] = [
  {
    key: "love",
    label: "Love",
    emoji: "❤️",
    hue: "350 80% 62%",
    vibe: "warm, all-consuming devotion",
  },
  {
    key: "heartbreak",
    label: "Heartbreak",
    emoji: "💔",
    hue: "322 70% 58%",
    vibe: "tender, heart-on-sleeve catharsis",
  },
  {
    key: "joy",
    label: "Joy",
    emoji: "😊",
    hue: "45 95% 60%",
    vibe: "bright, sunlit elation",
  },
  {
    key: "empowerment",
    label: "Empowerment",
    emoji: "💪",
    hue: "16 90% 55%",
    vibe: "chest-out, unstoppable confidence",
  },
  {
    key: "angst",
    label: "Angst",
    emoji: "😤",
    hue: "258 60% 55%",
    vibe: "restless, brooding tension",
  },
  {
    key: "reflection",
    label: "Reflection",
    emoji: "🤔",
    hue: "210 40% 60%",
    vibe: "quiet, introspective stillness",
  },
  {
    key: "inspiration",
    label: "Inspiration",
    emoji: "🌟",
    hue: "48 95% 58%",
    vibe: "soaring, lifted-up wonder",
  },
  {
    key: "nostalgia",
    label: "Nostalgia",
    emoji: "📼",
    hue: "30 55% 60%",
    vibe: "warm, golden-hour memory",
  },
  {
    key: "despair",
    label: "Despair",
    emoji: "🌧️",
    hue: "220 30% 50%",
    vibe: "heavy, aching sorrow",
  },
  {
    key: "celebration",
    label: "Celebration",
    emoji: "🎉",
    hue: "320 90% 62%",
    vibe: "confetti-bright triumph",
  },
  {
    key: "anger",
    label: "Anger",
    emoji: "🔥",
    hue: "5 90% 52%",
    vibe: "white-hot, fists-up fury",
  },
  {
    key: "peace",
    label: "Peace",
    emoji: "☮️",
    hue: "160 50% 52%",
    vibe: "easy, spacious calm",
  },
  {
    key: "solitude",
    label: "Solitude",
    emoji: "🌙",
    hue: "240 35% 55%",
    vibe: "still, solitary introspection",
  },
  {
    key: "adventure",
    label: "Adventure",
    emoji: "🧭",
    hue: "175 70% 48%",
    vibe: "wide-open, horizon-chasing thrill",
  },
  {
    key: "social-commentary",
    label: "Social Commentary",
    emoji: "📢",
    hue: "20 70% 52%",
    vibe: "sharp, eyes-open protest",
  },
  {
    key: "hope",
    label: "Hope",
    emoji: "🌅",
    hue: "55 85% 60%",
    vibe: "first-light optimism",
  },
  {
    key: "spirituality",
    label: "Spirituality",
    emoji: "🕊️",
    hue: "265 45% 65%",
    vibe: "transcendent, searching awe",
  },
  {
    key: "freedom",
    label: "Freedom",
    emoji: "🦅",
    hue: "200 75% 55%",
    vibe: "untethered, open-road release",
  },
  {
    key: "party",
    label: "Party",
    emoji: "🎊",
    hue: "24 95% 55%",
    vibe: "high-voltage, hands-in-the-air energy",
  },
  {
    key: "nature",
    label: "Nature",
    emoji: "🌿",
    hue: "120 50% 48%",
    vibe: "grounded, open-air serenity",
  },
];

// ----- Lookup helpers --------------------------------------------------------

export const GENRE_BY_KEY: Record<GenreKey, GenreDef> = Object.fromEntries(
  GENRES.map((g) => [g.key, g]),
) as Record<GenreKey, GenreDef>;

export const MOOD_BY_KEY: Record<MoodKey, MoodDef> = Object.fromEntries(
  MOODS.map((m) => [m.key, m]),
) as Record<MoodKey, MoodDef>;

export function genreLabel(key: GenreKey): string {
  return GENRE_BY_KEY[key]?.label ?? key;
}

export function moodLabel(key: MoodKey): string {
  return MOOD_BY_KEY[key]?.label ?? key;
}

export function genreEmoji(key: GenreKey): string {
  return GENRE_BY_KEY[key]?.emoji ?? "";
}

export function moodEmoji(key: MoodKey): string {
  return MOOD_BY_KEY[key]?.emoji ?? "";
}

/** HSL accent hue for a mood, e.g. for dynamic theming. */
export function moodHue(key: MoodKey): string {
  return MOOD_BY_KEY[key]?.hue ?? "24 95% 55%";
}
