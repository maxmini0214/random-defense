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
  slowPercent: number;
  slowTimer: number;
  armorReducePercent: number;
  armorReduceTimer: number;
  dotDamage: number;
  dotInterval: number;
  dotTimer: number;
  dotAccum: number;
  stunTimer: number;
  freezeTimer: number;
}

export class Enemy extends Phaser.GameObjects.Container {
  public enemyType: EnemyType;
  public maxHp: number;
  public currentHp: number;
  public baseArmor: number;
  public speedMultiplier: number;
  public baseSpeed: number = 60;
  public isFlying: boolean;
  public pathT: number = 0;
  public isDead: boolean = false;
  public reachedEnd: boolean = false;

  private debuffs: DebuffState;

  private shape: Phaser.GameObjects.Graphics;
  private hpBar: Phaser.GameObjects.Graphics;
  private debuffIndicator: Phaser.GameObjects.Graphics;
  private typeData: EnemyTypeData;
  private size: number;
  private originalColor: number;

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
    this.originalColor = Phaser.Display.Color.HexStringToColor(this.typeData.color).color;

    this.size = type === 'boss' ? 18 : 12;

    this.debuffs = {
      slowPercent: 0, slowTimer: 0,
      armorReducePercent: 0, armorReduceTimer: 0,
      dotDamage: 0, dotInterval: 1, dotTimer: 0, dotAccum: 0,
      stunTimer: 0, freezeTimer: 0,
    };

    this.shape = scene.add.graphics();
    this.drawShape();
    this.add(this.shape);

    this.hpBar = scene.add.graphics();
    this.drawHpBar();
    this.add(this.hpBar);

    this.debuffIndicator = scene.add.graphics();
    this.add(this.debuffIndicator);

    const startPoint = path.getPoint(0);
    this.setPosition(startPoint.x, startPoint.y);

    scene.add.existing(this);
  }

  private drawShape(): void {
    const s = this.size;
    // Determine color based on debuff state
    let color = this.originalColor;
    if (this.debuffs.freezeTimer > 0) {
      color = 0x26c6da; // Cyan for frozen
    } else if (this.debuffs.slowTimer > 0) {
      // Blend toward blue for slow
      color = this.blendColor(this.originalColor, 0x42a5f5, 0.4);
    }

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

  private blendColor(c1: number, c2: number, t: number): number {
    const r1 = (c1 >> 16) & 0xFF;
    const g1 = (c1 >> 8) & 0xFF;
    const b1 = c1 & 0xFF;
    const r2 = (c2 >> 16) & 0xFF;
    const g2 = (c2 >> 8) & 0xFF;
    const b2 = c2 & 0xFF;
    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);
    return (r << 16) | (g << 8) | b;
  }

  private drawHpBar(): void {
    const barWidth = this.size * 2.5;
    const barHeight = 3;
    const barY = -this.size - 6;

    this.hpBar.clear();
    this.hpBar.fillStyle(0x000000, 0.5);
    this.hpBar.fillRect(-barWidth / 2, barY, barWidth, barHeight);

    const hpRatio = this.currentHp / this.maxHp;
    const fillColor = hpRatio > 0.5 ? 0x66bb6a : hpRatio > 0.25 ? 0xffa726 : 0xef5350;
    this.hpBar.fillStyle(fillColor, 1);
    this.hpBar.fillRect(-barWidth / 2, barY, barWidth * hpRatio, barHeight);
  }

  private drawDebuffIndicator(): void {
    this.debuffIndicator.clear();
    const y = this.size + 5;
    let x = -10;
    const iconSize = 3;

    // Slow: blue snowflake + foot-level ice
    if (this.debuffs.slowTimer > 0) {
      this.debuffIndicator.fillStyle(0x42a5f5, 0.8);
      this.debuffIndicator.fillCircle(x, y, iconSize);
      this.debuffIndicator.lineStyle(1, 0x42a5f5, 0.5);
      this.debuffIndicator.strokeCircle(x, y, iconSize + 1.5);
      // Ice effect at feet
      this.debuffIndicator.fillStyle(0x26c6da, 0.25);
      this.debuffIndicator.fillEllipse(0, this.size + 2, this.size * 1.5, 4);
      x += 8;
    }

    // Armor reduce: red broken shield icon
    if (this.debuffs.armorReduceTimer > 0) {
      this.debuffIndicator.fillStyle(0xff5252, 0.9);
      this.debuffIndicator.fillTriangle(x, y + iconSize, x - iconSize, y - iconSize, x + iconSize, y - iconSize);
      // Broken shield crack line
      this.debuffIndicator.lineStyle(1, 0xff5252, 0.6);
      this.debuffIndicator.lineBetween(x - 1, y - iconSize, x + 1, y + iconSize);
      x += 8;
    }

    // DoT: green poison bubbles
    if (this.debuffs.dotTimer > 0) {
      this.debuffIndicator.fillStyle(0x66bb6a, 0.9);
      this.debuffIndicator.fillCircle(x, y, iconSize);
      this.debuffIndicator.fillStyle(0x66bb6a, 0.5);
      this.debuffIndicator.fillCircle(x + 2, y - 2, 1.5);
      this.debuffIndicator.fillCircle(x - 1, y - 3, 1);
      x += 8;
    }

    // Stun: yellow star
    if (this.debuffs.stunTimer > 0 && this.debuffs.freezeTimer <= 0) {
      this.debuffIndicator.fillStyle(0xffd54f, 0.9);
      // Draw a simple star shape
      this.drawStar(this.debuffIndicator, x, y - 2, 4, 5);
      x += 8;
    }

    // Freeze: cyan crystal with flash
    if (this.debuffs.freezeTimer > 0) {
      this.debuffIndicator.fillStyle(0x26c6da, 0.9);
      this.debuffIndicator.fillCircle(x, y, iconSize + 1);
      this.debuffIndicator.lineStyle(1.5, 0xffffff, 0.6);
      this.debuffIndicator.strokeCircle(x, y, iconSize + 2);

      // Frozen flash on the shape
      const flash = 0.5 + Math.sin(Date.now() / 100) * 0.3;
      this.shape.setAlpha(flash);
    } else {
      this.shape.setAlpha(1);
    }
  }

  private drawStar(g: Phaser.GameObjects.Graphics, cx: number, cy: number, r: number, points: number): void {
    const innerR = r * 0.4;
    for (let i = 0; i < points; i++) {
      const outerAngle = (Math.PI * 2 * i) / points - Math.PI / 2;
      const innerAngle = outerAngle + Math.PI / points;
      const ox = cx + Math.cos(outerAngle) * r;
      const oy = cy + Math.sin(outerAngle) * r;
      g.fillCircle(ox, oy, 1);
    }
  }

  public get armor(): number {
    const reduction = this.debuffs.armorReducePercent;
    return Math.max(0, Math.round(this.baseArmor * (1 - reduction)));
  }

  public applySlow(percent: number, duration: number): void {
    if (percent > this.debuffs.slowPercent || this.debuffs.slowTimer <= 0) {
      this.debuffs.slowPercent = percent;
    }
    this.debuffs.slowTimer = Math.max(this.debuffs.slowTimer, duration);
  }

  public applyArmorReduce(percent: number, duration: number): void {
    if (percent > this.debuffs.armorReducePercent || this.debuffs.armorReduceTimer <= 0) {
      this.debuffs.armorReducePercent = percent;
    }
    this.debuffs.armorReduceTimer = Math.max(this.debuffs.armorReduceTimer, duration);
  }

  public applyDot(damage: number, interval: number, duration: number): void {
    this.debuffs.dotDamage = Math.max(this.debuffs.dotDamage, damage);
    this.debuffs.dotInterval = interval;
    this.debuffs.dotTimer = Math.max(this.debuffs.dotTimer, duration);
  }

  public applyStun(duration: number): void {
    this.debuffs.stunTimer = Math.max(this.debuffs.stunTimer, duration);
  }

  public applyFreeze(duration: number): void {
    this.debuffs.freezeTimer = duration;
    this.debuffs.stunTimer = Math.max(this.debuffs.stunTimer, duration);
  }

  public isStunned(): boolean {
    return this.debuffs.stunTimer > 0 || this.debuffs.freezeTimer > 0;
  }

  public takeDamage(damage: number): boolean {
    const effectiveDamage = Math.max(1, damage - this.armor);
    this.currentHp -= effectiveDamage;

    this.drawHpBar();

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
    if (this.debuffs.slowTimer > 0) {
      this.debuffs.slowTimer -= deltaSec;
      if (this.debuffs.slowTimer <= 0) {
        this.debuffs.slowPercent = 0;
        this.debuffs.slowTimer = 0;
      }
    }

    if (this.debuffs.armorReduceTimer > 0) {
      this.debuffs.armorReduceTimer -= deltaSec;
      if (this.debuffs.armorReduceTimer <= 0) {
        this.debuffs.armorReducePercent = 0;
        this.debuffs.armorReduceTimer = 0;
      }
    }

    if (this.debuffs.dotTimer > 0) {
      this.debuffs.dotAccum += deltaSec;
      if (this.debuffs.dotAccum >= this.debuffs.dotInterval) {
        this.debuffs.dotAccum -= this.debuffs.dotInterval;
        this.takeDamage(this.debuffs.dotDamage);
        // Green poison particle
        this.spawnDotParticle();
      }
      this.debuffs.dotTimer -= deltaSec;
      if (this.debuffs.dotTimer <= 0) {
        this.debuffs.dotDamage = 0;
        this.debuffs.dotTimer = 0;
        this.debuffs.dotAccum = 0;
      }
    }

    if (this.debuffs.stunTimer > 0) {
      this.debuffs.stunTimer -= deltaSec;
    }

    if (this.debuffs.freezeTimer > 0) {
      this.debuffs.freezeTimer -= deltaSec;
    }

    // Redraw shape when debuff state changes (color change for slow/freeze)
    if (this.debuffs.slowTimer > 0 || this.debuffs.freezeTimer > 0) {
      this.drawShape();
    } else if (this.shape.alpha !== 1) {
      this.drawShape();
    }

    this.drawDebuffIndicator();
  }

  /** Spawn a small green particle for DoT visual */
  private spawnDotParticle(): void {
    if (!this.scene || !this.active) return;
    const p = this.scene.add.graphics();
    p.fillStyle(0x66bb6a, 0.7);
    p.fillCircle(0, 0, 2);
    p.setPosition(this.x + (Math.random() - 0.5) * 8, this.y);
    p.setDepth(140);

    this.scene.tweens.add({
      targets: p,
      y: p.y - 12,
      alpha: 0,
      duration: 400,
      onComplete: () => p.destroy(),
    });
  }

  public moveAlongPath(path: Phaser.Curves.Path, delta: number): void {
    if (this.isDead || this.reachedEnd) return;

    const deltaSec = delta / 1000;
    this.updateDebuffs(deltaSec);

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
