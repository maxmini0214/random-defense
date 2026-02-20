import Phaser from 'phaser';
import configData from '../data/config.json';
import { Unit, UnitType, UnitGrade } from '../entities/Unit';

export interface GridCell {
  col: number;
  row: number;
  blocked: boolean;
  unit: Unit | null;
}

export class MapGrid {
  private scene: Phaser.Scene;
  private cells: GridCell[][] = [];
  private cellGraphics: Phaser.GameObjects.Graphics[][] = [];
  private gridContainer: Phaser.GameObjects.Container;

  public cols: number;
  public rows: number;
  public cellSize: number;
  public mapX: number;
  public mapY: number;
  public mapW: number;
  public mapH: number;
  private gridOffsetX: number = 0;
  private gridOffsetY: number = 0;
  private availableCount: number = 0;

  constructor(
    scene: Phaser.Scene,
    mapX: number,
    mapY: number,
    mapW: number,
    mapH: number,
    path: Phaser.Curves.Path
  ) {
    this.scene = scene;
    this.mapX = mapX;
    this.mapY = mapY;
    this.mapW = mapW;
    this.mapH = mapH;

    this.cellSize = 48;
    this.cols = Math.floor(mapW / this.cellSize);
    this.rows = Math.floor(mapH / this.cellSize);

    this.gridOffsetX = mapX + (mapW - this.cols * this.cellSize) / 2;
    this.gridOffsetY = mapY + (mapH - this.rows * this.cellSize) / 2;

    this.gridContainer = scene.add.container(0, 0);
    this.gridContainer.setDepth(50);

    this.initCells(path);
    this.drawGrid();
  }

  private initCells(path: Phaser.Curves.Path): void {
    const pathPoints: Phaser.Math.Vector2[] = [];
    const numSamples = 500;
    for (let i = 0; i <= numSamples; i++) {
      const t = i / numSamples;
      const pt = path.getPoint(t);
      pathPoints.push(pt);
    }

    const pathHalfWidth = 16;

    for (let row = 0; row < this.rows; row++) {
      this.cells[row] = [];
      for (let col = 0; col < this.cols; col++) {
        const cx = this.gridOffsetX + col * this.cellSize + this.cellSize / 2;
        const cy = this.gridOffsetY + row * this.cellSize + this.cellSize / 2;

        let blocked = false;
        for (const pt of pathPoints) {
          const dx = Math.abs(pt.x - cx);
          const dy = Math.abs(pt.y - cy);
          if (dx < this.cellSize / 2 + pathHalfWidth && dy < this.cellSize / 2 + pathHalfWidth) {
            blocked = true;
            break;
          }
        }

        this.cells[row][col] = { col, row, blocked, unit: null };
        if (!blocked) this.availableCount++;
      }
    }
  }

  private drawGrid(): void {
    const uiBgColor = Phaser.Display.Color.HexStringToColor(configData.colors.ui.background).color;

    for (let row = 0; row < this.rows; row++) {
      this.cellGraphics[row] = [];
      for (let col = 0; col < this.cols; col++) {
        const cell = this.cells[row][col];
        const g = this.scene.add.graphics();
        const x = this.gridOffsetX + col * this.cellSize;
        const y = this.gridOffsetY + row * this.cellSize;

        if (!cell.blocked) {
          g.fillStyle(uiBgColor, 0.4);
          g.fillRoundedRect(x + 1, y + 1, this.cellSize - 2, this.cellSize - 2, 4);
          g.lineStyle(1, 0xfafafa, 0.08);
          g.strokeRoundedRect(x + 1, y + 1, this.cellSize - 2, this.cellSize - 2, 4);
        }

        this.gridContainer.add(g);
        this.cellGraphics[row][col] = g;
      }
    }
  }

  public getCellCenter(col: number, row: number): { x: number; y: number } {
    return {
      x: this.gridOffsetX + col * this.cellSize + this.cellSize / 2,
      y: this.gridOffsetY + row * this.cellSize + this.cellSize / 2,
    };
  }

  public getCellTopLeft(col: number, row: number): { x: number; y: number } {
    return {
      x: this.gridOffsetX + col * this.cellSize,
      y: this.gridOffsetY + row * this.cellSize,
    };
  }

  public getCellAtPosition(sceneX: number, sceneY: number): { col: number; row: number } | null {
    const col = Math.floor((sceneX - this.gridOffsetX) / this.cellSize);
    const row = Math.floor((sceneY - this.gridOffsetY) / this.cellSize);

    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return null;
    if (this.cells[row][col].blocked) return null;

    return { col, row };
  }

  public findEmptyCell(): { col: number; row: number } | null {
    const empty: { col: number; row: number }[] = [];
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        if (!this.cells[row][col].blocked && this.cells[row][col].unit === null) {
          empty.push({ col, row });
        }
      }
    }
    if (empty.length === 0) return null;
    return empty[Math.floor(Math.random() * empty.length)];
  }

  public placeUnit(
    unitType: UnitType,
    grade: UnitGrade,
    col: number,
    row: number
  ): Unit | null {
    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) return null;
    const cell = this.cells[row][col];
    if (cell.blocked || cell.unit !== null) return null;

    const center = this.getCellCenter(col, row);
    const slotIndex = row * this.cols + col;
    const unit = new Unit(this.scene, center.x, center.y, unitType, grade, slotIndex);
    unit.gridCol = col;
    unit.gridRow = row;
    unit.setDepth(101);
    cell.unit = unit;

    this.highlightCellUnit(col, row, grade);

    return unit;
  }

  public removeUnit(col: number, row: number): Unit | null {
    const cell = this.cells[row]?.[col];
    if (!cell || !cell.unit) return null;

    const unit = cell.unit;
    cell.unit = null;
    this.resetCellHighlight(col, row);
    return unit;
  }

  public moveUnit(fromCol: number, fromRow: number, toCol: number, toRow: number): void {
    const cellA = this.cells[fromRow][fromCol];
    const cellB = this.cells[toRow][toCol];

    const unitA = cellA.unit;
    const unitB = cellB.unit;

    cellA.unit = unitB;
    cellB.unit = unitA;

    if (unitA) {
      unitA.gridCol = toCol;
      unitA.gridRow = toRow;
      unitA.slotIndex = toRow * this.cols + toCol;
      const center = this.getCellCenter(toCol, toRow);
      unitA.setPosition(center.x, center.y);
      this.highlightCellUnit(toCol, toRow, unitA.grade);
    } else {
      this.resetCellHighlight(toCol, toRow);
    }

    if (unitB) {
      unitB.gridCol = fromCol;
      unitB.gridRow = fromRow;
      unitB.slotIndex = fromRow * this.cols + fromCol;
      const center = this.getCellCenter(fromCol, fromRow);
      unitB.setPosition(center.x, center.y);
      this.highlightCellUnit(fromCol, fromRow, unitB.grade);
    } else {
      this.resetCellHighlight(fromCol, fromRow);
    }
  }

  public highlightCellDrop(col: number, row: number, type: 'empty' | 'merge' | 'invalid'): void {
    const g = this.cellGraphics[row]?.[col];
    if (!g) return;
    const x = this.gridOffsetX + col * this.cellSize;
    const y = this.gridOffsetY + row * this.cellSize;

    g.clear();

    let borderColor: number;
    let bgAlpha: number;
    switch (type) {
      case 'empty':
        borderColor = 0x66bb6a;
        bgAlpha = 0.35;
        break;
      case 'merge':
        borderColor = 0xffd54f;
        bgAlpha = 0.45;
        break;
      case 'invalid':
      default:
        borderColor = 0xef5350;
        bgAlpha = 0.25;
        break;
    }

    g.fillStyle(Phaser.Display.Color.HexStringToColor(configData.colors.ui.background).color, bgAlpha);
    g.fillRoundedRect(x + 1, y + 1, this.cellSize - 2, this.cellSize - 2, 4);
    g.lineStyle(2, borderColor, 0.85);
    g.strokeRoundedRect(x + 1, y + 1, this.cellSize - 2, this.cellSize - 2, 4);
  }

  public highlightCellUnit(col: number, row: number, grade: UnitGrade): void {
    const g = this.cellGraphics[row]?.[col];
    if (!g) return;
    const x = this.gridOffsetX + col * this.cellSize;
    const y = this.gridOffsetY + row * this.cellSize;

    const gradeColor = Phaser.Display.Color.HexStringToColor(
      (configData.colors.grade as Record<string, string>)[grade]
    ).color;

    g.clear();
    g.fillStyle(Phaser.Display.Color.HexStringToColor(configData.colors.ui.background).color, 0.5);
    g.fillRoundedRect(x + 1, y + 1, this.cellSize - 2, this.cellSize - 2, 4);
    g.lineStyle(2, gradeColor, 0.5);
    g.strokeRoundedRect(x + 1, y + 1, this.cellSize - 2, this.cellSize - 2, 4);
  }

  public resetCellHighlight(col: number, row: number): void {
    const g = this.cellGraphics[row]?.[col];
    if (!g) return;
    const cell = this.cells[row][col];
    if (cell.blocked) return;

    const x = this.gridOffsetX + col * this.cellSize;
    const y = this.gridOffsetY + row * this.cellSize;

    g.clear();
    g.fillStyle(Phaser.Display.Color.HexStringToColor(configData.colors.ui.background).color, 0.4);
    g.fillRoundedRect(x + 1, y + 1, this.cellSize - 2, this.cellSize - 2, 4);
    g.lineStyle(1, 0xfafafa, 0.08);
    g.strokeRoundedRect(x + 1, y + 1, this.cellSize - 2, this.cellSize - 2, 4);
  }

  public resetAllHighlights(): void {
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        const cell = this.cells[row][col];
        if (cell.blocked) continue;
        if (cell.unit) {
          this.highlightCellUnit(col, row, cell.unit.grade);
        } else {
          this.resetCellHighlight(col, row);
        }
      }
    }
  }

  public getUnits(): Unit[] {
    const units: Unit[] = [];
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        const u = this.cells[row][col].unit;
        if (u) units.push(u);
      }
    }
    return units;
  }

  public getUnitAt(col: number, row: number): Unit | null {
    return this.cells[row]?.[col]?.unit ?? null;
  }

  public isFull(): boolean {
    return this.findEmptyCell() === null;
  }

  public getAdjacentCells(col: number, row: number): { col: number; row: number }[] {
    const adjacent: { col: number; row: number }[] = [];
    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (const [dr, dc] of dirs) {
      const nr = row + dr;
      const nc = col + dc;
      if (nr >= 0 && nr < this.rows && nc >= 0 && nc < this.cols && !this.cells[nr][nc].blocked) {
        adjacent.push({ col: nc, row: nr });
      }
    }
    return adjacent;
  }

  public get totalAvailable(): number {
    return this.availableCount;
  }

  public destroy(): void {
    this.gridContainer.destroy();
  }
}
