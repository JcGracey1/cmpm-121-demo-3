import leaflet from "leaflet";
import luck from "./luck.ts";
const CACHE_SPAWN_MIN_DISTANCE = 0.001;

export interface Cell {
  readonly i: number;
  readonly j: number;
}

export interface Coin {
  i: number;
  j: number;
  serial: number;
}

export class Board {
  readonly tileWidth: number;
  readonly tileVisibilityRadius: number;
  private readonly knownCells: Map<string, Cell>;
  public readonly cacheStorage: Map<
    string,
    { rect: leaflet.Rectangle; cacheCoins: number }
  >;
  private map: leaflet.Map;
  private playerCoins: number;
  private statusPanel: HTMLElement;

  constructor(
    tileWidth: number,
    tileVisibilityRadius: number,
    map: leaflet.Map,
    statusPanel: HTMLElement,
  ) {
    this.tileWidth = tileWidth;
    this.tileVisibilityRadius = tileVisibilityRadius;
    this.knownCells = new Map();
    this.cacheStorage = new Map();
    this.map = map;
    this.playerCoins = 0;
    this.statusPanel = statusPanel;
  }

  private updateStatusPanel(): void {
    this.statusPanel.innerHTML = `Player Coins: ${this.playerCoins}`;
  }

  public getCanonicalCell(cell: Cell): Cell {
    const key = `${cell.i},${cell.j}`;
    if (!this.knownCells.has(key)) {
      this.knownCells.set(key, cell);
    }
    return this.knownCells.get(key)!;
  }

  getCellForPoint(point: leaflet.LatLng): Cell {
    const i = Math.floor((point.lat - 0) / this.tileWidth);
    const j = Math.floor((point.lng - 0) / this.tileWidth);
    return this.getCanonicalCell({ i, j });
  }

  getCellBounds(cell: Cell): leaflet.LatLngBounds {
    const southWest = leaflet.latLng(
      cell.i * this.tileWidth,
      cell.j * this.tileWidth,
    );
    const northEast = leaflet.latLng(
      (cell.i + 1) * this.tileWidth,
      (cell.j + 1) * this.tileWidth,
    );
    return leaflet.latLngBounds(southWest, northEast);
  }

  generateCoinsForCell(cell: Cell, coinCount: number): Coin[] {
    const coins: Coin[] = [];
    for (let serial = 0; serial < coinCount; serial++) {
      coins.push({ i: cell.i, j: cell.j, serial });
    }
    return coins;
  }

  // New functions

  isFarEnough(cell: Cell): boolean {
    for (const [cachedCellId] of this.cacheStorage) {
      const cachedCell = cachedCellId.split(":").map(Number);
      const distance = Math.sqrt(
        Math.pow(cell.i - cachedCell[0], 2) +
          Math.pow(cell.j - cachedCell[1], 2),
      );
      if (distance < CACHE_SPAWN_MIN_DISTANCE) {
        return false;
      }
    }
    return true;
  }

  hideCache(cellId: string): void {
    const cache = this.cacheStorage.get(cellId);
    if (cache) {
      cache.rect.remove();
      this.cacheStorage.delete(cellId);
    }
  }

  spawnCache(cell: Cell, cellId: string): void {
    const bounds = this.getCellBounds(cell);

    const rect = leaflet.rectangle(bounds);
    rect.addTo(this.map);

    // Generate deterministic number of coins
    let cacheCoins = Math.floor(
      luck([cell.i, cell.j, "coins"].toString()) * 10,
    );
    const coins = this.generateCoinsForCell(cell, cacheCoins);

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
            this.playerCoins += cacheCoins;
            cacheCoins = 0;
            this.updateStatusPanel();
          }
        },
      );

      // Deposit coins into the cache
      popupDiv.querySelector<HTMLButtonElement>("#deposit")!.addEventListener(
        "click",
        () => {
          if (this.playerCoins > 0) {
            cacheCoins += this.playerCoins;
            this.playerCoins = 0;
            this.updateStatusPanel();
          }
        },
      );

      return popupDiv;
    });

    // Save the cache in storage
    this.cacheStorage.set(cellId, { rect, cacheCoins });
  }
}
