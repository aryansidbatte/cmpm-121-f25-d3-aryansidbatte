# World of Bits

World of Bits is a small Leaflet-based, 2048-inspired geospatial toy created for the CMPM 121 class. It demonstrates deterministic viewport-driven spawning, simple pick/place/merge mechanics, and lightweight persistence.

## Where to look

- `src/main.ts` — main app logic: map setup, spawning, gameplay, persistence, and controls.
- `src/style.css` — styles, layout, and responsive rules.
- `_luck.ts` — deterministic pseudo-random helper.
- `_leafletWorkaround.ts` — fixes for Leaflet image assets.

## Gameplay / Controls

- Controls are under the map in the centered control panel (`#simControls`).
  - Step slider (`#stepSize`) maps 1..10 to movement increments 0.0001..0.001 degrees.
  - NSEW buttons move the player.
  - Teleport inputs (`#teleLat`, `#teleLon`) and `Teleport` button.
- Hand HUD: held token shown at the left of controls (`#handTile`), points shown at the right (`#points`).
- Use device geolocation: toggle `Use device geolocation` to poll every 5 seconds and auto-move the player (browser permission required).

## Scoring & Persistence

- Points are awarded when two identical tiles merge; the points added equal the merged tile value (like 2048).
- Persisted keys in `localStorage`:
  - Cells: `wob_cellstore_v1`
  - Points: `wob_points_v1`
- Use the **Reset game** button (under the movement controls) to clear persisted cells and points.

## Design Notes

- Viewport-driven deterministic seeding: caches spawn deterministically from cell coordinates using `luck()` so the world is repeatable.
- In-memory flyweight store (`cellStore`) preserves session changes while panning.
- The current implementation persists to `localStorage`; if you prefer session-only behavior, remove or gate the localStorage writes.

## Files of interest

- `src/main.ts`
- `src/style.css`
- `PLAN.md`
