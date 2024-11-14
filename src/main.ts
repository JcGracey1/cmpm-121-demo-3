import "./style.css";
import leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import luck from "./luck.ts";
import { Board, Cell } from "./board.ts";

// Player start location
const OAKES_CLASSROOM = leaflet.latLng(36.98949379578401, -122.06277128548504);
const TILE_DEGREES = 0.0001;
const NEIGHBORHOOD_SIZE = 5;
const CACHE_SPAWN_PROBABILITY = 0.05;
const CACHE_SPAWN_MIN_DISTANCE = 0.001;

const board = new Board(TILE_DEGREES, NEIGHBORHOOD_SIZE);
const map = leaflet.map(document.getElementById("map")!, {
  center: OAKES_CLASSROOM,
  zoom: 19,
  minZoom: 19,
  maxZoom: 19,
  zoomControl: false,
  scrollWheelZoom: false,
});

leaflet.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution:
    '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}).addTo(map);

const playerPosition = loadPlayerPosition();
const playerMarker = leaflet.marker(playerPosition).bindTooltip("Player").addTo(
  map,
);
let playerCoins = loadPlayerCoins();
const movementHistory = loadMovementHistory();

const statusPanel = document.getElementById("statusPanel")!;
statusPanel.innerHTML = `Player Coins: ${playerCoins}`;
const cacheStorage = new Map<
  string,
  { rect: leaflet.Rectangle; cacheCoins: number }
>();
let visibleCacheIds = new Set<string>();

// Movement history polyline
const movementPolyline = leaflet.polyline(movementHistory, { color: "blue" })
  .addTo(map);

// Buttons for movement
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

// Button for enabling geolocation
let tracking = false;
document.getElementById("geo-btn")!.addEventListener(
  "click",
  toggleGeolocationTracking,
);

// Button for resetting the game
document.getElementById("reset-btn")!.addEventListener("click", resetGame);

function movePlayer(dLat: number, dLng: number) {
  const newLat = playerMarker.getLatLng().lat + dLat * TILE_DEGREES;
  const newLng = playerMarker.getLatLng().lng + dLng * TILE_DEGREES;
  const newPosition = leaflet.latLng(newLat, newLng);

  playerMarker.setLatLng(newPosition);
  map.panTo(newPosition);
  movementHistory.push(newPosition);
  movementPolyline.addLatLng(newPosition);

  saveGameState(newPosition);
  updateVisibleCaches();
}

function toggleGeolocationTracking() {
  tracking = !tracking;
  if (tracking) {
    navigator.geolocation.watchPosition((position) => {
      movePlayerToGeolocation(
        position.coords.latitude,
        position.coords.longitude,
      );
    });
  }
}

function movePlayerToGeolocation(lat: number, lng: number) {
  playerMarker.setLatLng([lat, lng]);
  map.panTo([lat, lng]);
  movementHistory.push([lat, lng]);
  movementPolyline.addLatLng([lat, lng]);
  saveGameState(leaflet.latLng(lat, lng));
  updateVisibleCaches();
}

function resetGame() {
  if (confirm("Are you sure you want to erase your game state?")) {
    localStorage.clear();
    globalThis.location.reload();
  }
}

function saveGameState(playerPosition: leaflet.LatLng) {
  localStorage.setItem("playerPosition", JSON.stringify(playerPosition));
  localStorage.setItem("playerCoins", playerCoins.toString());
  localStorage.setItem("movementHistory", JSON.stringify(movementHistory));
}

function loadPlayerPosition(): leaflet.LatLng {
  const savedPosition = localStorage.getItem("playerPosition");
  return savedPosition ? JSON.parse(savedPosition) : OAKES_CLASSROOM;
}

function loadPlayerCoins(): number {
  return parseInt(localStorage.getItem("playerCoins") || "0");
}

function loadMovementHistory(): leaflet.LatLng[] {
  const savedHistory = localStorage.getItem("movementHistory");
  return savedHistory ? JSON.parse(savedHistory) : [OAKES_CLASSROOM];
}

// Cache functions and other required functions remain the same as in your code

// Add event listeners for additional features or optional UI adjustments as needed.

const coinListContainer = document.getElementById("coin-list");

// Function to render coin identifiers
function updateCoinList() {
  if (coinListContainer) {
    coinListContainer.innerHTML = ""; // Clear existing items
    visibleCacheIds.forEach((cacheId) => {
      const cache = cacheStorage.get(cacheId);
      if (cache) {
        const coinButton = document.createElement("button");
        coinButton.textContent = `Coin ${cacheId}`;
        coinButton.addEventListener("click", () => centerOnCache(cacheId));
        coinListContainer.appendChild(coinButton);
      }
    });
  }
}

// Function to center map on cache location when a coin identifier is clicked
function centerOnCache(cacheId: string) {
  const cache = cacheStorage.get(cacheId);
  if (cache) {
    map.panTo(cache.rect.getBounds().getCenter());
    cache.rect.openPopup(); // Optional: Show popup for the cache if it has one
  }
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

  // Update the coin list for visible caches
  updateCoinList();
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
