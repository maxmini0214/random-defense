import Phaser from 'phaser';
import configData from '../data/config.json';
import { Unit, UnitType, UnitGrade, UnitBuff } from '../entities/Unit';
import { Enemy } from '../entities/Enemy';
import { Projectile } from '../entities/Projectile';
import { WaveManager } from '../systems/WaveManager';
import { EconomyManager } from '../systems/EconomyManager';
import { SummonSystem } from '../systems/SummonSystem';
import { MergeSystem } from '../systems/MergeSystem';
import { ScoreManager } from '../systems/ScoreManager';
import { soundManager } from '../systems/SoundManager';
import { HUD } from '../ui/HUD';
import { ActionBar } from '../ui/ActionBar';
import { MapGrid } from '../ui/MapGrid';
import { createWaypointPath, drawPath } from '../utils/PathHelper';

interface DragState {
  unit: Unit;
  originCol: number;
  originRow: number;
  ghost: Phaser.GameObjects.Container;
}

export class GameScene extends Phaser.Scene {
  private hud!: HUD;
  private actionBar!: ActionBar;
  private mapGrid!: MapGrid;
  private path!: Phaser.Curves.Path;
  private pathGraphics!: Phaser.GameObjects.Graphics;

  private waveManager!: WaveManager;
  private economy!: EconomyManager;
  private summonSystem!: SummonSystem;
  private scoreManager!: ScoreManager;

  private lives: number = configData.player.startingLives;
  private gameOver: boolean = false;
  private startTime: number = 0;

  // Drag state
  private dragState: DragState | null = null;

  // Effect layers
  private effectLayer!: Phaser.GameObjects.Container;
  private supporterLineGraphics!: Phaser.GameObjects.Graphics;

  // All active projectiles
  private allProjectiles: Projectile[] = [];

  constructor() {
    super({ key: 'Game' });
  }

  create(): void {
    const { width, height } = this.cameras.main;
    this.cameras.main.setBackgroundColor(configData.colors.background);

    this.startTime = Math.floor(Date.now() / 1000);
    this.lives = configData.player.startingLives;
    this.gameOver = false;
    this.allProjectiles = [];

    // Systems
    this.economy = new EconomyManager();
    this.summonSystem = new SummonSystem();
    this.scoreManager = new ScoreManager();

    // Map area
    const hudHeight = 40;
    const actionBarHeight = 54;
    const mapY = hudHeight + 4;
    const mapH = height - hudHeight - actionBarHeight - 12;
    const mapW = width;

    // Path
    const { path } = createWaypointPath(0, mapY, mapW, mapH);
    this.path = path;

    this.pathGraphics = this.add.graphics();
    this.pathGraphics.setDepth(10);
    drawPath(this.pathGraphics, this.path);

    // Map grid for unit placement
    this.mapGrid = new MapGrid(this, 0, mapY, mapW, mapH, this.path);

    // Effect layer (between units and UI)
    this.effectLayer = this.add.container(0, 0);
    this.effectLayer.setDepth(130);

    // Supporter connection lines
    this.supporterLineGraphics = this.add.graphics();
    this.supporterLineGraphics.setDepth(99);

    // HUD
    this.hud = new HUD(this, width);
    this.updateHUD();

    // Action bar
    this.actionBar = new ActionBar(this, 0, height - actionBarHeight - 4, width, {
      onSummon: () => this.handleSummon(),
      onSkip: () => this.handleSkip(),
    });

    // Wave manager
    this.waveManager = new WaveManager(this, this.path, {
      onWaveClear: (reward) => this.handleWaveClear(reward),
      onEnemyReachEnd: (enemy) => this.handleEnemyReachEnd(enemy),
      onEnemyKilled: (enemy) => this.handleEnemyKilled(enemy),
      onWaveStart: (waveNum) => this.handleWaveStart(waveNum),
    });

    // Economy change callback
    this.economy.onChange(() => this.updateHUD());

    // Start first wave automatically after a brief delay
    this.time.delayedCall(1500, () => {
      this.waveManager.startNextWave();
    });

    // Setup drag input
    this.setupDragInput();

    // Fade in
    this.cameras.main.fadeIn(300);
  }

  update(_time: number, delta: number): void {
    if (this.gameOver) return;

    // Update waves & enemies
    this.waveManager.update(delta);

    // Get all units and enemies
    const units = this.mapGrid.getUnits();
    const enemies = this.waveManager.enemies;

    // Apply supporter buffs
    this.applyBuffs(units);

    // Draw supporter connection lines
    this.drawSupporterLines(units);

    // Update unit attacks
    for (const unit of units) {
      const newProjectiles = unit.updateAttack(delta, enemies);
      for (const proj of newProjectiles) {
        this.allProjectiles.push(proj);
        unit.projectiles.push(proj);
      }
    }

    // Update standalone projectiles (ones not tracked by units)
    for (let i = this.allProjectiles.length - 1; i >= 0; i--) {
      const p = this.allProjectiles[i];
      if (p.isDone || !p.active) {
        this.allProjectiles.splice(i, 1);
      }
    }

    // Check victory
    if (this.waveManager.isAllWavesClear()) {
      this.handleVictory();
    }

    // Update HUD
    this.updateHUD();
  }

  // ---- Buff System ----

  private applyBuffs(units: Unit[]): void {
    // Reset all buffs
    for (const unit of units) {
      unit.resetBuff();
    }

    // Apply supporter buffs
    for (const unit of units) {
      if (unit.unitType !== 'supporter') continue;

      const supportBuff = unit.getSupporterBuff();
      if (!supportBuff) continue;

      // Global ATK buff (mythic supporter)
      const globalAtk = unit.getGlobalAtkBuff();
      if (globalAtk > 0) {
        for (const other of units) {
          if (other === unit) continue;
          other.applyBuff({ atkPercent: globalAtk, speedPercent: 0, rangePercent: 0 });
        }
      }

      // Adjacent buff
      const adjacent = this.mapGrid.getAdjacentCells(unit.gridCol, unit.gridRow);
      for (const cell of adjacent) {
        const neighbor = this.mapGrid.getUnitAt(cell.col, cell.row);
        if (neighbor && neighbor !== unit) {
          neighbor.applyBuff(supportBuff);
        }
      }
    }
  }

  private drawSupporterLines(units: Unit[]): void {
    this.supporterLineGraphics.clear();

    for (const unit of units) {
      if (unit.unitType !== 'supporter') continue;

      const adjacent = this.mapGrid.getAdjacentCells(unit.gridCol, unit.gridRow);
      for (const cell of adjacent) {
        const neighbor = this.mapGrid.getUnitAt(cell.col, cell.row);
        if (neighbor && neighbor !== unit) {
          // Draw yellow connection line
          this.supporterLineGraphics.lineStyle(1.5, 0xffee58, 0.3);
          this.supporterLineGraphics.lineBetween(unit.x, unit.y, neighbor.x, neighbor.y);

          // Buff glow particles (occasional)
          if (Math.random() < 0.02) {
            this.spawnBuffParticle(neighbor.x, neighbor.y);
          }
        }
      }
    }
  }

  // ---- Summon ----

  private handleSummon(): void {
    if (this.mapGrid.isFull()) {
      this.showFloatingText(this.cameras.main.width / 2, this.cameras.main.height / 2,
        '슬롯이 가득 찼습니다!', '#ef5350');
      return;
    }

    const cost = this.economy.getSummonCost();
    if (!this.economy.canAfford(cost)) {
      this.showFloatingText(this.cameras.main.width / 2, this.cameras.main.height / 2,
        '골드가 부족합니다!', '#ef5350');
      return;
    }

    this.economy.spend(cost);
    soundManager.playClick();

    const result = this.summonSystem.roll();
    const cell = this.mapGrid.findEmptyCell();
    if (!cell) return;

    const unit = this.mapGrid.placeUnit(result.unitType, result.grade, cell.col, cell.row);
    if (!unit) return;

    // Set damage popup callback
    unit.onDamageDealt = (x, y, damage, isCrit) => {
      this.showDamagePopup(x, y, damage, isCrit, unit.unitType);
    };

    // Summon visual effect
    const gradeIdx = MergeSystem.getGradeIndex(result.grade);
    soundManager.playSummon(gradeIdx);
    this.showSummonEffect(unit.x, unit.y, result.grade);
  }

  // ---- Skip Wave ----

  private handleSkip(): void {
    if (this.waveManager.skipPrepare()) {
      this.economy.earn(configData.economy.waveSkipBonus);
      soundManager.playClick();
      this.showFloatingText(this.cameras.main.width / 2, 60, '+20G 스킵 보너스!', '#66bb6a');
    }
  }

  // ---- Wave callbacks ----

  private handleWaveStart(waveNum: number): void {
    soundManager.playWaveStart();

    // Check if boss wave
    const isBoss = waveNum % 5 === 0;
    if (isBoss) {
      soundManager.playBossAppear();
      this.showFloatingText(this.cameras.main.width / 2, this.cameras.main.height * 0.3,
        `💀 보스 웨이브 ${waveNum}!`, '#d32f2f', 24);
    } else {
      this.showFloatingText(this.cameras.main.width / 2, this.cameras.main.height * 0.3,
        `🌊 웨이브 ${waveNum}`, '#42a5f5', 18);
    }
  }

  private handleWaveClear(reward: number): void {
    this.economy.earn(reward);
    this.scoreManager.addWaveClear(this.waveManager.currentWave);
    this.showFloatingText(this.cameras.main.width / 2, this.cameras.main.height * 0.3,
      `✅ 웨이브 클리어! +${reward}G`, '#66bb6a', 16);
  }

  private handleEnemyReachEnd(enemy: Enemy): void {
    const damage = enemy.enemyType === 'boss' ? configData.player.bossLifeDamage : 1;
    this.lives -= damage;

    this.showFloatingText(this.cameras.main.width / 2, 60,
      `❤️ -${damage}`, '#ef5350', 18);

    // Screen shake
    this.cameras.main.shake(200, 0.005 * damage);

    if (this.lives <= 0) {
      this.handleGameOver();
    }
  }

  private handleEnemyKilled(enemy: Enemy): void {
    const reward = this.economy.getKillReward(enemy.enemyType);
    this.economy.earn(reward);
    this.scoreManager.addKill();
    soundManager.playEnemyKill();

    // Kill effect
    this.showKillEffect(enemy.x, enemy.y, enemy.enemyType);
  }

  // ---- Game End ----

  private handleGameOver(): void {
    if (this.gameOver) return;
    this.gameOver = true;

    soundManager.playGameOver();

    const playTime = Math.floor(Date.now() / 1000) - this.startTime;
    const highestGrade = this.getHighestGrade();

    this.scoreManager.saveIfBest(this.waveManager.currentWave);

    this.cameras.main.fadeOut(500);
    this.time.delayedCall(500, () => {
      this.scene.start('GameOver', {
        wave: this.waveManager.currentWave,
        kills: this.scoreManager.killCount,
        highestGrade,
        playTime,
        score: this.scoreManager.score,
      });
    });
  }

  private handleVictory(): void {
    if (this.gameOver) return;
    this.gameOver = true;

    soundManager.playVictory();

    const playTime = Math.floor(Date.now() / 1000) - this.startTime;
    const highestGrade = this.getHighestGrade();

    this.scoreManager.saveIfBest(25);

    this.cameras.main.fadeOut(500);
    this.time.delayedCall(500, () => {
      this.scene.start('Victory', {
        kills: this.scoreManager.killCount,
        playTime,
        highestGrade,
        score: this.scoreManager.score,
      });
    });
  }

  private getHighestGrade(): UnitGrade {
    const units = this.mapGrid.getUnits();
    const gradeOrder: UnitGrade[] = ['common', 'rare', 'epic', 'legend', 'mythic'];
    let highest = 0;
    for (const unit of units) {
      const idx = gradeOrder.indexOf(unit.grade);
      if (idx > highest) highest = idx;
    }
    return gradeOrder[highest];
  }

  // ---- Drag & Drop ----

  private setupDragInput(): void {
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.gameOver) return;

      const cell = this.mapGrid.getCellAtPosition(pointer.x, pointer.y);
      if (!cell) return;

      const unit = this.mapGrid.getUnitAt(cell.col, cell.row);
      if (!unit) return;

      // Create drag ghost
      const ghost = this.add.container(pointer.x, pointer.y);
      const circle = this.add.graphics();
      const typeColor = Phaser.Display.Color.HexStringToColor(
        (configData.colors.unitType as Record<string, string>)[unit.unitType]
      ).color;
      circle.fillStyle(typeColor, 0.5);
      circle.fillCircle(0, 0, 22);
      ghost.add(circle);
      ghost.setDepth(200);
      ghost.setAlpha(0.7);

      this.dragState = {
        unit,
        originCol: cell.col,
        originRow: cell.row,
        ghost,
      };

      unit.setAlpha(0.4);
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.dragState) return;

      this.dragState.ghost.setPosition(pointer.x, pointer.y);

      // Reset highlights
      this.mapGrid.resetAllHighlights();

      // Highlight target cell
      const cell = this.mapGrid.getCellAtPosition(pointer.x, pointer.y);
      if (cell) {
        const target = this.mapGrid.getUnitAt(cell.col, cell.row);
        if (!target) {
          this.mapGrid.highlightCellDrop(cell.col, cell.row, 'empty');
        } else if (target === this.dragState.unit) {
          // Same unit — no highlight
        } else if (MergeSystem.canMerge(this.dragState.unit.grade, target.grade)) {
          this.mapGrid.highlightCellDrop(cell.col, cell.row, 'merge');
        } else {
          this.mapGrid.highlightCellDrop(cell.col, cell.row, 'empty'); // swap
        }
      }

      // Check sell zone
      this.actionBar.highlightSellZone(
        this.actionBar.isOverSellZone(pointer.x, pointer.y)
      );
    });

    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (!this.dragState) return;

      const { unit, originCol, originRow, ghost } = this.dragState;
      ghost.destroy();
      unit.setAlpha(1);
      this.mapGrid.resetAllHighlights();
      this.actionBar.highlightSellZone(false);

      // Check sell
      if (this.actionBar.isOverSellZone(pointer.x, pointer.y)) {
        this.sellUnit(originCol, originRow);
        this.dragState = null;
        return;
      }

      // Check target cell
      const cell = this.mapGrid.getCellAtPosition(pointer.x, pointer.y);
      if (!cell || (cell.col === originCol && cell.row === originRow)) {
        // Dropped on same spot or outside — snap back
        this.dragState = null;
        return;
      }

      const targetUnit = this.mapGrid.getUnitAt(cell.col, cell.row);

      if (!targetUnit) {
        // Move to empty cell
        this.mapGrid.moveUnit(originCol, originRow, cell.col, cell.row);
      } else if (MergeSystem.canMerge(unit.grade, targetUnit.grade)) {
        // Merge!
        this.mergeUnits(originCol, originRow, cell.col, cell.row);
      } else {
        // Swap
        this.mapGrid.moveUnit(originCol, originRow, cell.col, cell.row);
      }

      this.dragState = null;
    });
  }

  private sellUnit(col: number, row: number): void {
    const unit = this.mapGrid.removeUnit(col, row);
    if (!unit) return;

    this.economy.earn(this.economy.getSellReturn());
    soundManager.playSell();

    // Sell effect
    this.showFloatingText(unit.x, unit.y, `+${this.economy.getSellReturn()}G`, '#ffd54f');

    // Cleanup projectiles
    for (const p of unit.projectiles) {
      if (p.active) p.destroy();
    }
    unit.destroy();
  }

  private mergeUnits(fromCol: number, fromRow: number, toCol: number, toRow: number): void {
    const unitA = this.mapGrid.getUnitAt(fromCol, fromRow);
    const unitB = this.mapGrid.getUnitAt(toCol, toRow);
    if (!unitA || !unitB) return;

    const result = MergeSystem.merge(unitA.grade);
    if (!result) return;

    // Remove both units
    this.mapGrid.removeUnit(fromCol, fromRow);
    this.mapGrid.removeUnit(toCol, toRow);

    // Cleanup projectiles
    for (const p of unitA.projectiles) { if (p.active) p.destroy(); }
    for (const p of unitB.projectiles) { if (p.active) p.destroy(); }
    unitA.destroy();
    unitB.destroy();

    // Place new unit at target position
    const newUnit = this.mapGrid.placeUnit(result.unitType, result.grade, toCol, toRow);
    if (newUnit) {
      newUnit.onDamageDealt = (x, y, damage, isCrit) => {
        this.showDamagePopup(x, y, damage, isCrit, newUnit.unitType);
      };

      const gradeIdx = MergeSystem.getGradeIndex(result.grade);
      soundManager.playMerge(gradeIdx);
      this.scoreManager.addMerge();

      // Merge visual
      this.showMergeEffect(newUnit.x, newUnit.y, result.grade);
    }
  }

  // ---- HUD ----

  private updateHUD(): void {
    this.hud.updateGold(this.economy.gold);
    this.hud.updateLives(this.lives);
    this.hud.updateWave(this.waveManager.currentWave, this.waveManager.getTotalWaves());
    this.actionBar.updateSummonButton(this.economy.canAfford(this.economy.getSummonCost()));
  }

  // ---- Visual Effects ----

  private showDamagePopup(x: number, y: number, damage: number, isCrit: boolean, unitType: UnitType): void {
    const colors: Record<UnitType, string> = {
      warrior: '#ef5350',
      archer: '#66bb6a',
      mage: '#5c6bc0',
      supporter: '#ffee58',
      special: '#26c6da',
    };

    const fontSize = isCrit ? '14px' : '10px';
    const prefix = isCrit ? '💥' : '';
    const text = this.add.text(x, y - 10, `${prefix}${damage}`, {
      fontSize,
      color: isCrit ? '#ffd54f' : colors[unitType],
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: isCrit ? 3 : 2,
    }).setOrigin(0.5).setDepth(200);

    this.tweens.add({
      targets: text,
      y: y - 35,
      alpha: 0,
      duration: isCrit ? 800 : 500,
      ease: 'Power2',
      onComplete: () => text.destroy(),
    });

    // Warrior crit: screen flash
    if (isCrit && unitType === 'warrior') {
      this.cameras.main.flash(100, 255, 80, 80);
    }
  }

  private showSummonEffect(x: number, y: number, grade: UnitGrade): void {
    const gradeColor = Phaser.Display.Color.HexStringToColor(
      (configData.colors.grade as Record<string, string>)[grade]
    ).color;

    // Expanding ring
    const ring = this.add.graphics();
    ring.lineStyle(2, gradeColor, 0.8);
    ring.strokeCircle(x, y, 5);
    ring.setDepth(150);

    this.tweens.add({
      targets: ring,
      scaleX: 3,
      scaleY: 3,
      alpha: 0,
      duration: 400,
      ease: 'Power2',
      onComplete: () => ring.destroy(),
    });

    // Grade text flash
    const gradeNames: Record<UnitGrade, string> = {
      common: '⭐', rare: '⭐⭐', epic: '⭐⭐⭐', legend: '⭐⭐⭐⭐', mythic: '⭐⭐⭐⭐⭐',
    };

    const gradeText = this.add.text(x, y - 30, gradeNames[grade], {
      fontSize: '12px',
      color: (configData.colors.grade as Record<string, string>)[grade],
    }).setOrigin(0.5).setDepth(200);

    this.tweens.add({
      targets: gradeText,
      y: y - 50,
      alpha: 0,
      duration: 800,
      onComplete: () => gradeText.destroy(),
    });

    // Particles for rare+
    if (grade !== 'common') {
      for (let i = 0; i < 6; i++) {
        const p = this.add.graphics();
        p.fillStyle(gradeColor, 0.8);
        p.fillCircle(0, 0, 2);
        p.setPosition(x, y);
        p.setDepth(150);

        const angle = (Math.PI * 2 * i) / 6;
        this.tweens.add({
          targets: p,
          x: x + Math.cos(angle) * 30,
          y: y + Math.sin(angle) * 30,
          alpha: 0,
          duration: 400,
          onComplete: () => p.destroy(),
        });
      }
    }
  }

  private showMergeEffect(x: number, y: number, grade: UnitGrade): void {
    const gradeColor = Phaser.Display.Color.HexStringToColor(
      (configData.colors.grade as Record<string, string>)[grade]
    ).color;

    // Double ring burst
    for (let r = 0; r < 2; r++) {
      const ring = this.add.graphics();
      ring.lineStyle(3 - r, gradeColor, 0.9 - r * 0.3);
      ring.strokeCircle(x, y, 5);
      ring.setDepth(150);

      this.tweens.add({
        targets: ring,
        scaleX: 4,
        scaleY: 4,
        alpha: 0,
        duration: 500,
        delay: r * 100,
        onComplete: () => ring.destroy(),
      });
    }

    // Sparkle particles
    for (let i = 0; i < 10; i++) {
      const p = this.add.graphics();
      p.fillStyle(gradeColor, 0.9);
      p.fillCircle(0, 0, 1.5 + Math.random() * 2);
      p.setPosition(x, y);
      p.setDepth(150);

      const angle = Math.random() * Math.PI * 2;
      const dist = 20 + Math.random() * 30;
      this.tweens.add({
        targets: p,
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist,
        alpha: 0,
        duration: 300 + Math.random() * 300,
        onComplete: () => p.destroy(),
      });
    }

    // Grade text
    const gradeNames: Record<UnitGrade, string> = {
      common: '커먼', rare: '레어', epic: '에픽', legend: '레전드', mythic: '미시크',
    };
    const text = this.add.text(x, y - 35, `✨ ${gradeNames[grade]}!`, {
      fontSize: '14px',
      color: (configData.colors.grade as Record<string, string>)[grade],
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(200);

    this.tweens.add({
      targets: text,
      y: y - 55,
      alpha: 0,
      duration: 1000,
      onComplete: () => text.destroy(),
    });
  }

  private showKillEffect(x: number, y: number, type: string): void {
    const size = type === 'boss' ? 20 : 10;
    const count = type === 'boss' ? 8 : 4;

    for (let i = 0; i < count; i++) {
      const p = this.add.graphics();
      p.fillStyle(0xffffff, 0.7);
      p.fillCircle(0, 0, 1 + Math.random() * 2);
      p.setPosition(x, y);
      p.setDepth(150);

      const angle = Math.random() * Math.PI * 2;
      this.tweens.add({
        targets: p,
        x: x + Math.cos(angle) * size,
        y: y + Math.sin(angle) * size,
        alpha: 0,
        duration: 200 + Math.random() * 200,
        onComplete: () => p.destroy(),
      });
    }
  }

  private showFloatingText(x: number, y: number, text: string, color: string, size: number = 14): void {
    const t = this.add.text(x, y, text, {
      fontSize: `${size}px`,
      color,
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(300);

    this.tweens.add({
      targets: t,
      y: y - 30,
      alpha: 0,
      duration: 1200,
      ease: 'Power2',
      onComplete: () => t.destroy(),
    });
  }

  private spawnBuffParticle(x: number, y: number): void {
    const p = this.add.text(x + (Math.random() - 0.5) * 10, y, '↑', {
      fontSize: '8px',
      color: '#ffee58',
    }).setOrigin(0.5).setDepth(140).setAlpha(0.7);

    this.tweens.add({
      targets: p,
      y: y - 20,
      alpha: 0,
      duration: 800,
      onComplete: () => p.destroy(),
    });
  }
}
