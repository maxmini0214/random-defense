import Phaser from 'phaser';
import { Enemy } from './Enemy';

export class Projectile extends Phaser.GameObjects.Container {
  private target: Enemy;
  private speed: number;
  private damage: number;
  private onHit: (enemy: Enemy) => void;
  private dot: Phaser.GameObjects.Graphics;
  private trail: Phaser.GameObjects.Graphics;
  public isDone: boolean = false;
  private color: number;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    target: Enemy,
    damage: number,
    color: number,
    onHit: (enemy: Enemy) => void,
    speed: number = 300
  ) {
    super(scene, x, y);

    this.target = target;
    this.damage = damage;
    this.color = color;
    this.onHit = onHit;
    this.speed = speed;

    // Trail effect
    this.trail = scene.add.graphics();
    this.add(this.trail);

    // Projectile dot
    this.dot = scene.add.graphics();
    this.dot.fillStyle(color, 1);
    this.dot.fillCircle(0, 0, 3);
    this.dot.lineStyle(1, 0xffffff, 0.6);
    this.dot.strokeCircle(0, 0, 3);
    this.add(this.dot);

    this.setDepth(150);
    scene.add.existing(this);
  }

  public update(delta: number): void {
    if (this.isDone) return;

    // If target is dead or destroyed, just remove
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
      // Hit!
      this.onHit(this.target);
      this.isDone = true;
      this.destroy();
      return;
    }

    // Move toward target
    const nx = dx / dist;
    const ny = dy / dist;
    this.x += nx * step;
    this.y += ny * step;

    // Draw small trail
    this.trail.clear();
    this.trail.fillStyle(this.color, 0.3);
    this.trail.fillCircle(-nx * 6, -ny * 6, 2);
  }
}
