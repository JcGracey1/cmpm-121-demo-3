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
const NEIGHBORHOOD_SIZE = 8;
const CACHE_SPAWN_PROBABILITY = 0.1;

const board = new Board(TILE_DEGREES, NEIGHBORHOOD_SIZE);
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
function spawnCache(cell: Cell) {
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
}

for (let i = -NEIGHBORHOOD_SIZE; i < NEIGHBORHOOD_SIZE; i++) {
  for (let j = -NEIGHBORHOOD_SIZE; j < NEIGHBORHOOD_SIZE; j++) {
    if (luck([i, j].toString()) < CACHE_SPAWN_PROBABILITY) {
      const cell = board.getCanonicalCell({ i, j });
      spawnCache(cell);
    }
  }
}
