import Phaser from 'phaser';
import configData from '../data/config.json';
import { createWaypointPath, drawPath } from '../utils/PathHelper';
import { WaveManager } from '../systems/WaveManager';
import { EconomyManager } from '../systems/EconomyManager';
import { SummonSystem } from '../systems/SummonSystem';
import { HUD } from '../ui/HUD';
import { UnitSlots } from '../ui/UnitSlots';
import { ActionBar } from '../ui/ActionBar';
import { Enemy } from '../entities/Enemy';

export class GameScene extends Phaser.Scene {
  private hud!: HUD;
  private unitSlots!: UnitSlots;
  private actionBar!: ActionBar;
  private waveManager!: WaveManager;
  private economy!: EconomyManager;
  private summonSystem!: SummonSystem;
  private gamePath!: Phaser.Curves.Path;
  private pathGraphics!: Phaser.GameObjects.Graphics;
  private lives!: number;
  private gameStarted: boolean = false;

  constructor() {
    super({ key: 'Game' });
  }

  create(): void {
    const { width, height } = this.cameras.main;

    this.lives = configData.player.startingLives;
    this.economy = new EconomyManager();
    this.summonSystem = new SummonSystem();

    // Layout calculations
    const hudHeight = 40;
    const actionBarHeight = 54;
    const slotAreaHeight = 200;
    const mapHeight = height - hudHeight - slotAreaHeight - actionBarHeight - 20;
    const mapY = hudHeight + 5;

    // ---- Map & Path ----
    const { path } = createWaypointPath(10, mapY, width - 20, mapHeight);
    this.gamePath = path;

    // Draw path background
    this.pathGraphics = this.add.graphics();
    // Map area background
    this.pathGraphics.fillStyle(
      Phaser.Display.Color.HexStringToColor(configData.colors.background).color,
      1
    );
    this.pathGraphics.fillRoundedRect(5, mapY - 5, width - 10, mapHeight + 10, 8);

    // Draw the S-path
    drawPath(this.pathGraphics, this.gamePath);

    // Start/End markers
    const startPt = this.gamePath.getPoint(0);
    const endPt = this.gamePath.getPoint(1);

    this.add.text(startPt.x, startPt.y - 16, '▶ START', {
      fontSize: '10px',
      color: '#66bb6a',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(endPt.x, endPt.y + 16, '■ END', {
      fontSize: '10px',
      color: '#ef5350',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // ---- Wave Manager ----
    this.waveManager = new WaveManager(this, this.gamePath, {
      onWaveClear: (reward: number) => this.handleWaveClear(reward),
      onEnemyReachEnd: (enemy: Enemy) => this.handleEnemyReachEnd(enemy),
      onEnemyKilled: (enemy: Enemy) => this.handleEnemyKilled(enemy),
    });

    // ---- HUD ----
    this.hud = new HUD(this, width);
    this.updateHUD();

    // ---- Unit Slots ----
    const slotY = mapY + mapHeight + 10;
    this.unitSlots = new UnitSlots(this, 0, slotY, width);

    // ---- Action Bar ----
    const actionBarY = slotY + this.unitSlots.getGridHeight() + 12;
    this.actionBar = new ActionBar(this, 0, actionBarY, width, {
      onSummon: () => this.handleSummon(),
      onSkip: () => this.handleSkip(),
    });

    // ---- Economy change listener ----
    this.economy.onChange(() => {
      this.updateHUD();
      this.actionBar.updateSummonButton(
        this.economy.canAfford(this.economy.getSummonCost()) && !this.unitSlots.isFull()
      );
    });

    // Initial HUD update
    this.actionBar.updateSummonButton(
      this.economy.canAfford(this.economy.getSummonCost())
    );

    // ---- Start first wave after a short delay ----
    this.time.delayedCall(1500, () => {
      this.gameStarted = true;
      this.waveManager.startNextWave();
      this.updateHUD();
    });
  }

  update(_time: number, delta: number): void {
    if (!this.gameStarted) return;

    this.waveManager.update(delta);

    // Check victory
    if (this.waveManager.isAllWavesClear()) {
      this.scene.start('Victory');
      return;
    }

    // Check game over
    if (this.lives <= 0) {
      this.waveManager.destroy();
      this.scene.start('GameOver', { wave: this.waveManager.currentWave });
      return;
    }
  }

  private handleSummon(): void {
    const cost = this.economy.getSummonCost();
    if (!this.economy.canAfford(cost)) return;

    const emptySlot = this.unitSlots.findEmptySlot();
    if (emptySlot === -1) return;

    this.economy.spend(cost);
    const result = this.summonSystem.roll();
    const unit = this.unitSlots.placeUnit(result.unitType, result.grade, emptySlot);

    if (unit) {
      // Summon animation: scale pop
      unit.setScale(0);
      this.tweens.add({
        targets: unit,
        scaleX: 1,
        scaleY: 1,
        duration: 300,
        ease: 'Back.easeOut',
      });
    }
  }

  private handleSkip(): void {
    if (this.waveManager.skipPrepare()) {
      this.economy.earn(configData.economy.waveSkipBonus);
    }
  }

  private handleWaveClear(reward: number): void {
    this.economy.earn(reward);
    this.updateHUD();

    // Flash wave clear text
    const { width, height } = this.cameras.main;
    const clearText = this.add.text(width / 2, height / 3, `🌊 웨이브 ${this.waveManager.currentWave} 클리어!`, {
      fontSize: '20px',
      color: '#ffd54f',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(200);

    this.tweens.add({
      targets: clearText,
      alpha: 0,
      y: clearText.y - 40,
      duration: 1500,
      onComplete: () => clearText.destroy(),
    });
  }

  private handleEnemyReachEnd(enemy: Enemy): void {
    const damage = enemy.enemyType === 'boss' ? configData.player.bossLifeDamage : 1;
    this.lives -= damage;
    this.updateHUD();

    // Flash red on lives
    if (this.lives > 0) {
      this.cameras.main.flash(200, 255, 0, 0, false, (_cam: Phaser.Cameras.Scene2D.Camera, progress: number) => {
        if (progress === 1) { /* flash done */ }
      });
    }
  }

  private handleEnemyKilled(enemy: Enemy): void {
    const reward = this.economy.getKillReward(enemy.enemyType);
    this.economy.earn(reward);
  }

  private updateHUD(): void {
    this.hud.updateGold(this.economy.gold);
    this.hud.updateLives(this.lives);
    this.hud.updateWave(
      this.waveManager ? this.waveManager.currentWave : 0,
      configData.wave.totalWaves
    );
  }
}
