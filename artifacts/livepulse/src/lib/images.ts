/**
 * Short initials for an image-less placeholder (e.g. "Tomorrowland" -> "TO",
 * "Rock am Ring" -> "RR"). Falls back to "?" for empty names.
 */
export function initialsFor(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/**
 * Deterministic, pleasant two-stop gradient derived from a seed string, so an
 * image-less event/artist still gets a stable, distinctive backdrop (nicer than
 * a flat block, and far nicer than an emoji).
 */
export function placeholderGradient(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  const h1 = Math.abs(hash) % 360;
  const h2 = (h1 + 48) % 360;
  return `linear-gradient(135deg, hsl(${h1} 65% 32%), hsl(${h2} 70% 18%))`;
}
