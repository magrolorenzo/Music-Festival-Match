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
  { key: "rock", label: "Rock", emoji: "🎸", hue: "8 85% 58%" },
  { key: "pop", label: "Pop", emoji: "🎤", hue: "330 85% 62%" },
  { key: "electronic", label: "Electronic", emoji: "🎧", hue: "190 90% 55%" },
  { key: "hip-hop", label: "Hip-Hop", emoji: "🎙️", hue: "45 95% 55%" },
  { key: "jazz", label: "Jazz", emoji: "🎷", hue: "275 60% 62%" },
];

export const MOODS: MoodDef[] = [
  {
    key: "energetic",
    label: "Energetic",
    emoji: "⚡",
    hue: "24 95% 55%",
    vibe: "high-voltage, hands-in-the-air energy",
  },
  {
    key: "chill",
    label: "Chill",
    emoji: "🌊",
    hue: "182 75% 50%",
    vibe: "easy, spacious and laid-back",
  },
  {
    key: "emotional",
    label: "Emotional",
    emoji: "💜",
    hue: "322 80% 60%",
    vibe: "tender, heart-on-sleeve catharsis",
  },
  {
    key: "dark",
    label: "Dark",
    emoji: "🌑",
    hue: "258 65% 58%",
    vibe: "brooding, hypnotic after-dark intensity",
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
