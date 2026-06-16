import festElectronic from "@/assets/fest_electronic.png";
import festRock from "@/assets/fest_rock.png";
import festJazz from "@/assets/fest_jazz.png";
import artistPop from "@/assets/artist_pop.png";
import artistDj from "@/assets/artist_dj.png";
import artistRock from "@/assets/artist_rock.png";

export const IMAGES: Record<string, string> = {
  "evt-tomorrowland": festElectronic,
  "evt-glastonbury": festRock,
  "evt-montreux-jazz": festJazz,
  "evt-primavera-sound": festElectronic,
  "evt-sonar": festElectronic,
  "evt-rock-am-ring": festRock,
  "evt-lollapalooza": festRock,
  
  "art-helix-bloom": artistDj,
  "art-nocturne-engine": artistDj,
  "art-marisol-wave": artistDj,
  "art-the-paper-kings": artistRock,
  "art-celeste-mara": artistPop,
  "art-brasslight": artistPop,
  "art-eli-toussaint": artistPop,
  "art-nadia-okonkwo": artistPop,
  "art-blue-meridian": artistPop,
  "art-violet-static": artistPop,
  "art-cobalt-room": artistDj,
  "art-the-quiet-riots": artistRock,
  "art-grid-saint": artistDj,
  "art-saffron-code": artistDj,
  "art-pulse-theory": artistDj,
  "art-ashfall": artistRock,
  "art-ironwidow": artistRock,
  "art-redline-choir": artistRock,
  "art-juno-fields": artistPop
};

export function getImageForId(id: string): string | null {
  return IMAGES[id] || null;
}

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
