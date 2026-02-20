import Phaser from 'phaser';
import configData from '../data/config.json';
import { Unit, UnitType, UnitGrade } from '../entities/Unit';

interface Tile {
  col: number;
  row: number;
  blocked: boolean;
  unit: Unit | null;
}

/**
 * MapGrid — Places units directly on the map as a tile grid overlay.
 * Uses slot-index API (row * cols + col) for UnitSlots compatibility.
 */
export class MapGrid extends Phaser.GameObjects.Container {
  public cols: number;
  public rows: number;
  public tileSize: number;
  public slotSize: number;
  public gridX: number;
  public gridY: number;

  private tiles: Tile[][] = [];
  private tileGraphics: Phaser.GameObjects.Graphics;

  constructor(
    scene: Phaser.Scene,
    mapX: number,
    mapY: number,
    mapWidth: number,
    mapHeight: number,
    pathWaypoints: Phaser.Math.Vector2[]
  ) {
    super(scene, 0, 0);

    const idealTileSize = 44;
    this.cols = Math.floor(mapWidth / idealTileSize);
    this.rows = Math.floor(mapHeight / idealTileSize);

    this.tileSize = Math.min(56, Math.max(40,
      Math.floor(Math.min(mapWidth / this.cols, mapHeight / this.rows))
    ));

    this.cols = Math.floor(mapWidth / this.tileSize);
    this.rows = Math.floor(mapHeight / this.tileSize);
    this.slotSize = this.tileSize;

    const totalGridW = this.cols * this.tileSize;
    const totalGridH = this.rows * this.tileSize;
    this.gridX = mapX + (mapWidth - totalGridW) / 2;
    this.gridY = mapY + (mapHeight - totalGridH) / 2;

    for (let r = 0; r < this.rows; r++) {
      const row: Tile[] = [];
      for (let c = 0; c < this.cols; c++) {
        row.push({ col: c, row: r, blocked: false, unit: null });
      }
      this.tiles.push(row);
    }

    this.markBlockedTiles(pathWaypoints);

    this.tileGraphics = scene.add.graphics();
    this.tileGraphics.setDepth(50);
    this.drawAllTiles();

    scene.add.existing(this);
    this.setDepth(50);
  }

  private markBlockedTiles(waypoints: Phaser.Math.Vector2[]): void {
    const blockRadius = this.tileSize * 0.65;
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const center = this.getTileCenterWorld(c, r);
        for (let i = 0; i < waypoints.length - 1; i++) {
          const a = waypoints[i];
          const b = waypoints[i + 1];
          if (this.pointToSegmentDist(center.x, center.y, a.x, a.y, b.x, b.y) < blockRadius) {
            this.tiles[r][c].blocked = true;
            break;
          }
        }
      }
    }
  }

  private pointToSegmentDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
    const dx = bx - ax, dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.sqrt((px - ax) ** 2 + (py - ay) ** 2);
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
    const cx = ax + t * dx, cy = ay + t * dy;
    return Math.sqrt((px - cx) ** 2 + (py - cy) ** 2);
  }

  private getTileCenterWorld(col: number, row: number): { x: number; y: number } {
    return {
      x: this.gridX + col * this.tileSize + this.tileSize / 2,
      y: this.gridY + row * this.tileSize + this.tileSize / 2,
    };
  }

  private isValidTile(row: number, col: number): boolean {
    return row >= 0 && row < this.rows && col >= 0 && col < this.cols;
  }

  private drawAllTiles(): void {
    this.tileGraphics.clear();
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const tile = this.tiles[r][c];
        const tx = this.gridX + c * this.tileSize;
        const ty = this.gridY + r * this.tileSize;
        const s = this.tileSize;
        const pad = 1;

        if (tile.blocked) {
          this.tileGraphics.fillStyle(0x000000, 0.15);
          this.tileGraphics.fillRect(tx + pad, ty + pad, s - pad * 2, s - pad * 2);
        } else if (tile.unit) {
          const gradeColor = Phaser.Display.Color.HexStringToColor(
            (configData.colors.grade as Record<string, string>)[tile.unit.grade]
          ).color;
          this.tileGraphics.fillStyle(0x2d2d44, 0.3);
          this.tileGraphics.fillRoundedRect(tx + pad, ty + pad, s - pad * 2, s - pad * 2, 4);
          this.tileGraphics.lineStyle(1.5, gradeColor, 0.5);
          this.tileGraphics.strokeRoundedRect(tx + pad, ty + pad, s - pad * 2, s - pad * 2, 4);
        } else {
          this.tileGraphics.fillStyle(0x2d2d44, 0.15);
          this.tileGraphics.fillRoundedRect(tx + pad, ty + pad, s - pad * 2, s - pad * 2, 4);
          this.tileGraphics.lineStyle(1, 0xfafafa, 0.08);
          this.tileGraphics.strokeRoundedRect(tx + pad, ty + pad, s - pad * 2, s - pad * 2, 4);
        }
      }
    }
  }

  public getSlotCenter(index: number): { x: number; y: number } {
    const row = Math.floor(index / this.cols);
    const col = index % this.cols;
    return this.getTileCenterWorld(col, row);
  }

  public getSlotTopLeft(index: number): { x: number; y: number } {
    const row = Math.floor(index / this.cols);
    const col = index % this.cols;
    return {
      x: this.gridX + col * this.tileSize,
      y: this.gridY + row * this.tileSize,
    };
  }

  public getSlotAtPosition(sceneX: number, sceneY: number): number {
    const touchPadding = 4;
    let closestSlot = -1;
    let closestDist = Infinity;

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.tiles[r][c].blocked) continue;
        const center = this.getTileCenterWorld(c, r);
        const halfSize = this.tileSize / 2 + touchPadding;
        if (Math.abs(sceneX - center.x) <= halfSize && Math.abs(sceneY - center.y) <= halfSize) {
          const dx = sceneX - center.x, dy = sceneY - center.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < closestDist) {
            closestSlot = r * this.cols + c;
            closestDist = dist;
          }
        }
      }
    }
    return closestSlot;
  }

  public findEmptySlot(): number {
    const empties: number[] = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (!this.tiles[r][c].blocked && !this.tiles[r][c].unit) {
          empties.push(r * this.cols + c);
        }
      }
    }
    if (empties.length === 0) return -1;
    return empties[Math.floor(Math.random() * empties.length)];
  }

  public placeUnit(unitType: UnitType, grade: UnitGrade, slotIndex: number): Unit | null {
    const row = Math.floor(slotIndex / this.cols);
    const col = slotIndex % this.cols;
    if (!this.isValidTile(row, col)) return null;
    const tile = this.tiles[row][col];
    if (tile.blocked || tile.unit) return null;

    const center = this.getTileCenterWorld(col, row);
    const unit = new Unit(this.scene, center.x, center.y, unitType, grade, slotIndex);
    unit.gridCol = col;
    unit.gridRow = row;
    unit.setDepth(101);

    tile.unit = unit;
    this.drawAllTiles();
    return unit;
  }

  public removeUnit(slotIndex: number): Unit | null {
    const row = Math.floor(slotIndex / this.cols);
    const col = slotIndex % this.cols;
    if (!this.isValidTile(row, col)) return null;
    const tile = this.tiles[row][col];
    const unit = tile.unit;
    if (!unit) return null;

    tile.unit = null;
    this.drawAllTiles();
    return unit;
  }

  public moveUnit(fromSlot: number, toSlot: number): void {
    const fromRow = Math.floor(fromSlot / this.cols);
    const fromCol = fromSlot % this.cols;
    const toRow = Math.floor(toSlot / this.cols);
    const toCol = toSlot % this.cols;

    const fromTile = this.tiles[fromRow][fromCol];
    const toTile = this.tiles[toRow][toCol];

    const unitA = fromTile.unit;
    const unitB = toTile.unit;

    fromTile.unit = unitB;
    toTile.unit = unitA;

    if (unitA) {
      unitA.slotIndex = toSlot;
      unitA.gridCol = toCol;
      unitA.gridRow = toRow;
      const center = this.getTileCenterWorld(toCol, toRow);
      unitA.setPosition(center.x, center.y);
    }

    if (unitB) {
      unitB.slotIndex = fromSlot;
      unitB.gridCol = fromCol;
      unitB.gridRow = fromRow;
      const center = this.getTileCenterWorld(fromCol, fromRow);
      unitB.setPosition(center.x, center.y);
    }

    this.drawAllTiles();
  }

  public isFull(): boolean {
    return this.findEmptySlot() === -1;
  }

  public getUnits(): Unit[] {
    const units: Unit[] = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.tiles[r][c].unit) units.push(this.tiles[r][c].unit!);
      }
    }
    return units;
  }

  public getUnitAtSlot(index: number): Unit | null {
    const row = Math.floor(index / this.cols);
    const col = index % this.cols;
    if (!this.isValidTile(row, col)) return null;
    if (this.tiles[row][col].blocked) return null;
    return this.tiles[row][col].unit;
  }

  public getGridHeight(): number {
    return this.rows * this.tileSize;
  }

  public highlightSlotDrop(index: number, type: 'empty' | 'merge' | 'invalid'): void {
    const row = Math.floor(index / this.cols);
    const col = index % this.cols;
    if (!this.isValidTile(row, col)) return;

    const tx = this.gridX + col * this.tileSize;
    const ty = this.gridY + row * this.tileSize;
    const s = this.tileSize;
    const pad = 1;

    let borderColor: number;
    let bgAlpha: number;
    switch (type) {
      case 'empty': borderColor = 0x66bb6a; bgAlpha = 0.25; break;
      case 'merge': borderColor = 0xffd54f; bgAlpha = 0.35; break;
      default: borderColor = 0xef5350; bgAlpha = 0.2; break;
    }

    this.tileGraphics.fillStyle(borderColor, bgAlpha);
    this.tileGraphics.fillRoundedRect(tx + pad, ty + pad, s - pad * 2, s - pad * 2, 4);
    this.tileGraphics.lineStyle(2, borderColor, 0.8);
    this.tileGraphics.strokeRoundedRect(tx + pad, ty + pad, s - pad * 2, s - pad * 2, 4);
  }

  public highlightSlot(_index: number, _grade: UnitGrade): void {
    // noop
  }

  public resetSlotHighlight(_index: number): void {
    // noop
  }

  public resetAllSlotHighlights(): void {
    this.drawAllTiles();
  }

  public getAdjacentSlots(slotIndex: number): number[] {
    const row = Math.floor(slotIndex / this.cols);
    const col = slotIndex % this.cols;
    const adjacent: number[] = [];

    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (const [dr, dc] of dirs) {
      const nr = row + dr, nc = col + dc;
      if (this.isValidTile(nr, nc) && !this.tiles[nr][nc].blocked) {
        adjacent.push(nr * this.cols + nc);
      }
    }
    return adjacent;
  }
}
