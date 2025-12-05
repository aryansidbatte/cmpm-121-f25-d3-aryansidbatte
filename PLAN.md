# D3: World of Bits

Game title: World of Bits

## Game Design Vision

World of Bits is a location-based crafting game combining ideas from 2048 and Pokemon Go. Players move around the globe, collect tokens from nearby map cells, and combine identical tokens to double their value following 2048-style merge rules. The objective is to craft a single token of a target high value (for example, 2048) while exploring real-world locations.

## Technologies

- TypeScript via `src/` files
- Deno + Vite for building and dev server
- Leaflet for map UI
- CSS in `style.css`

## Assignments

### D3.a: Core mechanics (token collection and crafting)

Key technical challenge: assemble a Leaflet-based map UI.
Key gameplay challenge: allow collecting and crafting tokens from nearby map cells.

### Steps

- [x] copy `main.ts` to `reference.ts` for future reference
- [x] delete everything in `main.ts`
- [x] put a basic leaflet map on the screen
- [x] draw the player's location on the map
- [x] draw a rectangle representing one cell on the map
- [x] use loops to draw a whole grid of cells on the map
- [x] implement token spawn rules for a cell (1 or 0 tokens)
- [ ] implement picking up a nearby token into the player's hand (max 1)
- [ ] implement 2048-style merge rules (merge identical tokens to double value; enforce one-merge-per-action semantics)
- [ ] add UI for player's hand and inventory feedback

**D3.a Implementation notes:** The repository already contains a working Leaflet map (`map` + tile layer), a `playerMarker` placed at the classroom coordinates, grid rectangles spawned by `spawnCache` over an i/j neighborhood, deterministic spawn logic using `luck()` and `CACHE_SPAWN_PROBABILITY`, and a per-cell popup with a `poke` button that updates `playerPoints` (see `src/main.ts`).

### D3.b: Globe-spanning gameplay

Key technical challenge: support seamless gameplay anywhere on Earth.

### Steps

- [ ] design cell coordinate scheme (lat/lon grid) and rendering bounds
- [ ] implement cell seeding rules that work across the globe
- [ ] optimize rendering for many cells (tile the grid lazily)
- [ ] playtest moving to different locations to gather resources

### D3.c: Object persistence

Key technical challenge: remember cell state when off-screen and when users pan/zoom the map.

### Steps

- [ ] create an in-memory store for cell states (memento/flyweight ideas)
- [ ] persist cell state to local cache when unloaded from view
- [ ] add logic to prevent farming tokens by toggling view
- [ ] write tests or manual play scenarios that reproduce the farm bug and verify fix

### D3.d: Gameplay across real-world space and time

Key technical challenge: remember game state across browser sessions; use device geolocation for player movement.

### Steps

- [ ] serialize and save player and cell state to `localStorage` or IndexedDB
- [ ] restore state on load and reconnect map overlays to stored cells
- [ ] integrate browser geolocation to move player position in real time
- [ ] provide a simulated movement mode for testing without physically moving
- [ ] run multi-session tests combining real and simulated movement

## Short-term next actions

- Create `PLAN.md` (this file) — done
- Commit `PLAN.md` with message `Add initial PLAN.md`
- Implement D3.a items in `src/main.ts` and `src/_leafletWorkaround.ts`

## Notes for collaborators

- Keep `PLAN.md` updated frequently — one small change per commit is ideal.
- When you change the plan, update the todos in the project management view as well.
