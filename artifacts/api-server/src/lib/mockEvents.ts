import { readFileSync } from "node:fs";
import path from "node:path";
import type { LiveEvent } from "@workspace/api-zod";
import { logger } from "./logger";

// ============================================================================
// Mock dataset loader for the offline fallback path.
//
// The bundled JSON already matches the LiveEvent contract, so the fallback just
// applies the same geo + date filtering the live pipeline would and returns it
// with a `source: "mock"` flag so the UI can show a notice.
// ============================================================================

const EARTH_RADIUS_KM = 6371;

function workspaceRoot(): string {
  return process.cwd().endsWith(path.join("artifacts", "api-server"))
    ? path.resolve(process.cwd(), "../..")
    : process.cwd();
}

let cache: LiveEvent[] | null = null;

function loadAll(): LiveEvent[] {
  if (cache) return cache;
  try {
    const file = path.resolve(
      workspaceRoot(),
      "artifacts/api-server/data/festivals_mock.json",
    );
    const parsed = JSON.parse(readFileSync(file, "utf-8")) as {
      events?: LiveEvent[];
    };
    cache = Array.isArray(parsed.events) ? parsed.events : [];
  } catch (err) {
    logger.error({ err }, "failed to load mock festivals dataset");
    cache = [];
  }
  return cache;
}

function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export interface MockQuery {
  latitude: number;
  longitude: number;
  radiusKm: number;
  startDate: string;
  endDate: string;
}

export function mockEvents(query: MockQuery): LiveEvent[] {
  const all = loadAll();
  const from = new Date(query.startDate).getTime();
  const to = new Date(query.endDate).getTime();

  return all.filter((event) => {
    const inRadius =
      haversineKm(
        query.latitude,
        query.longitude,
        event.location.latitude,
        event.location.longitude,
      ) <= query.radiusKm;
    const ts = new Date(event.startDate).getTime();
    const inWindow = ts >= from && ts <= to;
    return inRadius && inWindow;
  });
}
