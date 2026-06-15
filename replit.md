# LivePulse

LivePulse is a dark-themed music festival matchmaker: pick a location, genre, mood, and time period, and it ranks live festival experiences that fit your vibe — shown on an interactive dark map with detailed match justifications, artist stats, and song quotes.

## Run & Operate

- `pnpm --filter @workspace/livepulse run dev` — run the LivePulse web app
- `pnpm --filter @workspace/livepulse exec tsc --noEmit` — typecheck the LivePulse app
- `pnpm --filter @workspace/api-server run dev` — run the (scaffold) API server
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 19 + Vite 7, Tailwind v4, wouter (routing), framer-motion (animation), embla-carousel-react (artist carousel)
- Map: Leaflet + react-leaflet with CartoDB Dark Matter dark tiles and custom glowing div-icon pins
- No backend/DB/auth — the app is frontend-only and serves a bundled mock dataset

## Where things live

- `artifacts/livepulse/src/services/` — the single data seam (`api.ts`, `matching.ts`, `search.ts`, `types.ts`). Shaped around JamBase / Cyanite / Musixmatch schemas so going live only changes the request transport inside each function.
- `artifacts/livepulse/src/data/festivals_mock.json` — the mock festival/artist dataset (source of truth for demo data)
- `artifacts/livepulse/src/lib/` — `taxonomy.ts` (genre/mood/location/period filter config with emoji + hue), `dates.ts` (period→date-range logic, `APP_TODAY`), `images.ts` (image mapping)
- `artifacts/livepulse/src/components/` — UI: `Landing`, `Loading`, `Results`, `EventCard`, `LiveMap`, `DetailPopup`

## Architecture decisions

- Frontend-only by design: a mock data layer mirrors real partner API schemas so a live API swap touches only the transport inside the service functions, not the UI or models.
- Single-page, three-state experience (landing → loading → results) driven by React state in `App.tsx` rather than separate routes.
- "Today" is pinned to **2026-06-15** (`APP_TODAY` in `lib/dates.ts`) so the seeded summer-2026 festivals stay in range. Period ranges are computed from this pinned date.
- The service layer runs a runtime guard (`validateEvents` in `api.ts`) over the imported JSON because TypeScript cannot verify imported JSON shapes — records with unknown genre/mood keys are dropped and logged.
- Built in React rather than the spec's Vue (user's explicit choice). Emojis in UI are intentional (user override).

## Product

- Four-filter landing hero (Location, Genre, Mood, Period) with an animated mood backdrop and a glowing "Find Live Experiences" CTA.
- Animated searching/loading state with mood/genre color and emoji cues.
- Results view: ranked match list on the left, interactive dark Leaflet map with glowing pins (fly-to on selection) on the right.
- Closable detail popup: match-justification pills, Songstats-style stats, recommended songs, a Musixmatch-style song quote (placeholder text), images with placeholders, and an artist carousel for multi-artist festivals.
- Partial matches are flagged distinctly from exact matches.

## User preferences

- Prefers React over Vue.
- Emojis are welcome in the UI.

## Gotchas

- Do not change `APP_TODAY` casually — the mock festivals are seeded for summer 2026 and will fall out of the default period ranges if the pinned date moves.
- The mock dataset's genre/mood keys must stay within the taxonomy in `lib/taxonomy.ts` / `services/types.ts`; invalid keys are silently dropped by `validateEvents` (with a console error).

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
