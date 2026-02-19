import Phaser from 'phaser';
import configData from '../data/config.json';

export class GameOverScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameOver' });
  }

  create(data: { wave?: number }): void {
    const { width, height } = this.cameras.main;

    this.cameras.main.setBackgroundColor(configData.colors.background);

    this.add.text(width / 2, height / 3, '💀 게임 오버', {
      fontSize: '32px',
      color: '#ef5350',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    if (data.wave) {
      this.add.text(width / 2, height / 3 + 50, `웨이브 ${data.wave}까지 도달`, {
        fontSize: '18px',
        color: '#fafafa',
      }).setOrigin(0.5);
    }

    const restartBtn = this.add.text(width / 2, height / 2 + 40, '🔄 다시 시작', {
      fontSize: '20px',
      color: '#42a5f5',
      fontStyle: 'bold',
      backgroundColor: '#2d2d44',
      padding: { x: 20, y: 10 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    restartBtn.on('pointerup', () => {
      this.scene.start('Game');
    });
  }
}
