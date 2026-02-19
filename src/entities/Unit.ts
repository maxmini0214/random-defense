import Phaser from 'phaser';
import unitsData from '../data/units.json';
import configData from '../data/config.json';

export type UnitType = 'warrior' | 'archer' | 'mage' | 'supporter' | 'special';
export type UnitGrade = 'common' | 'rare' | 'epic' | 'legend' | 'mythic';

interface UnitStats {
  atk: number;
  attackSpeed: number;
  range: number;
  abilities: Array<Record<string, unknown>>;
}

export class Unit extends Phaser.GameObjects.Container {
  public unitType: UnitType;
  public grade: UnitGrade;
  public stats: UnitStats;
  public slotIndex: number;

  private baseCircle: Phaser.GameObjects.Graphics;
  private iconText: Phaser.GameObjects.Text;
  private gradeIndicator: Phaser.GameObjects.Graphics;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    unitType: UnitType,
    grade: UnitGrade,
    slotIndex: number
  ) {
    super(scene, x, y);

    this.unitType = unitType;
    this.grade = grade;
    this.slotIndex = slotIndex;

    const unitData = (unitsData as Record<string, { name: string; icon: string; stats: Record<string, UnitStats> }>)[unitType];
    this.stats = unitData.stats[grade];

    // Draw base circle with grade color
    this.baseCircle = scene.add.graphics();
    this.drawBase();
    this.add(this.baseCircle);

    // Grade stars indicator
    this.gradeIndicator = scene.add.graphics();
    this.drawGradeIndicator();
    this.add(this.gradeIndicator);

    // Icon text
    this.iconText = scene.add.text(0, -2, unitData.icon, {
      fontSize: '18px',
    }).setOrigin(0.5);
    this.add(this.iconText);

    scene.add.existing(this);
  }

  private drawBase(): void {
    const gradeColor = Phaser.Display.Color.HexStringToColor(
      (configData.colors.grade as Record<string, string>)[this.grade]
    ).color;
    const typeColor = Phaser.Display.Color.HexStringToColor(
      (configData.colors.unitType as Record<string, string>)[this.unitType]
    ).color;

    const radius = 22;

    this.baseCircle.clear();

    // Outer ring (grade color)
    this.baseCircle.fillStyle(gradeColor, 0.9);
    this.baseCircle.fillCircle(0, 0, radius);

    // Inner circle (type color)
    this.baseCircle.fillStyle(typeColor, 0.7);
    this.baseCircle.fillCircle(0, 0, radius - 4);

    // Subtle border
    this.baseCircle.lineStyle(2, gradeColor, 1);
    this.baseCircle.strokeCircle(0, 0, radius);
  }

  private drawGradeIndicator(): void {
    const gradeStars: Record<UnitGrade, number> = {
      common: 1,
      rare: 2,
      epic: 3,
      legend: 4,
      mythic: 5,
    };
    const stars = gradeStars[this.grade];
    const dotSize = 2.5;
    const spacing = 7;
    const startX = -((stars - 1) * spacing) / 2;
    const dotY = 16;

    const gradeColor = Phaser.Display.Color.HexStringToColor(
      (configData.colors.grade as Record<string, string>)[this.grade]
    ).color;

    this.gradeIndicator.clear();
    this.gradeIndicator.fillStyle(gradeColor, 1);

    for (let i = 0; i < stars; i++) {
      this.gradeIndicator.fillCircle(startX + i * spacing, dotY, dotSize);
    }
  }

  public getDisplayName(): string {
    const unitData = (unitsData as Record<string, { name: string }>)[this.unitType];
    const gradeNames: Record<UnitGrade, string> = {
      common: '커먼',
      rare: '레어',
      epic: '에픽',
      legend: '레전드',
      mythic: '미시크',
    };
    return `${gradeNames[this.grade]} ${unitData.name}`;
  }
}
