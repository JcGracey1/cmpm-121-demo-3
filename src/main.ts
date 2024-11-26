import "./style.css";
import leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import { Board } from "./board.ts";

// Player start location
const OAKES_CLASSROOM = leaflet.latLng(36.98949379578401, -122.06277128548504);
const TILE_DEGREES = 0.0001;
const NEIGHBORHOOD_SIZE = 5;
const CACHE_SPAWN_PROBABILITY = 0.05;

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
const playerCoins = loadPlayerCoins();
const movementHistory = loadMovementHistory();

const statusPanel = document.getElementById("statusPanel")!;
statusPanel.innerHTML = `Player Coins: ${playerCoins}`;
const cacheStorage = new Map<
  string,
  { rect: leaflet.Rectangle; cacheCoins: number }
>();
let visibleCacheIds = new Set<string>();

const board = new Board(TILE_DEGREES, NEIGHBORHOOD_SIZE, map, statusPanel);

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
  const originCell = board.getCellForPoint(playerPos);
  const newVisibleCacheIds = new Set<string>();

  for (let di = -NEIGHBORHOOD_SIZE; di <= NEIGHBORHOOD_SIZE; di++) {
    for (let dj = -NEIGHBORHOOD_SIZE; dj <= NEIGHBORHOOD_SIZE; dj++) {
      const cell = board.getCanonicalCell({
        i: originCell.i + di,
        j: originCell.j + dj,
      });
      const cellId = `${cell.i}:${cell.j}`;

      if (
        !board.cacheStorage.has(cellId) &&
        Math.random() < CACHE_SPAWN_PROBABILITY
      ) {
        if (board.isFarEnough(cell)) {
          board.spawnCache(cell, cellId);
        }
      }

      newVisibleCacheIds.add(cellId);
    }
  }

  visibleCacheIds.forEach((cacheId) => {
    if (!newVisibleCacheIds.has(cacheId)) {
      board.hideCache(cacheId);
    }
  });

  visibleCacheIds = newVisibleCacheIds;
  updateCoinList();
}
