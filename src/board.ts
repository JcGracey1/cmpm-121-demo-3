import leaflet from "leaflet";

// Cell interface representing a cell in the grid
export interface Cell {
  readonly i: number;
  readonly j: number;
}

export interface Coin {
  i: number;
  j: number;
  serial: number;
}

// Board class to handle cell conversions and caching for Flyweight pattern
export class Board {
  readonly tileWidth: number;
  readonly tileVisibilityRadius: number;
  private readonly knownCells: Map<string, Cell>;

  constructor(tileWidth: number, tileVisibilityRadius: number) {
    this.tileWidth = tileWidth;
    this.tileVisibilityRadius = tileVisibilityRadius;
    this.knownCells = new Map();
  }

  // Retrieves or creates a canonical instance of a cell based on its coordinates
  public getCanonicalCell(cell: Cell): Cell {
    const key = `${cell.i},${cell.j}`;
    if (!this.knownCells.has(key)) {
      this.knownCells.set(key, cell);
    }
    return this.knownCells.get(key)!;
  }

  // Converts a latitude–longitude point to a grid cell anchored at Null Island
  getCellForPoint(point: leaflet.LatLng): Cell {
    const i = Math.floor((point.lat - 0) / this.tileWidth); // latitude relative to 0°N
    const j = Math.floor((point.lng - 0) / this.tileWidth); // longitude relative to 0°E
    return this.getCanonicalCell({ i, j });
  }

  // Gets the geographic bounds of a cell
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

  // Returns an array of neighboring cells within the visibility radius
  getCellsNearPoint(point: leaflet.LatLng): Cell[] {
    const resultCells: Cell[] = [];
    const originCell = this.getCellForPoint(point);

    for (
      let di = -this.tileVisibilityRadius;
      di <= this.tileVisibilityRadius;
      di++
    ) {
      for (
        let dj = -this.tileVisibilityRadius;
        dj <= this.tileVisibilityRadius;
        dj++
      ) {
        const neighborCell = this.getCanonicalCell({
          i: originCell.i + di,
          j: originCell.j + dj,
        });
        resultCells.push(neighborCell);
      }
    }

    return resultCells;
  }

  // Generates coins for a cell with unique identifiers
  generateCoinsForCell(cell: Cell, coinCount: number): Coin[] {
    const coins: Coin[] = [];
    for (let serial = 0; serial < coinCount; serial++) {
      coins.push({ i: cell.i, j: cell.j, serial });
    }
    return coins;
  }
}
