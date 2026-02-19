import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'Boot' });
  }

  preload(): void {
    // Create loading bar
    const { width, height } = this.cameras.main;
    const barW = width * 0.6;
    const barH = 20;
    const barY = height / 2;

    const bg = this.add.rectangle(width / 2, barY, barW, barH, 0x2d2d44);
    bg.setStrokeStyle(2, 0xfafafa);

    const fill = this.add.rectangle(width / 2 - barW / 2 + 2, barY, 0, barH - 4, 0x42a5f5);
    fill.setOrigin(0, 0.5);

    const titleText = this.add.text(width / 2, barY - 60, '🎲 다이스 가디언즈', {
      fontSize: '22px',
      color: '#ffd54f',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    const text = this.add.text(width / 2, barY - 30, '로딩 중...', {
      fontSize: '14px',
      color: '#fafafa',
    }).setOrigin(0.5);

    this.load.on('progress', (value: number) => {
      fill.width = (barW - 4) * value;
    });

    this.load.on('complete', () => {
      text.setText('완료!');
    });

    // All data is imported as ES modules (JSON), no need for Phaser loader.
    // Future asset loading (sprites, audio) goes here.
  }

  create(): void {
    // Brief pause on loading screen, then start game
    this.time.delayedCall(500, () => {
      this.scene.start('Game');
    });
  }
}
