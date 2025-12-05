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

### Steps a

- [x] copy `main.ts` to `reference.ts` for future reference
- [x] delete everything in `main.ts`
- [x] put a basic leaflet map on the screen
- [x] draw the player's location on the map
- [x] draw a rectangle representing one cell on the map
- [x] use loops to draw a whole grid of cells on the map
- [x] implement token spawn rules for a cell (1 or 0 tokens)
- [x] implement picking up a nearby token into the player's hand (max 1)
- [x] implement 2048-style merge rules (merge identical tokens to double value; enforce one-merge-per-action semantics)
- [x] add UI for player's hand and inventory feedback

**D3.a Implementation notes:** The repository already contains a working Leaflet map (`map` + tile layer), a `playerMarker` placed at the classroom coordinates, grid rectangles spawned by `spawnCache` over an i/j neighborhood, deterministic spawn logic using `luck()` and `CACHE_SPAWN_PROBABILITY`, and a per-cell popup with a `poke` button that updates `playerPoints` (see `src/main.ts`).

### D3.b: Globe-spanning gameplay

Key technical challenge: support seamless gameplay anywhere on Earth.

### Steps b

- [x] design cell coordinate scheme (lat/lon grid) and rendering bounds
- [x] implement cell seeding rules that work across the globe
- [x] optimize rendering for many cells (tile the grid lazily)
- [x] playtest moving to different locations to gather resources

### D3.b Design Notes (Cell coordinate scheme & rendering bounds)

Goal: use a simple, deterministic lat/lon tiling so the same cell coordinates refer to the same region anywhere on Earth, and render only the cells visible (plus a small margin) to keep performance reasonable.

Coordinate scheme

- Cell size: defined by `TILE_DEGREES` (degrees of latitude/longitude per cell). This is an equirectangular grid — adequate for prototype. For production we can consider using Web Mercator tiles.
- Cell indices: pick a fixed origin (`originLat`, `originLon`, e.g. the classroom coordinates). Convert lat->i and lon->j as:
  - i = floor((lat - originLat) / TILE_DEGREES)
  - j = floor((lon - originLon) / TILE_DEGREES)
- Convert back to bounds via i,j -> lat range [originLat + i*TILE_DEGREES, originLat + (i+1)*TILE_DEGREES] and similarly for lon.

Rendering bounds

- Use `map.getBounds()` to compute viewport lat/lon extents.
- Convert viewport extents to i/j index ranges and add padding (e.g., 2 tiles) to avoid pop-in.
- Maintain a `spawnedCells` set keyed by `i,j` so each cell is spawned once; later we will replace this with persistent cell state.

Seeding

- Use `luck()` with a per-cell key (e.g., `${i},${j}`) to deterministically seed tokens.

Acceptance criteria

- Implement `lat/lon <-> i,j` helpers.
- Replace the fixed neighborhood spawn loop with viewport-driven spawning, and keep deterministic seeding.

### D3.c: Object persistence

Key technical challenge: remember cell state when off-screen and when users pan/zoom the map.

### Steps c

- [x] create an in-memory store for cell states
- [x] add a title to the top of the website (World of Bits)
- [x] visual polishing

### D3.d: Gameplay across real-world space and time

Key technical challenge: remember game state across browser sessions; use device geolocation for player movement.

### Steps d

- [ ] serialize and save player and cell state to `localStorage` or IndexedDB
- [ ] restore state on load and reconnect map overlays to stored cells
- [ ] integrate browser geolocation to move player position in real time
- [ ] provide a simulated movement mode for testing without physically moving
- [ ] run multi-session tests combining real and simulated movement
