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
