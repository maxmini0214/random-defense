import Phaser from 'phaser';
import configData from '../data/config.json';

export class VictoryScene extends Phaser.Scene {
  constructor() {
    super({ key: 'Victory' });
  }

  create(): void {
    const { width, height } = this.cameras.main;

    this.cameras.main.setBackgroundColor(configData.colors.background);

    this.add.text(width / 2, height / 3, '🎉 승리!', {
      fontSize: '36px',
      color: '#ffd54f',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(width / 2, height / 3 + 50, '모든 웨이브를 클리어했습니다!', {
      fontSize: '16px',
      color: '#fafafa',
    }).setOrigin(0.5);

    const restartBtn = this.add.text(width / 2, height / 2 + 40, '🔄 다시 시작', {
      fontSize: '20px',
      color: '#ffd54f',
      fontStyle: 'bold',
      backgroundColor: '#2d2d44',
      padding: { x: 20, y: 10 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    restartBtn.on('pointerup', () => {
      this.scene.start('Game');
    });
  }
}
