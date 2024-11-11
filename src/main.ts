import "./style.css";
import leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import luck from "./luck.ts";
import { Board, Cell } from "./board.ts";

// Define player starting location (Oakes College)
const OAKES_CLASSROOM = leaflet.latLng(36.98949379578401, -122.06277128548504);

// Gameplay parameters
const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_DEGREES = 0.0001;
const NEIGHBORHOOD_SIZE = 5; // Reduced neighborhood size to reduce cache density
const CACHE_SPAWN_PROBABILITY = 0.05; // Lowered spawn probability to reduce cache frequency
const CACHE_SPAWN_MIN_DISTANCE = 0.001; // Increased minimum distance between caches

// Map and board setup
const board = new Board(TILE_DEGREES, NEIGHBORHOOD_SIZE);
const map = leaflet.map(document.getElementById("map")!, {
  center: OAKES_CLASSROOM,
  zoom: GAMEPLAY_ZOOM_LEVEL,
  minZoom: GAMEPLAY_ZOOM_LEVEL,
  maxZoom: GAMEPLAY_ZOOM_LEVEL,
  zoomControl: false,
  scrollWheelZoom: false,
});

leaflet.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution:
    '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}).addTo(map);

const playerMarker = leaflet.marker(OAKES_CLASSROOM).bindTooltip("Player");
playerMarker.addTo(map);

// Movement buttons
document.getElementById("move-up")!.addEventListener(
  "click",
  () => movePlayer(1, 0),
);
document.getElementById("move-down")!.addEventListener(
  "click",
  () => movePlayer(-1, 0),
);
document.getElementById("move-left")!.addEventListener(
  "click",
  () => movePlayer(0, -1),
);
document.getElementById("move-right")!.addEventListener(
  "click",
  () => movePlayer(0, 1),
);

// Track player’s coins
let playerCoins = 0;
const statusPanel = document.getElementById("statusPanel")!;
statusPanel.innerHTML = `Player Coins: ${playerCoins}`;

// Cache storage for Memento pattern
const cacheStorage = new Map<
  string,
  { rect: leaflet.Rectangle; cacheCoins: number }
>();
let visibleCacheIds = new Set<string>(); // To track which caches are currently visible

function movePlayer(dLat: number, dLng: number) {
  const newLat = playerMarker.getLatLng().lat + dLat * TILE_DEGREES;
  const newLng = playerMarker.getLatLng().lng + dLng * TILE_DEGREES;

  // Move player marker and update map center
  playerMarker.setLatLng([newLat, newLng]);
  map.panTo(playerMarker.getLatLng());

  // Update visible caches based on new position
  updateVisibleCaches();
}

function updateVisibleCaches() {
  const playerPos = playerMarker.getLatLng();
  const iCenter = Math.round(
    (playerPos.lat - OAKES_CLASSROOM.lat) / TILE_DEGREES,
  );
  const jCenter = Math.round(
    (playerPos.lng - OAKES_CLASSROOM.lng) / TILE_DEGREES,
  );

  const newVisibleCacheIds = new Set<string>();

  // Generate or show caches only for new cells in the player's neighborhood
  for (
    let i = iCenter - NEIGHBORHOOD_SIZE;
    i <= iCenter + NEIGHBORHOOD_SIZE;
    i++
  ) {
    for (
      let j = jCenter - NEIGHBORHOOD_SIZE;
      j <= jCenter + NEIGHBORHOOD_SIZE;
      j++
    ) {
      const cellId = `${i}:${j}`;

      // Only generate new cache if it does not already exist in cacheStorage and meets distance and probability criteria
      if (
        !cacheStorage.has(cellId) && Math.random() < CACHE_SPAWN_PROBABILITY
      ) {
        const cell = board.getCanonicalCell({ i, j });
        // Check if the new cache is far enough from existing caches
        if (isFarEnough(cell)) {
          spawnCache(cell, cellId);
        }
      }

      // Mark this cache as visible
      newVisibleCacheIds.add(cellId);
    }
  }

  // Hide caches that are no longer within the visible area
  visibleCacheIds.forEach((cacheId) => {
    if (!newVisibleCacheIds.has(cacheId)) {
      hideCache(cacheId);
    }
  });

  // Update the visible cache IDs set
  visibleCacheIds = newVisibleCacheIds;
}

function isFarEnough(cell: Cell): boolean {
  // Check the distance between the current cell and other cached cells
  for (const [cachedCellId] of cacheStorage) {
    const cachedCell = cachedCellId.split(":").map(Number);
    const distance = Math.sqrt(
      Math.pow(cell.i - cachedCell[0], 2) + Math.pow(cell.j - cachedCell[1], 2),
    );
    if (distance < CACHE_SPAWN_MIN_DISTANCE) {
      return false; // Not far enough
    }
  }
  return true; // Far enough
}

function hideCache(cellId: string) {
  const cache = cacheStorage.get(cellId);
  if (cache) {
    cache.rect.remove(); // Now remove() is valid
    cacheStorage.delete(cellId); // Delete the cache from storage
  }
}

function spawnCache(cell: Cell, cellId: string) {
  const origin = OAKES_CLASSROOM;
  const bounds = leaflet.latLngBounds([
    [origin.lat + cell.i * TILE_DEGREES, origin.lng + cell.j * TILE_DEGREES],
    [
      origin.lat + (cell.i + 1) * TILE_DEGREES,
      origin.lng + (cell.j + 1) * TILE_DEGREES,
    ],
  ]);

  const rect = leaflet.rectangle(bounds);
  rect.addTo(map);

  // Deterministic coin offering for each cache
  let cacheCoins = Math.floor(luck([cell.i, cell.j, "coins"].toString()) * 10);
  const coins = board.generateCoinsForCell(cell, cacheCoins);

  rect.bindPopup(() => {
    const popupDiv = document.createElement("div");
    popupDiv.innerHTML = `
          <div>Cache at "${cell.i},${cell.j}" with ${cacheCoins} coins.</div>
          ${
      coins.map((coin) =>
        `<div>Coin ID: ${coin.i}:${coin.j}#${coin.serial}</div>`
      ).join("")
    }
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

  // Save the cache state for memento
  cacheStorage.set(cellId, { rect, cacheCoins });
}
