import Phaser from 'phaser';

/**
 * Placeholder for projectile visuals (D4+).
 * For now, attacks are instant-hit.
 */
export class Projectile extends Phaser.GameObjects.Container {
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);
    scene.add.existing(this);
  }
}
