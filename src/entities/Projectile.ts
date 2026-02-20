import Phaser from 'phaser';
import { Enemy } from './Enemy';

export type ProjectileStyle = 'default' | 'arrow' | 'mage' | 'supporter' | 'electric';

export class Projectile extends Phaser.GameObjects.Container {
  private target: Enemy;
  private speed: number;
  private damage: number;
  private onHit: (enemy: Enemy) => void;
  private dot: Phaser.GameObjects.Graphics;
  private trail: Phaser.GameObjects.Graphics;
  public isDone: boolean = false;
  private color: number;
  private style: ProjectileStyle;
  private trailTimer: number = 0;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    target: Enemy,
    damage: number,
    color: number,
    onHit: (enemy: Enemy) => void,
    speed: number = 300,
    style: ProjectileStyle = 'default'
  ) {
    super(scene, x, y);

    this.target = target;
    this.damage = damage;
    this.color = color;
    this.onHit = onHit;
    this.speed = speed;
    this.style = style;

    // Trail effect
    this.trail = scene.add.graphics();
    this.add(this.trail);

    // Projectile shape based on style
    this.dot = scene.add.graphics();
    this.drawProjectile();
    this.add(this.dot);

    this.setDepth(150);
    scene.add.existing(this);
  }

  private drawProjectile(): void {
    this.dot.clear();

    switch (this.style) {
      case 'arrow':
        // Small, fast arrow shape (elongated triangle)
        this.dot.fillStyle(this.color, 1);
        this.dot.fillTriangle(4, 0, -3, -2, -3, 2);
        this.dot.lineStyle(0.5, 0xffffff, 0.4);
        break;

      case 'mage':
        // Large, glowing orb
        this.dot.fillStyle(this.color, 0.4);
        this.dot.fillCircle(0, 0, 6);
        this.dot.fillStyle(this.color, 0.8);
        this.dot.fillCircle(0, 0, 4);
        this.dot.fillStyle(0xffffff, 0.5);
        this.dot.fillCircle(-1, -1, 1.5);
        break;

      case 'supporter':
        // Small golden sparkle
        this.dot.fillStyle(0xffee58, 0.8);
        this.dot.fillCircle(0, 0, 2.5);
        this.dot.fillStyle(0xffffff, 0.5);
        this.dot.fillCircle(0, 0, 1);
        break;

      case 'electric':
        // Electric bolt (jagged)
        this.dot.fillStyle(this.color, 0.9);
        this.dot.fillCircle(0, 0, 3);
        // Lightning sparks
        this.dot.lineStyle(1, 0xffffff, 0.6);
        this.dot.lineBetween(-3, -3, 1, 0);
        this.dot.lineBetween(3, 2, -1, -1);
        break;

      default:
        // Standard circle
        this.dot.fillStyle(this.color, 1);
        this.dot.fillCircle(0, 0, 3);
        this.dot.lineStyle(1, 0xffffff, 0.6);
        this.dot.strokeCircle(0, 0, 3);
        break;
    }
  }

  public update(delta: number): void {
    if (this.isDone) return;

    if (this.target.isDead || !this.target.active) {
      this.isDone = true;
      this.destroy();
      return;
    }

    const tx = this.target.x;
    const ty = this.target.y;
    const dx = tx - this.x;
    const dy = ty - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    const step = (this.speed * delta) / 1000;

    if (dist <= step + 5) {
      this.onHit(this.target);
      this.isDone = true;
      this.destroy();
      return;
    }

    const nx = dx / dist;
    const ny = dy / dist;
    this.x += nx * step;
    this.y += ny * step;

    // Rotate arrow/electric projectiles to face direction
    if (this.style === 'arrow' || this.style === 'electric') {
      this.dot.setRotation(Math.atan2(ny, nx));
    }

    // Draw trail based on style
    this.trailTimer += delta;
    this.trail.clear();

    switch (this.style) {
      case 'arrow':
        // Short thin trail
        this.trail.fillStyle(this.color, 0.25);
        this.trail.fillCircle(-nx * 5, -ny * 5, 1.5);
        break;

      case 'mage':
        // Glowing purple trail particles
        this.trail.fillStyle(this.color, 0.3);
        this.trail.fillCircle(-nx * 8, -ny * 8, 3);
        this.trail.fillStyle(this.color, 0.15);
        this.trail.fillCircle(-nx * 14, -ny * 14, 2);
        break;

      case 'electric':
        // Zigzag electric trail
        this.trail.lineStyle(1, this.color, 0.4);
        const jx = (Math.random() - 0.5) * 4;
        const jy = (Math.random() - 0.5) * 4;
        this.trail.lineBetween(0, 0, -nx * 8 + jx, -ny * 8 + jy);
        this.trail.lineBetween(-nx * 8 + jx, -ny * 8 + jy, -nx * 14, -ny * 14);
        break;

      case 'supporter':
        // Gentle glow trail
        this.trail.fillStyle(0xffee58, 0.2);
        this.trail.fillCircle(-nx * 5, -ny * 5, 1.5);
        break;

      default:
        this.trail.fillStyle(this.color, 0.3);
        this.trail.fillCircle(-nx * 6, -ny * 6, 2);
        break;
    }
  }
}
