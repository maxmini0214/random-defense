import Phaser from 'phaser';
import configData from '../data/config.json';
import { Unit, UnitType, UnitGrade } from '../entities/Unit';

export class UnitSlots extends Phaser.GameObjects.Container {
  public slots: (Unit | null)[];
  private slotGraphics: Phaser.GameObjects.Graphics[];
  private slotSize: number;
  private slotPadding: number;
  private gridX: number;
  private gridY: number;
  private rows: number;
  private cols: number;

  constructor(scene: Phaser.Scene, x: number, y: number, width: number) {
    super(scene, x, y);

    this.rows = configData.slots.rows;
    this.cols = configData.slots.cols;
    this.slots = new Array(configData.slots.total).fill(null);
    this.slotGraphics = [];

    this.slotPadding = 6;
    this.slotSize = Math.min(
      (width - this.slotPadding * (this.cols + 1)) / this.cols,
      56
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

    // Highlight the slot
    this.highlightSlot(slotIndex, grade);

    return unit;
  }

  /**
   * Remove a unit from its slot.
   */
  public removeUnit(slotIndex: number): Unit | null {
    const unit = this.slots[slotIndex];
    if (!unit) return null;

    this.slots[slotIndex] = null;
    this.resetSlotHighlight(slotIndex);
    return unit;
  }

  private highlightSlot(index: number, grade: UnitGrade): void {
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

  private resetSlotHighlight(index: number): void {
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

  public isFull(): boolean {
    return this.findEmptySlot() === -1;
  }

  public getGridHeight(): number {
    return this.rows * (this.slotSize + this.slotPadding) - this.slotPadding;
  }
}
