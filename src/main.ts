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
});

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
const NEIGHBORHOOD_SIZE = 8;
const CACHE_SPAWN_PROBABILITY = 0.1;

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
let playerPoints = 0;
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

  // Each cache may contain a token (power-of-two) that the player can pick up
  let tokenPresent = true;
  let tokenValue = Math.pow(
    2,
    Math.floor(luck([i, j, "initialValue"].toString()) * 4) + 1,
  );

  // Show the token value as a permanent label on the cache
  rect.bindTooltip(tokenPresent ? tokenValue.toString() : "", {
    permanent: true,
    direction: "center",
    className: "cache-label",
  });

  // Handle interactions with the cache
  rect.bindPopup(() => {
    // The popup offers a description and pickup/place buttons
    const popupDiv = document.createElement("div");
    popupDiv.innerHTML = `
                <div>There is a cache here at "${i},${j}". Token: <span id="token">${
      tokenPresent ? tokenValue : "none"
    }</span>.</div>
                <button id="pickup">Pick up</button>
                <button id="place">Place</button>`;

    const pickupBtn = popupDiv.querySelector<HTMLButtonElement>("#pickup");
    const placeBtn = popupDiv.querySelector<HTMLButtonElement>("#place");
    const tokenSpan = popupDiv.querySelector<HTMLSpanElement>("#token");

    // Initialize disabled state
    if (pickupBtn) pickupBtn.disabled = !tokenPresent || playerHand !== null;
    if (placeBtn) placeBtn.disabled = playerHand === null;

    // Clicking pickup attempts to put the token into the player's hand
    pickupBtn?.addEventListener("click", () => {
      if (!tokenPresent) {
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

      // Pick up the token
      playerHand = tokenValue;
      tokenPresent = false;
      if (tokenSpan) tokenSpan.innerText = "none";
      // update the visible cache label
      rect.getTooltip()?.setContent("");
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
      if (!tokenPresent) {
        tokenValue = playerHand as number;
        tokenPresent = true;
        playerHand = null;
        if (tokenSpan) tokenSpan.innerText = tokenValue.toString();
        // update the visible cache label
        rect.getTooltip()?.setContent(tokenValue.toString());
        // Update buttons
        if (pickupBtn) pickupBtn.disabled = false;
        if (placeBtn) placeBtn.disabled = true;
        updateStatus();
        return;
      }

      // If token present and same value, merge (single-merge-per-action)
      if (tokenPresent && tokenValue === playerHand) {
        tokenValue = tokenValue * 2;
        playerHand = null;
        if (tokenSpan) tokenSpan.innerText = tokenValue.toString();
        // update the visible cache label
        rect.getTooltip()?.setContent(tokenValue.toString());
        // Update buttons
        if (pickupBtn) pickupBtn.disabled = false;
        if (placeBtn) placeBtn.disabled = true;
        updateStatus();
        alert(`Merged to ${tokenValue}!`);
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

  for (let i = iMin; i <= iMax; i++) {
    for (let j = jMin; j <= jMax; j++) {
      const key = `${i},${j}`;
      if (spawnedCells.has(key)) continue;
      // Deterministic seeding per cell
      if (luck([i, j].toString()) < CACHE_SPAWN_PROBABILITY) {
        spawnCache(i, j);
      }
      spawnedCells.add(key);
    }
  }
}

// Initial spawn and on map move
updateVisibleCells();
map.on("moveend", () => updateVisibleCells());
