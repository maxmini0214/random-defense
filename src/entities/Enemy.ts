import Phaser from 'phaser';
import wavesData from '../data/waves.json';

export type EnemyType = 'normal' | 'fast' | 'tank' | 'flying' | 'boss';

interface EnemyTypeData {
  speedMultiplier: number;
  hpMultiplier: number;
  armor: number;
  color: string;
  shape: string;
}

export class Enemy extends Phaser.GameObjects.Container {
  public enemyType: EnemyType;
  public maxHp: number;
  public currentHp: number;
  public armor: number;
  public speedMultiplier: number;
  public baseSpeed: number = 60; // pixels per second
  public isFlying: boolean;
  public pathT: number = 0; // 0..1 progress along path
  public isDead: boolean = false;
  public reachedEnd: boolean = false;

  private shape: Phaser.GameObjects.Graphics;
  private hpBar: Phaser.GameObjects.Graphics;
  private typeData: EnemyTypeData;
  private size: number;

  constructor(
    scene: Phaser.Scene,
    type: EnemyType,
    hp: number,
    path: Phaser.Curves.Path
  ) {
    super(scene, 0, 0);

    this.enemyType = type;
    this.typeData = (wavesData.enemyTypes as Record<string, EnemyTypeData>)[type];
    this.maxHp = hp;
    this.currentHp = hp;
    this.armor = this.typeData.armor;
    this.speedMultiplier = this.typeData.speedMultiplier;
    this.isFlying = type === 'flying';

    this.size = type === 'boss' ? 18 : 12;

    // Draw enemy shape
    this.shape = scene.add.graphics();
    this.drawShape();
    this.add(this.shape);

    // HP bar
    this.hpBar = scene.add.graphics();
    this.drawHpBar();
    this.add(this.hpBar);

    // Position at start of path
    const startPoint = path.getPoint(0);
    this.setPosition(startPoint.x, startPoint.y);

    scene.add.existing(this);
  }

  private drawShape(): void {
    const color = Phaser.Display.Color.HexStringToColor(this.typeData.color).color;
    const s = this.size;

    this.shape.clear();
    this.shape.fillStyle(color, 1);
    this.shape.lineStyle(2, 0xffffff, 0.3);

    switch (this.typeData.shape) {
      case 'triangle':
        this.shape.fillTriangle(0, -s, -s, s, s, s);
        this.shape.strokeTriangle(0, -s, -s, s, s, s);
        break;
      case 'diamond':
        this.shape.fillPoints([
          new Phaser.Geom.Point(0, -s),
          new Phaser.Geom.Point(s, 0),
          new Phaser.Geom.Point(0, s),
          new Phaser.Geom.Point(-s, 0),
        ], true);
        break;
      case 'hexagon': {
        const points: Phaser.Geom.Point[] = [];
        for (let i = 0; i < 6; i++) {
          const angle = (Math.PI / 3) * i - Math.PI / 2;
          points.push(new Phaser.Geom.Point(
            Math.cos(angle) * s,
            Math.sin(angle) * s
          ));
        }
        this.shape.fillPoints(points, true);
        break;
      }
      case 'square':
      default:
        this.shape.fillRect(-s, -s, s * 2, s * 2);
        this.shape.strokeRect(-s, -s, s * 2, s * 2);
        break;
    }
  }

  private drawHpBar(): void {
    const barWidth = this.size * 2.5;
    const barHeight = 3;
    const barY = -this.size - 6;

    this.hpBar.clear();

    // Background
    this.hpBar.fillStyle(0x000000, 0.5);
    this.hpBar.fillRect(-barWidth / 2, barY, barWidth, barHeight);

    // HP fill
    const hpRatio = this.currentHp / this.maxHp;
    const fillColor = hpRatio > 0.5 ? 0x66bb6a : hpRatio > 0.25 ? 0xffa726 : 0xef5350;
    this.hpBar.fillStyle(fillColor, 1);
    this.hpBar.fillRect(-barWidth / 2, barY, barWidth * hpRatio, barHeight);
  }

  public takeDamage(damage: number): boolean {
    const effectiveDamage = Math.max(1, damage - this.armor);
    this.currentHp -= effectiveDamage;

    this.drawHpBar();

    if (this.currentHp <= 0) {
      this.isDead = true;
      this.destroy();
      return true;
    }
    return false;
  }

  public moveAlongPath(path: Phaser.Curves.Path, delta: number): void {
    if (this.isDead || this.reachedEnd) return;

    const pathLength = path.getLength();
    const speed = this.baseSpeed * this.speedMultiplier;
    const distanceDelta = (speed * delta) / 1000;
    this.pathT += distanceDelta / pathLength;

    if (this.pathT >= 1) {
      this.pathT = 1;
      this.reachedEnd = true;
      this.destroy();
      return;
    }

    const point = path.getPoint(this.pathT);
    this.setPosition(point.x, point.y);
  }
}
