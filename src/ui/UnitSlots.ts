import Phaser from 'phaser';
import configData from '../data/config.json';
import { Unit, UnitType, UnitGrade } from '../entities/Unit';

export class UnitSlots extends Phaser.GameObjects.Container {
  public slots: (Unit | null)[];
  private slotGraphics: Phaser.GameObjects.Graphics[];
  public slotSize: number;
  private slotPadding: number;
  public gridX: number;
  public gridY: number;
  private rows: number;
  public cols: number;

  constructor(scene: Phaser.Scene, x: number, y: number, width: number) {
    super(scene, x, y);

    this.rows = configData.slots.rows;
    this.cols = configData.slots.cols;
    this.slots = new Array(configData.slots.total).fill(null);
    this.slotGraphics = [];

    this.slotPadding = 6;
    this.slotSize = Math.max(
      44, // Minimum touch target 44×44px
      Math.min(
        (width - this.slotPadding * (this.cols + 1)) / this.cols,
        56
      )
    );

    const totalGridW = this.cols * this.slotSize + (this.cols - 1) * this.slotPadding;
    this.gridX = (width - totalGridW) / 2;
    this.gridY = 0;

    this.drawSlots();

    scene.add.existing(this);
    this.setDepth(100);
  }

  private drawSlots(): void {
    const uiBgColor = Phaser.Display.Color.HexStringToColor(configData.colors.ui.background).color;

    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        const sx = this.gridX + col * (this.slotSize + this.slotPadding);
        const sy = this.gridY + row * (this.slotSize + this.slotPadding);

        const g = this.scene.add.graphics();
        g.fillStyle(uiBgColor, 0.8);
        g.fillRoundedRect(sx, sy, this.slotSize, this.slotSize, 6);
        g.lineStyle(1, 0xfafafa, 0.15);
        g.strokeRoundedRect(sx, sy, this.slotSize, this.slotSize, 6);
        this.add(g);
        this.slotGraphics.push(g);
      }
    }
  }

  /**
   * Get the center position (in scene coordinates) of a slot.
   */
  public getSlotCenter(index: number): { x: number; y: number } {
    const row = Math.floor(index / this.cols);
    const col = index % this.cols;
    const sx = this.x + this.gridX + col * (this.slotSize + this.slotPadding) + this.slotSize / 2;
    const sy = this.y + this.gridY + row * (this.slotSize + this.slotPadding) + this.slotSize / 2;
    return { x: sx, y: sy };
  }

  /**
   * Get the top-left position (in scene coordinates) of a slot.
   */
  public getSlotTopLeft(index: number): { x: number; y: number } {
    const row = Math.floor(index / this.cols);
    const col = index % this.cols;
    return {
      x: this.x + this.gridX + col * (this.slotSize + this.slotPadding),
      y: this.y + this.gridY + row * (this.slotSize + this.slotPadding),
    };
  }

  /**
   * Given scene coordinates, return the slot index or -1 if not over any slot.
   */
  public getSlotAtPosition(sceneX: number, sceneY: number): number {
    // Use expanded hit area for better mobile touch detection
    const touchPadding = 8;
    let closestSlot = -1;
    let closestDist = Infinity;

    for (let i = 0; i < configData.slots.total; i++) {
      const center = this.getSlotCenter(i);
      const dx = sceneX - center.x;
      const dy = sceneY - center.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const halfSize = this.slotSize / 2 + touchPadding;

      if (
        Math.abs(sceneX - center.x) <= halfSize &&
        Math.abs(sceneY - center.y) <= halfSize &&
        dist < closestDist
      ) {
        closestSlot = i;
        closestDist = dist;
      }
    }
    return closestSlot;
  }

  /**
   * Find the first empty slot index, or -1 if full.
   */
  public findEmptySlot(): number {
    return this.slots.indexOf(null);
  }

  /**
   * Place a unit in a specific slot.
   */
  public placeUnit(
    unitType: UnitType,
    grade: UnitGrade,
    slotIndex: number
  ): Unit | null {
    if (slotIndex < 0 || slotIndex >= this.slots.length) return null;
    if (this.slots[slotIndex] !== null) return null;

    const center = this.getSlotCenter(slotIndex);
    const unit = new Unit(this.scene, center.x, center.y, unitType, grade, slotIndex);
    unit.setDepth(101);
    this.slots[slotIndex] = unit;

    this.highlightSlot(slotIndex, grade);

    return unit;
  }

  /**
   * Remove a unit from its slot. Does NOT destroy the unit.
   */
  public removeUnit(slotIndex: number): Unit | null {
    const unit = this.slots[slotIndex];
    if (!unit) return null;

    this.slots[slotIndex] = null;
    this.resetSlotHighlight(slotIndex);
    return unit;
  }

  /**
   * Move a unit from one slot to another (swap or move to empty).
   */
  public moveUnit(fromSlot: number, toSlot: number): void {
    const unitA = this.slots[fromSlot];
    const unitB = this.slots[toSlot];

    // Swap
    this.slots[fromSlot] = unitB;
    this.slots[toSlot] = unitA;

    if (unitA) {
      unitA.slotIndex = toSlot;
      const center = this.getSlotCenter(toSlot);
      unitA.setPosition(center.x, center.y);
      this.highlightSlot(toSlot, unitA.grade);
    } else {
      this.resetSlotHighlight(toSlot);
    }

    if (unitB) {
      unitB.slotIndex = fromSlot;
      const center = this.getSlotCenter(fromSlot);
      unitB.setPosition(center.x, center.y);
      this.highlightSlot(fromSlot, unitB.grade);
    } else {
      this.resetSlotHighlight(fromSlot);
    }
  }

  /**
   * Highlight a slot as a valid drop target.
   */
  public highlightSlotDrop(index: number, type: 'empty' | 'merge' | 'invalid'): void {
    const row = Math.floor(index / this.cols);
    const col = index % this.cols;
    const sx = this.gridX + col * (this.slotSize + this.slotPadding);
    const sy = this.gridY + row * (this.slotSize + this.slotPadding);

    const g = this.slotGraphics[index];
    g.clear();

    let borderColor: number;
    let bgAlpha: number;
    switch (type) {
      case 'empty':
        borderColor = 0x66bb6a; // green
        bgAlpha = 0.4;
        break;
      case 'merge':
        borderColor = 0xffd54f; // gold
        bgAlpha = 0.5;
        break;
      case 'invalid':
      default:
        borderColor = 0xef5350; // red
        bgAlpha = 0.3;
        break;
    }

    g.fillStyle(Phaser.Display.Color.HexStringToColor(configData.colors.ui.background).color, bgAlpha);
    g.fillRoundedRect(sx, sy, this.slotSize, this.slotSize, 6);
    g.lineStyle(2, borderColor, 0.9);
    g.strokeRoundedRect(sx, sy, this.slotSize, this.slotSize, 6);
  }

  public highlightSlot(index: number, grade: UnitGrade): void {
    const gradeColor = Phaser.Display.Color.HexStringToColor(
      (configData.colors.grade as Record<string, string>)[grade]
    ).color;

    const row = Math.floor(index / this.cols);
    const col = index % this.cols;
    const sx = this.gridX + col * (this.slotSize + this.slotPadding);
    const sy = this.gridY + row * (this.slotSize + this.slotPadding);

    const g = this.slotGraphics[index];
    g.clear();
    g.fillStyle(
      Phaser.Display.Color.HexStringToColor(configData.colors.ui.background).color,
      0.8
    );
    g.fillRoundedRect(sx, sy, this.slotSize, this.slotSize, 6);
    g.lineStyle(2, gradeColor, 0.6);
    g.strokeRoundedRect(sx, sy, this.slotSize, this.slotSize, 6);
  }

  public resetSlotHighlight(index: number): void {
    const row = Math.floor(index / this.cols);
    const col = index % this.cols;
    const sx = this.gridX + col * (this.slotSize + this.slotPadding);
    const sy = this.gridY + row * (this.slotSize + this.slotPadding);

    const g = this.slotGraphics[index];
    g.clear();
    g.fillStyle(
      Phaser.Display.Color.HexStringToColor(configData.colors.ui.background).color,
      0.8
    );
    g.fillRoundedRect(sx, sy, this.slotSize, this.slotSize, 6);
    g.lineStyle(1, 0xfafafa, 0.15);
    g.strokeRoundedRect(sx, sy, this.slotSize, this.slotSize, 6);
  }

  /**
   * Reset all slot highlights back to their default (or unit-grade color).
   */
  public resetAllSlotHighlights(): void {
    for (let i = 0; i < this.slots.length; i++) {
      const unit = this.slots[i];
      if (unit) {
        this.highlightSlot(i, unit.grade);
      } else {
        this.resetSlotHighlight(i);
      }
    }
  }

  public isFull(): boolean {
    return this.findEmptySlot() === -1;
  }

  public getGridHeight(): number {
    return this.rows * (this.slotSize + this.slotPadding) - this.slotPadding;
  }

  /** Get all placed units (non-null). */
  public getUnits(): Unit[] {
    return this.slots.filter((u): u is Unit => u !== null);
  }

  /** Get the unit at a specific slot index. */
  public getUnitAtSlot(index: number): Unit | null {
    if (index < 0 || index >= this.slots.length) return null;
    return this.slots[index];
  }
}
