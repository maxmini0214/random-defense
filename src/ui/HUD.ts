import Phaser from 'phaser';
import configData from '../data/config.json';

export class HUD extends Phaser.GameObjects.Container {
  private goldText: Phaser.GameObjects.Text;
  private livesText: Phaser.GameObjects.Text;
  private waveText: Phaser.GameObjects.Text;
  private background: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, width: number) {
    super(scene, 0, 0);

    const hudHeight = 40;
    const colors = configData.colors;

    // Background bar
    this.background = scene.add.graphics();
    this.background.fillStyle(
      Phaser.Display.Color.HexStringToColor(colors.ui.background).color,
      0.9
    );
    this.background.fillRect(0, 0, width, hudHeight);
    this.background.lineStyle(1, 0xfafafa, 0.2);
    this.background.lineBetween(0, hudHeight, width, hudHeight);
    this.add(this.background);

    const textStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontSize: '15px',
      color: colors.ui.text,
      fontStyle: 'bold',
    };

    const padding = 15;
    const sectionWidth = (width - padding * 2) / 3;

    // Gold
    this.goldText = scene.add.text(padding, 12, '', textStyle).setOrigin(0, 0.5);
    this.add(this.goldText);

    // Lives
    this.livesText = scene.add.text(padding + sectionWidth, 12, '', textStyle).setOrigin(0, 0.5);
    this.add(this.livesText);

    // Wave
    this.waveText = scene.add.text(padding + sectionWidth * 2, 12, '', textStyle).setOrigin(0, 0.5);
    this.add(this.waveText);

    scene.add.existing(this);
    this.setDepth(100);
  }

  public updateGold(gold: number): void {
    this.goldText.setText(`💰 ${gold}G`);
  }

  public updateLives(lives: number): void {
    this.livesText.setText(`❤️ ${lives}`);
  }

  public updateWave(current: number, total: number): void {
    this.waveText.setText(`🌊 W${current}/${total}`);
  }
}
