import "./style.css";
// Import Leaflet and styles
import leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import "./style.css";

// Deterministic random number generator
import luck from "./luck.ts";

// Define player starting location (Oakes College)
const OAKES_CLASSROOM = leaflet.latLng(36.98949379578401, -122.06277128548504);

// Gameplay parameters
const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_DEGREES = 0.0001;
const NEIGHBORHOOD_SIZE = 8;
const CACHE_SPAWN_PROBABILITY = 0.1;

const map = leaflet.map(document.getElementById("map")!, {
  center: OAKES_CLASSROOM,
  zoom: GAMEPLAY_ZOOM_LEVEL,
  minZoom: GAMEPLAY_ZOOM_LEVEL,
  maxZoom: GAMEPLAY_ZOOM_LEVEL,
  zoomControl: false,
  scrollWheelZoom: false,
});

// Background tile layer
leaflet.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution:
    '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}).addTo(map);

const playerMarker = leaflet.marker(OAKES_CLASSROOM).bindTooltip("Player");
playerMarker.addTo(map);

// Track player’s coins
let playerCoins = 0;
const statusPanel = document.getElementById("statusPanel")!;
statusPanel.innerHTML = `Player Coins: ${playerCoins}`;

// Create caches within a grid around the player
function spawnCache(i: number, j: number) {
  // Define bounds of cache location
  const origin = OAKES_CLASSROOM;
  const bounds = leaflet.latLngBounds([
    [origin.lat + i * TILE_DEGREES, origin.lng + j * TILE_DEGREES],
    [origin.lat + (i + 1) * TILE_DEGREES, origin.lng + (j + 1) * TILE_DEGREES],
  ]);

  // Cache marker
  const rect = leaflet.rectangle(bounds);
  rect.addTo(map);

  // Deterministic coin offering for each cache
  let cacheCoins = Math.floor(luck([i, j, "coins"].toString()) * 10);

  // Popup with options to collect or deposit coins
  rect.bindPopup(() => {
    const popupDiv = document.createElement("div");
    popupDiv.innerHTML = `
            <div>Cache at "${i},${j}" with ${cacheCoins} coins.</div>
            <button id="collect">Collect</button>
            <button id="deposit">Deposit</button>
        `;

    // Collect coins from the cache
    popupDiv.querySelector<HTMLButtonElement>("#collect")!.addEventListener(
      "click",
      () => {
        if (cacheCoins > 0) {
          playerCoins += cacheCoins;
          cacheCoins = 0;
          statusPanel.innerHTML = `Player Coins: ${playerCoins}`;
        }
      },
    );

    // Deposit coins into the cache
    popupDiv.querySelector<HTMLButtonElement>("#deposit")!.addEventListener(
      "click",
      () => {
        if (playerCoins > 0) {
          cacheCoins += playerCoins;
          playerCoins = 0;
          statusPanel.innerHTML = `Player Coins: ${playerCoins}`;
        }
      },
    );

    return popupDiv;
  });
}

for (let i = -NEIGHBORHOOD_SIZE; i < NEIGHBORHOOD_SIZE; i++) {
  for (let j = -NEIGHBORHOOD_SIZE; j < NEIGHBORHOOD_SIZE; j++) {
    // Spawn cache with a probability
    if (luck([i, j].toString()) < CACHE_SPAWN_PROBABILITY) {
      spawnCache(i, j);
    }
  }
}
