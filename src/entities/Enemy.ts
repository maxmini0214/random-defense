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

interface DebuffState {
  /** Slow: multiplicative speed reduction (0.0 = no slow, 0.5 = 50% slower) */
  slowPercent: number;
  slowTimer: number;
  /** Armor reduction: flat percent of base armor removed */
  armorReducePercent: number;
  armorReduceTimer: number;
  /** DoT: damage per tick */
  dotDamage: number;
  dotInterval: number;
  dotTimer: number;
  dotAccum: number;
  /** Stun */
  stunTimer: number;
  /** Freeze (periodic stun from special mythic) */
  freezeTimer: number;
}

export class Enemy extends Phaser.GameObjects.Container {
  public enemyType: EnemyType;
  public maxHp: number;
  public currentHp: number;
  public baseArmor: number;
  public speedMultiplier: number;
  public baseSpeed: number = 60; // pixels per second
  public isFlying: boolean;
  public pathT: number = 0; // 0..1 progress along path
  public isDead: boolean = false;
  public reachedEnd: boolean = false;

  private debuffs: DebuffState;

  private shape: Phaser.GameObjects.Graphics;
  private hpBar: Phaser.GameObjects.Graphics;
  private debuffIndicator: Phaser.GameObjects.Graphics;
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
    this.baseArmor = this.typeData.armor;
    this.speedMultiplier = this.typeData.speedMultiplier;
    this.isFlying = type === 'flying';

    this.size = type === 'boss' ? 18 : 12;

    this.debuffs = {
      slowPercent: 0,
      slowTimer: 0,
      armorReducePercent: 0,
      armorReduceTimer: 0,
      dotDamage: 0,
      dotInterval: 1,
      dotTimer: 0,
      dotAccum: 0,
      stunTimer: 0,
      freezeTimer: 0,
    };

    // Draw enemy shape
    this.shape = scene.add.graphics();
    this.drawShape();
    this.add(this.shape);

    // HP bar
    this.hpBar = scene.add.graphics();
    this.drawHpBar();
    this.add(this.hpBar);

    // Debuff indicator
    this.debuffIndicator = scene.add.graphics();
    this.add(this.debuffIndicator);

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

  private drawDebuffIndicator(): void {
    this.debuffIndicator.clear();
    const y = this.size + 5;
    let x = -8;
    const iconSize = 3;

    // Slow: blue snowflake-like icon
    if (this.debuffs.slowTimer > 0) {
      this.debuffIndicator.fillStyle(0x42a5f5, 0.9);
      this.debuffIndicator.fillCircle(x, y, iconSize);
      this.debuffIndicator.lineStyle(1, 0x42a5f5, 0.6);
      this.debuffIndicator.strokeCircle(x, y, iconSize + 1.5);
      x += 8;
    }
    // Armor reduce: red down-arrow icon
    if (this.debuffs.armorReduceTimer > 0) {
      this.debuffIndicator.fillStyle(0xff5252, 0.9);
      this.debuffIndicator.fillTriangle(x, y + iconSize, x - iconSize, y - iconSize, x + iconSize, y - iconSize);
      x += 8;
    }
    // DoT: green poison icon
    if (this.debuffs.dotTimer > 0) {
      this.debuffIndicator.fillStyle(0x66bb6a, 0.9);
      this.debuffIndicator.fillCircle(x, y, iconSize);
      this.debuffIndicator.fillStyle(0x66bb6a, 0.5);
      this.debuffIndicator.fillCircle(x + 2, y - 2, 1.5);
      x += 8;
    }
    // Stun/Freeze: yellow/cyan star
    if (this.debuffs.stunTimer > 0 || this.debuffs.freezeTimer > 0) {
      const isFrozen = this.debuffs.freezeTimer > 0;
      const color = isFrozen ? 0x26c6da : 0xffd54f;
      this.debuffIndicator.fillStyle(color, 0.9);
      this.debuffIndicator.fillCircle(x, y, iconSize);
      this.debuffIndicator.lineStyle(1.5, color, 0.5);
      this.debuffIndicator.strokeCircle(x, y, iconSize + 2);

      // Flash effect for stun/freeze
      if (isFrozen) {
        this.shape.setAlpha(0.5 + Math.sin(Date.now() / 100) * 0.3);
      }
    }
  }

  /** Get effective armor after debuffs */
  public get armor(): number {
    const reduction = this.debuffs.armorReducePercent;
    return Math.max(0, Math.round(this.baseArmor * (1 - reduction)));
  }

  /** Apply slow debuff */
  public applySlow(percent: number, duration: number): void {
    // Keep strongest slow
    if (percent > this.debuffs.slowPercent || this.debuffs.slowTimer <= 0) {
      this.debuffs.slowPercent = percent;
    }
    this.debuffs.slowTimer = Math.max(this.debuffs.slowTimer, duration);
  }

  /** Apply armor reduction debuff */
  public applyArmorReduce(percent: number, duration: number): void {
    if (percent > this.debuffs.armorReducePercent || this.debuffs.armorReduceTimer <= 0) {
      this.debuffs.armorReducePercent = percent;
    }
    this.debuffs.armorReduceTimer = Math.max(this.debuffs.armorReduceTimer, duration);
  }

  /** Apply DoT (damage over time) */
  public applyDot(damage: number, interval: number, duration: number): void {
    this.debuffs.dotDamage = Math.max(this.debuffs.dotDamage, damage);
    this.debuffs.dotInterval = interval;
    this.debuffs.dotTimer = Math.max(this.debuffs.dotTimer, duration);
  }

  /** Apply stun */
  public applyStun(duration: number): void {
    this.debuffs.stunTimer = Math.max(this.debuffs.stunTimer, duration);
  }

  /** Apply freeze (from special mythic periodic) */
  public applyFreeze(duration: number): void {
    this.debuffs.freezeTimer = duration;
    this.debuffs.stunTimer = Math.max(this.debuffs.stunTimer, duration);
  }

  /** Is this enemy currently stunned/frozen? */
  public isStunned(): boolean {
    return this.debuffs.stunTimer > 0 || this.debuffs.freezeTimer > 0;
  }

  public takeDamage(damage: number): boolean {
    const effectiveDamage = Math.max(1, damage - this.armor);
    this.currentHp -= effectiveDamage;

    this.drawHpBar();

    // Hit flash
    if (this.shape && this.active) {
      this.scene?.tweens.add({
        targets: this.shape,
        alpha: 0.5,
        duration: 50,
        yoyo: true,
      });
    }

    if (this.currentHp <= 0) {
      this.isDead = true;
      this.destroy();
      return true;
    }
    return false;
  }

  public updateDebuffs(deltaSec: number): void {
    // Slow
    if (this.debuffs.slowTimer > 0) {
      this.debuffs.slowTimer -= deltaSec;
      if (this.debuffs.slowTimer <= 0) {
        this.debuffs.slowPercent = 0;
        this.debuffs.slowTimer = 0;
      }
    }

    // Armor reduce
    if (this.debuffs.armorReduceTimer > 0) {
      this.debuffs.armorReduceTimer -= deltaSec;
      if (this.debuffs.armorReduceTimer <= 0) {
        this.debuffs.armorReducePercent = 0;
        this.debuffs.armorReduceTimer = 0;
      }
    }

    // DoT
    if (this.debuffs.dotTimer > 0) {
      this.debuffs.dotAccum += deltaSec;
      if (this.debuffs.dotAccum >= this.debuffs.dotInterval) {
        this.debuffs.dotAccum -= this.debuffs.dotInterval;
        this.takeDamage(this.debuffs.dotDamage);
      }
      this.debuffs.dotTimer -= deltaSec;
      if (this.debuffs.dotTimer <= 0) {
        this.debuffs.dotDamage = 0;
        this.debuffs.dotTimer = 0;
        this.debuffs.dotAccum = 0;
      }
    }

    // Stun
    if (this.debuffs.stunTimer > 0) {
      this.debuffs.stunTimer -= deltaSec;
    }

    // Freeze
    if (this.debuffs.freezeTimer > 0) {
      this.debuffs.freezeTimer -= deltaSec;
    }

    this.drawDebuffIndicator();
  }

  public moveAlongPath(path: Phaser.Curves.Path, delta: number): void {
    if (this.isDead || this.reachedEnd) return;

    // Update debuffs
    const deltaSec = delta / 1000;
    this.updateDebuffs(deltaSec);

    // If stunned, don't move
    if (this.isStunned()) return;

    const pathLength = path.getLength();
    const slowMult = 1 - this.debuffs.slowPercent;
    const speed = this.baseSpeed * this.speedMultiplier * slowMult;
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
