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

const mapDiv = document.createElement("div");
mapDiv.id = "map";
document.body.append(mapDiv);

const statusPanelDiv = document.createElement("div");
statusPanelDiv.id = "statusPanel";
document.body.append(statusPanelDiv);

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
  statusPanelDiv.innerHTML = `${playerPoints} points accumulated — Hand: ${
    playerHand ?? "empty"
  }`;
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
    if (pickupBtn) pickupBtn.disabled = !tokenPresent;
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
for (let i = -NEIGHBORHOOD_SIZE; i < NEIGHBORHOOD_SIZE; i++) {
  for (let j = -NEIGHBORHOOD_SIZE; j < NEIGHBORHOOD_SIZE; j++) {
    // If location i,j is lucky enough, spawn a cache!
    if (luck([i, j].toString()) < CACHE_SPAWN_PROBABILITY) {
      spawnCache(i, j);
    }
  }
}
