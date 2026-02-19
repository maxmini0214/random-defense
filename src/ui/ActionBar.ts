import Phaser from 'phaser';
import configData from '../data/config.json';

interface ActionBarCallbacks {
  onSummon: () => void;
  onSkip: () => void;
}

export class ActionBar extends Phaser.GameObjects.Container {
  private summonButton: Phaser.GameObjects.Container;
  private skipButton: Phaser.GameObjects.Container;
  private sellZone: Phaser.GameObjects.Container;
  private summonText: Phaser.GameObjects.Text;
  private callbacks: ActionBarCallbacks;
  private sellZoneBg!: Phaser.GameObjects.Graphics;
  private sellZoneText!: Phaser.GameObjects.Text;

  // Sell zone bounds in scene coordinates
  public sellZoneBounds: { x: number; y: number; width: number; height: number } = {
    x: 0, y: 0, width: 0, height: 0,
  };

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    width: number,
    callbacks: ActionBarCallbacks
  ) {
    super(scene, x, y);
    this.callbacks = callbacks;

    const btnHeight = 44; // Minimum touch target 44px
    const btnPadding = 8;

    // 3 buttons in a row: Summon, Sell, Skip
    const btnWidth = (width - btnPadding * 4) / 3;

    // Summon button
    this.summonButton = this.createButton(
      btnPadding,
      0,
      btnWidth,
      btnHeight,
      `🎲 소환 ${configData.economy.summonCost}G`,
      0x42a5f5,
      () => this.callbacks.onSummon()
    );
    this.summonText = this.summonButton.getAt(1) as Phaser.GameObjects.Text;
    this.add(this.summonButton);

    // Sell zone (center)
    const sellX = btnPadding * 2 + btnWidth;
    this.sellZone = this.createSellZone(sellX, 0, btnWidth, btnHeight);
    this.add(this.sellZone);

    // Store sell zone bounds in scene coordinates
    this.sellZoneBounds = {
      x: x + sellX,
      y: y,
      width: btnWidth,
      height: btnHeight,
    };

    // Skip button
    this.skipButton = this.createButton(
      btnPadding * 3 + btnWidth * 2,
      0,
      btnWidth,
      btnHeight,
      '⏭️ 스킵 +20G',
      0x66bb6a,
      () => this.callbacks.onSkip()
    );
    this.add(this.skipButton);

    scene.add.existing(this);
    this.setDepth(100);
  }

  private createSellZone(
    x: number,
    y: number,
    width: number,
    height: number
  ): Phaser.GameObjects.Container {
    const container = this.scene.add.container(x, y);

    this.sellZoneBg = this.scene.add.graphics();
    this.sellZoneBg.fillStyle(0xef5350, 0.3);
    this.sellZoneBg.fillRoundedRect(0, 0, width, height, 8);
    this.sellZoneBg.lineStyle(1, 0xef5350, 0.5);
    this.sellZoneBg.strokeRoundedRect(0, 0, width, height, 8);
    container.add(this.sellZoneBg);

    this.sellZoneText = this.scene.add.text(width / 2, height / 2, `💰 판매 ${configData.economy.sellReturn}G`, {
      fontSize: '13px',
      color: '#fafafa',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    container.add(this.sellZoneText);

    return container;
  }

  /**
   * Highlight the sell zone when a unit is being dragged.
   */
  public highlightSellZone(active: boolean): void {
    const width = this.sellZoneBounds.width;
    const height = this.sellZoneBounds.height;

    this.sellZoneBg.clear();
    if (active) {
      this.sellZoneBg.fillStyle(0xef5350, 0.7);
      this.sellZoneBg.fillRoundedRect(0, 0, width, height, 8);
      this.sellZoneBg.lineStyle(2, 0xffffff, 0.8);
      this.sellZoneBg.strokeRoundedRect(0, 0, width, height, 8);
      this.sellZoneText.setScale(1.1);
    } else {
      this.sellZoneBg.fillStyle(0xef5350, 0.3);
      this.sellZoneBg.fillRoundedRect(0, 0, width, height, 8);
      this.sellZoneBg.lineStyle(1, 0xef5350, 0.5);
      this.sellZoneBg.strokeRoundedRect(0, 0, width, height, 8);
      this.sellZoneText.setScale(1);
    }
  }

  /**
   * Check if scene coordinates are within the sell zone.
   */
  public isOverSellZone(sceneX: number, sceneY: number): boolean {
    const b = this.sellZoneBounds;
    return sceneX >= b.x && sceneX <= b.x + b.width &&
           sceneY >= b.y && sceneY <= b.y + b.height;
  }

  private createButton(
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    color: number,
    onClick: () => void
  ): Phaser.GameObjects.Container {
    const container = this.scene.add.container(x, y);

    const bg = this.scene.add.graphics();
    bg.fillStyle(color, 0.85);
    bg.fillRoundedRect(0, 0, width, height, 8);
    bg.lineStyle(1, 0xffffff, 0.3);
    bg.strokeRoundedRect(0, 0, width, height, 8);
    container.add(bg);

    const text = this.scene.add.text(width / 2, height / 2, label, {
      fontSize: '13px',
      color: '#fafafa',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    container.add(text);

    const hitArea = this.scene.add.rectangle(width / 2, height / 2, width, height)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .setAlpha(0.001);
    container.add(hitArea);

    hitArea.on('pointerdown', () => {
      bg.clear();
      bg.fillStyle(color, 0.6);
      bg.fillRoundedRect(0, 0, width, height, 8);
    });

    hitArea.on('pointerup', () => {
      bg.clear();
      bg.fillStyle(color, 0.85);
      bg.fillRoundedRect(0, 0, width, height, 8);
      bg.lineStyle(1, 0xffffff, 0.3);
      bg.strokeRoundedRect(0, 0, width, height, 8);
      onClick();
    });

    hitArea.on('pointerout', () => {
      bg.clear();
      bg.fillStyle(color, 0.85);
      bg.fillRoundedRect(0, 0, width, height, 8);
      bg.lineStyle(1, 0xffffff, 0.3);
      bg.strokeRoundedRect(0, 0, width, height, 8);
    });

    return container;
  }

  public updateSummonButton(canAfford: boolean): void {
    this.summonText.setAlpha(canAfford ? 1 : 0.4);
  }
}
