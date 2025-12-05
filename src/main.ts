// @deno-types="npm:@types/leaflet"
import leaflet from "leaflet";

// Style sheets
import "leaflet/dist/leaflet.css"; // supporting style for Leaflet
import "./style.css"; // student-controlled page style

// Fix missing marker images
import "./_leafletWorkaround.ts"; // fixes for missing Leaflet images

// Import our luck function
import luck from "./_luck.ts";

// Create basic UI elements

const controlPanelDiv = document.createElement("div");
controlPanelDiv.id = "controlPanel";
document.body.append(controlPanelDiv);

// --- Simulated movement controls (playtesting) ---
const simControlsDiv = document.createElement("div");
simControlsDiv.id = "simControls";
simControlsDiv.innerHTML = `
  <div style="display:flex;gap:0.5rem;align-items:center;">
    <label for="stepSize">Step (deg):</label>
    <input id="stepSize" type="number" value="0.001" step="0.0001" style="width:90px;" />
    <button id="moveN">N</button>
    <button id="moveS">S</button>
    <button id="moveE">E</button>
    <button id="moveW">W</button>
    <label style="margin-left:0.5rem"><input type="checkbox" id="centerOnPlayer" checked /> center map</label>
  </div>
  <div style="margin-top:0.4rem;display:flex;gap:0.5rem;align-items:center;">
    <input id="teleLat" placeholder="lat" style="width:120px;" />
    <input id="teleLon" placeholder="lon" style="width:120px;" />
    <button id="teleportBtn">Teleport</button>
  </div>
`;
controlPanelDiv.append(simControlsDiv);

// Debug controls: clear persisted cells and force spawn for testing
const debugControlsDiv = document.createElement("div");
debugControlsDiv.id = "debugControls";
debugControlsDiv.style.marginTop = "0.4rem";
debugControlsDiv.innerHTML = `
  <button id="clearPersisted">Clear persisted cells</button>
`;
controlPanelDiv.append(debugControlsDiv);

// Page title
const titleDiv = document.createElement("div");
titleDiv.id = "siteTitle";
titleDiv.innerText = "World of Bits";
titleDiv.style.cssText =
  "font-size:1.25rem;font-weight:600;text-align:center;margin:0.5rem 0;";
document.body.append(titleDiv);

// Create falling globe emojis for background effect
function spawnGlobe(xPercent: number, delay = 0) {
  const el = document.createElement("div");
  el.className = "globe-fall";
  el.style.left = `${xPercent}%`;
  el.style.animationDelay = `${delay}s`;
  el.innerText = "🌍";
  document.body.append(el);
  // remove after animation completes to keep DOM tidy
  setTimeout(() => el.remove(), 10000 + delay * 1000);
}

// Periodically spawn globes across the width
setInterval(() => {
  for (let i = 0; i < 6; i++) {
    const x = Math.random() * 100;
    const delay = Math.random() * 4;
    spawnGlobe(x, delay);
  }
}, 2200);

function parseStep(): number {
  const el = document.querySelector<HTMLInputElement>("#stepSize");
  if (!el) return 0.001;
  const v = parseFloat(el.value);
  return Number.isFinite(v) ? v : 0.001;
}

function movePlayerBy(dLat: number, dLon: number) {
  const cur = playerMarker.getLatLng();
  const next = leaflet.latLng(cur.lat + dLat, cur.lng + dLon);
  playerMarker.setLatLng(next);
  const center = document.querySelector<HTMLInputElement>("#centerOnPlayer")!
    .checked;
  if (center) map.panTo(next);
  // Ensure visible cells are updated when player changes location
  updateVisibleCells();
}

function teleportTo(lat: number, lon: number) {
  const next = leaflet.latLng(lat, lon);
  playerMarker.setLatLng(next);
  const center = document.querySelector<HTMLInputElement>("#centerOnPlayer")!
    .checked;
  if (center) map.panTo(next);
  updateVisibleCells();
}

// Wire control buttons
document.addEventListener("click", (ev) => {
  const target = ev.target as HTMLElement | null;
  if (!target) return;
  if (target.id === "moveN") movePlayerBy(parseStep(), 0);
  if (target.id === "moveS") movePlayerBy(-parseStep(), 0);
  if (target.id === "moveE") movePlayerBy(0, parseStep());
  if (target.id === "moveW") movePlayerBy(0, -parseStep());
  if (target.id === "teleportBtn") {
    const latStr =
      (document.querySelector<HTMLInputElement>("#teleLat")!.value || "")
        .trim();
    const lonStr =
      (document.querySelector<HTMLInputElement>("#teleLon")!.value || "")
        .trim();
    const lat = parseFloat(latStr);
    const lon = parseFloat(lonStr);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      alert("Enter valid numeric lat and lon to teleport");
      return;
    }
    teleportTo(lat, lon);
  }
  if (target.id === "clearPersisted") {
    localStorage.removeItem(STORAGE_KEY);
    alert(
      "Cleared persisted cells. Visible cells will reseed on next pan/refresh.",
    );
    // Force a refresh: remove active overlays so updateVisibleCells will re-create them
    activeCells.forEach((rect, key) => {
      try {
        rect.remove();
      } catch (e) {}
    });
    activeCells.clear();
    spawnedCells.clear();
    cellStore.clear();
    updateVisibleCells();
  }
});

// (force-spawn UI removed; spawning is forced by default)

const mapDiv = document.createElement("div");
mapDiv.id = "map";
document.body.append(mapDiv);

const statusPanelDiv = document.createElement("div");
statusPanelDiv.id = "statusPanel";
document.body.append(statusPanelDiv);
// Hide the textual status panel (we'll use the HUD instead)
statusPanelDiv.style.display = "none";

// Hand HUD
const handPanelDiv = document.createElement("div");
handPanelDiv.id = "handPanel";
handPanelDiv.innerHTML = `
  <div class="hand-label">Hand</div>
  <div style="display:flex;gap:1rem;align-items:center;justify-content:center;">
    <div class="hand-tile hand-empty" id="handTile">empty</div>
    <div class="points">
      <div class="points-label">Points</div>
      <div class="points-value" id="points">0</div>
    </div>
  </div>
`;
document.body.append(handPanelDiv);

// Our classroom location
const CLASSROOM_LATLNG = leaflet.latLng(
  36.997936938057016,
  -122.05703507501151,
);

// Tunable gameplay parameters
const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_DEGREES = 1e-4;
const _NEIGHBORHOOD_SIZE = 8;
const CACHE_SPAWN_PROBABILITY = 0.1;

// Map token values to colors for visible caches
const TOKEN_COLORS = new Map<number, string>([
  [2, "#f7d794"],
  [4, "#ffd166"],
  [8, "#ff9f1c"],
  [16, "#ff6b6b"],
  [32, "#ff4d94"],
  [64, "#c77dff"],
  [128, "#7f5af0"],
  [256, "#4cc9f0"],
  [512, "#00b4d8"],
  [1024, "#2ec4b6"],
  [2048, "#2b9348"],
]);

function getColorForToken(value?: number | undefined) {
  if (!value) return "#eeeeee";
  // Try direct match, otherwise fall back by halving until a match or 2
  let v = value;
  while (v > 1 && !TOKEN_COLORS.has(v)) v = Math.floor(v / 2);
  return TOKEN_COLORS.get(v) ?? "#dddddd";
}
// In-memory cell state store (memento/flyweight)
type CellState = { tokenPresent: boolean; tokenValue?: number | undefined };
const cellStore = new Map<string, CellState>();
function cellKey(i: number, j: number) {
  return `${i},${j}`;
}
function getCellState(i: number, j: number): CellState | undefined {
  const key = cellKey(i, j);
  const fromMemory = cellStore.get(key);
  if (fromMemory) return fromMemory;

  // Lazy load from localStorage if available
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as Record<string, CellState> | null;
    if (!parsed) return undefined;
    const stored = parsed[key];
    if (stored) {
      cellStore.set(key, stored);
      return stored;
    }
  } catch (e) {
    // ignore JSON errors and fall back to undefined
  }
  return undefined;
}
function setCellState(i: number, j: number, state: CellState) {
  cellStore.set(cellKey(i, j), state);
}

// Persist a single cell state to localStorage (merge with existing object)
function persistCellState(i: number, j: number, state: CellState) {
  try {
    const key = cellKey(i, j);
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) as Record<string, CellState> : {};
    parsed[key] = state;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
  } catch (e) {
    console.warn("Failed to persist single cell:", e);
  }
}

// Persist entire in-memory cell store to localStorage (used on unload)
function persistAllCellStoreToStorage() {
  try {
    const obj: Record<string, CellState> = {};
    for (const [k, v] of cellStore.entries()) obj[k] = v;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
  } catch (e) {
    console.warn("Failed to persist cell store:", e);
  }
}

// Ensure we persist whatever is currently in memory when the page closes
window.addEventListener("beforeunload", () => persistAllCellStoreToStorage());

// Create the map (element with id "map" is defined in index.html)
const map = leaflet.map(mapDiv, {
  center: CLASSROOM_LATLNG,
  zoom: GAMEPLAY_ZOOM_LEVEL,
  minZoom: GAMEPLAY_ZOOM_LEVEL,
  maxZoom: GAMEPLAY_ZOOM_LEVEL,
  zoomControl: false,
  scrollWheelZoom: false,
});

// Populate the map with a background tile layer
leaflet
  .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  })
  .addTo(map);

// Add a marker to represent the player
const playerMarker = leaflet.marker(CLASSROOM_LATLNG);
playerMarker.bindTooltip("That's you!");
playerMarker.addTo(map);

// Display the player's points
const playerPoints = 0;
// Player hand: can hold at most one token (2048-style tile value)
let playerHand: number | null = null;

// Pickup distance threshold (meters)
const PICKUP_RADIUS_METERS = 50;

function updateStatus() {
  const handTile = document.querySelector<HTMLDivElement>("#handTile");
  if (handTile) {
    if (playerHand === null) {
      handTile.classList.add("hand-empty");
      handTile.innerText = "empty";
    } else {
      handTile.classList.remove("hand-empty");
      handTile.innerText = playerHand.toString();
    }
  }
  const pointsSpan = document.querySelector<HTMLDivElement>("#points");
  if (pointsSpan) pointsSpan.innerText = playerPoints.toString();
}

updateStatus();

// Add caches to the map by cell numbers
function spawnCache(i: number, j: number) {
  // Convert cell numbers into lat/lng bounds
  const origin = CLASSROOM_LATLNG;
  const bounds = leaflet.latLngBounds([
    [origin.lat + i * TILE_DEGREES, origin.lng + j * TILE_DEGREES],
    [origin.lat + (i + 1) * TILE_DEGREES, origin.lng + (j + 1) * TILE_DEGREES],
  ]);

  // Add a rectangle to the map to represent the cache
  const rect = leaflet.rectangle(bounds);
  rect.addTo(map);
  const key = cellKey(i, j);
  activeCells.set(key, rect);

  // Each cache may contain a token. Use cellStore to preserve state while in memory.
  let cellState = getCellState(i, j);
  if (!cellState) {
    const seeded = FORCE_SPAWN ||
      luck([i, j, "initialValue"].toString()) < CACHE_SPAWN_PROBABILITY;
    cellState = seeded
      ? {
        tokenPresent: true,
        tokenValue: Math.pow(
          2,
          Math.floor(luck([i, j, "value"].toString()) * 4) + 1,
        ),
      }
      : { tokenPresent: false };
    setCellState(i, j, cellState);
  }

  // Style the rectangle based on token presence/value and show label
  const initialFill = cellState.tokenPresent
    ? getColorForToken(cellState.tokenValue)
    : "#ffffff";
  const initialOpacity = cellState.tokenPresent ? 0.8 : 0.06;
  try {
    rect.setStyle({
      color: "#333",
      weight: 1,
      fillColor: initialFill,
      fillOpacity: initialOpacity,
    });
  } catch (e) {
    // ignore styling errors
  }

  // Show the token value as a permanent label on the cache
  rect.bindTooltip(cellState.tokenPresent ? String(cellState.tokenValue) : "", {
    permanent: true,
    direction: "center",
    className: "cache-label",
  });

  // Handle interactions with the cache
  rect.bindPopup(() => {
    // The popup offers a description and pickup/place buttons
    const popupDiv = document.createElement("div");
    const tokenText = cellState!.tokenPresent
      ? String(cellState!.tokenValue)
      : "none";
    popupDiv.innerHTML = `
                <div>There is a cache here at "${i},${j}". Token: <span id="token">${tokenText}</span>.</div>
                <button id="pickup">Pick up</button>
                <button id="place">Place</button>`;

    const pickupBtn = popupDiv.querySelector<HTMLButtonElement>("#pickup");
    const placeBtn = popupDiv.querySelector<HTMLButtonElement>("#place");
    const tokenSpan = popupDiv.querySelector<HTMLSpanElement>("#token");

    // Initialize disabled state from cellState
    if (pickupBtn) {
      pickupBtn.disabled = !cellState!.tokenPresent || playerHand !== null;
    }
    if (placeBtn) placeBtn.disabled = playerHand === null;

    // Clicking pickup attempts to put the token into the player's hand
    pickupBtn?.addEventListener("click", () => {
      if (!cellState!.tokenPresent) {
        alert("No token here to pick up.");
        return;
      }
      if (playerHand !== null) {
        alert("You already have a token in hand. You can only hold one.");
        return;
      }

      // Check distance between player and cache center
      const playerLatLng = playerMarker.getLatLng();
      const cellCenter = bounds.getCenter();
      const distance = playerLatLng.distanceTo(cellCenter);
      if (distance > PICKUP_RADIUS_METERS) {
        alert("Too far away to pick up the token. Move closer.");
        return;
      }

      // Pick up the token (update cellState)
      // Use null-coalescing to ensure `playerHand` receives `number | null`
      playerHand = cellState!.tokenValue ?? null;
      cellState!.tokenPresent = false;
      cellState!.tokenValue = undefined;
      setCellState(i, j, cellState!);
      // Persist the cell state so emptiness survives reloads
      persistCellState(i, j, cellState!);
      if (tokenSpan) tokenSpan.innerText = "none";
      // Update visual style and tooltip for emptied cache
      try {
        rect.setStyle({ fillColor: "#ffffff", fillOpacity: 0.06 });
        rect.unbindTooltip();
        rect.bindTooltip("", {
          permanent: true,
          direction: "center",
          className: "cache-label",
        });
      } catch (e) {
        // ignore
      }
      // Update buttons
      if (pickupBtn) pickupBtn.disabled = true;
      if (placeBtn) placeBtn.disabled = false;
      updateStatus();
    });

    // Place button: put the token in hand into this cell (or merge if identical)
    placeBtn?.addEventListener("click", () => {
      if (playerHand === null) {
        alert("You have no token in hand to place.");
        return;
      }

      // Check distance between player and cache center
      const playerLatLng = playerMarker.getLatLng();
      const cellCenter = bounds.getCenter();
      const distance = playerLatLng.distanceTo(cellCenter);
      if (distance > PICKUP_RADIUS_METERS) {
        alert("Too far away to place the token. Move closer.");
        return;
      }

      // If no token present, place directly
      if (!cellState!.tokenPresent) {
        cellState!.tokenPresent = true;
        cellState!.tokenValue = playerHand as number;
        playerHand = null;
        setCellState(i, j, cellState!);
        // Persist the placed token so it survives reloads
        persistCellState(i, j, cellState!);
        if (tokenSpan) tokenSpan.innerText = String(cellState!.tokenValue);
        // Update visual style and tooltip for placed token
        try {
          rect.setStyle({
            fillColor: getColorForToken(cellState!.tokenValue),
            fillOpacity: 0.8,
          });
          rect.unbindTooltip();
          rect.bindTooltip(String(cellState!.tokenValue), {
            permanent: true,
            direction: "center",
            className: "cache-label",
          });
        } catch (e) {}
        // Update buttons
        if (pickupBtn) pickupBtn.disabled = false;
        if (placeBtn) placeBtn.disabled = true;
        updateStatus();
        return;
      }

      // If token present and same value, merge (single-merge-per-action)
      if (cellState!.tokenPresent && cellState!.tokenValue === playerHand) {
        cellState!.tokenValue = (cellState!.tokenValue || 0) * 2;
        playerHand = null;
        setCellState(i, j, cellState!);
        // Persist merged value
        persistCellState(i, j, cellState!);
        if (tokenSpan) tokenSpan.innerText = String(cellState!.tokenValue);
        // Update visual style and tooltip for merged token
        try {
          rect.setStyle({
            fillColor: getColorForToken(cellState!.tokenValue),
            fillOpacity: 0.9,
          });
          rect.unbindTooltip();
          rect.bindTooltip(String(cellState!.tokenValue), {
            permanent: true,
            direction: "center",
            className: "cache-label",
          });
        } catch (e) {}
        // Update buttons
        if (pickupBtn) pickupBtn.disabled = false;
        if (placeBtn) placeBtn.disabled = true;
        updateStatus();
        alert(`Merged to ${cellState!.tokenValue}!`);
        return;
      }

      // Otherwise, cannot place onto a different token
      alert("Cell already has a different token. You can't place here.");
    });

    return popupDiv;
  });
}

// Look around the player's neighborhood for caches to spawn
// Viewport-driven spawning (D3.b)
const spawnedCells = new Set<string>();
const ORIGIN_LAT = CLASSROOM_LATLNG.lat;
const ORIGIN_LON = CLASSROOM_LATLNG.lng;
const VIEW_PADDING_TILES = 2;

// Active overlays for cells currently shown on the map. We keep a map
// so we can remove rectangles when the cell leaves the viewport.
const activeCells = new Map<string, any>();

// Local storage key for persisted cell state
const STORAGE_KEY = "wob_cellstore_v1";

// Force every visible cell to spawn a token by default
const FORCE_SPAWN = true;

function latToI(lat: number) {
  return Math.floor((lat - ORIGIN_LAT) / TILE_DEGREES);
}

function lonToJ(lon: number) {
  return Math.floor((lon - ORIGIN_LON) / TILE_DEGREES);
}

function updateVisibleCells() {
  const bounds = map.getBounds();
  const south = bounds.getSouth();
  const north = bounds.getNorth();
  const west = bounds.getWest();
  const east = bounds.getEast();

  const iMin = latToI(south) - VIEW_PADDING_TILES;
  const iMax = latToI(north) + VIEW_PADDING_TILES;
  const jMin = lonToJ(west) - VIEW_PADDING_TILES;
  const jMax = lonToJ(east) + VIEW_PADDING_TILES;

  const visibleKeys = new Set<string>();
  for (let i = iMin; i <= iMax; i++) {
    for (let j = jMin; j <= jMax; j++) {
      const key = `${i},${j}`;
      visibleKeys.add(key);
      if (spawnedCells.has(key)) continue;
      // Deterministic seeding per cell
      if (luck([i, j].toString()) < CACHE_SPAWN_PROBABILITY) {
        spawnCache(i, j);
      }
      spawnedCells.add(key);
    }
  }

  // Cells that are currently active but no longer visible should be
  // persisted to localStorage and removed from the map to free memory.
  activeCells.forEach((rect, key) => {
    if (visibleKeys.has(key)) return;
    // parse i,j from key
    const [iStr, jStr] = key.split(",");
    const iNum = parseInt(iStr, 10);
    const jNum = parseInt(jStr, 10);
    const state = getCellState(iNum, jNum);
    if (state) {
      try {
        // Persist the cell state before removing (always store current state)
        const raw = localStorage.getItem(STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) as Record<string, CellState> : {};
        parsed[key] = state;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
      } catch (e) {
        console.warn("Failed persisting cell on unload:", e);
      }
    }
    // Remove the overlay and bookkeeping entries
    try {
      rect.remove();
    } catch (e) {
      // ignore
    }
    activeCells.delete(key);
    spawnedCells.delete(key);
    cellStore.delete(key);
  });
}

// Initial spawn and on map move
updateVisibleCells();
map.on("moveend", () => updateVisibleCells());
