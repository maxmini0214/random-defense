import Phaser from 'phaser';
import configData from '../data/config.json';
import unitsData from '../data/units.json';
import { createWaypointPath, drawPath } from '../utils/PathHelper';
import { WaveManager } from '../systems/WaveManager';
import { EconomyManager } from '../systems/EconomyManager';
import { SummonSystem } from '../systems/SummonSystem';
import { MergeSystem } from '../systems/MergeSystem';
import { ScoreManager } from '../systems/ScoreManager';
import { soundManager } from '../systems/SoundManager';
import { HUD } from '../ui/HUD';
import { UnitSlots } from '../ui/UnitSlots';
import { ActionBar } from '../ui/ActionBar';
import { Enemy } from '../entities/Enemy';
import { Unit, UnitType, UnitGrade } from '../entities/Unit';
import { Projectile } from '../entities/Projectile';

export class GameScene extends Phaser.Scene {
  private hud!: HUD;
  private unitSlots!: UnitSlots;
  private actionBar!: ActionBar;
  private waveManager!: WaveManager;
  private economy!: EconomyManager;
  private summonSystem!: SummonSystem;
  private scoreManager!: ScoreManager;
  private gamePath!: Phaser.Curves.Path;
  private pathGraphics!: Phaser.GameObjects.Graphics;
  private lives!: number;
  private gameStarted: boolean = false;
  private allProjectiles: Projectile[] = [];

  // Drag state
  private dragUnit: Unit | null = null;
  private dragOriginalSlot: number = -1;
  private dragOriginalPos: { x: number; y: number } = { x: 0, y: 0 };
  private dragGhost: Phaser.GameObjects.Container | null = null;
  private lastHighlightedSlot: number = -1;
  private isDragging: boolean = false;

  // Unit info popup
  private infoPopup: Phaser.GameObjects.Container | null = null;
  private infoPopupUnit: Unit | null = null;

  // Damage popup pool and throttle
  private damagePopupCount: number = 0;
  private damagePopupPool: Phaser.GameObjects.Text[] = [];
  private activeDamagePopups: Set<Phaser.GameObjects.Text> = new Set();

  // Game stats tracking
  private totalKills: number = 0;
  private highestGrade: UnitGrade = 'common';
  private gameStartTime: number = 0;
  private slotFullWarning: Phaser.GameObjects.Graphics | null = null;
  private slotFullBlinkTimer: number = 0;

  // D12: Pause & Speed
  private isPaused: boolean = false;
  private timeScale: number = 1;
  private pauseOverlay: Phaser.GameObjects.Container | null = null;
  private speedBtn: Phaser.GameObjects.Text | null = null;
  private pauseBtn: Phaser.GameObjects.Text | null = null;
  private soundBtn: Phaser.GameObjects.Text | null = null;

  // D12: Tutorial hints
  private tutorialStep: number = 0;
  private tutorialText: Phaser.GameObjects.Text | null = null;
  private isFirstPlay: boolean = false;

  // D12: Score display
  private scoreText: Phaser.GameObjects.Text | null = null;

  // Sound: attack throttle (avoid spam)
  private attackSoundCooldown: number = 0;
  private killSoundCooldown: number = 0;

  constructor() {
    super({ key: 'Game' });
  }

  create(): void {
    const { width, height } = this.cameras.main;

    this.cameras.main.fadeIn(300);

    this.lives = configData.player.startingLives;
    this.economy = new EconomyManager();
    this.summonSystem = new SummonSystem();
    this.scoreManager = new ScoreManager();
    this.allProjectiles = [];
    this.dragUnit = null;
    this.isDragging = false;
    this.infoPopup = null;
    this.infoPopupUnit = null;
    this.totalKills = 0;
    this.highestGrade = 'common';
    this.gameStartTime = Date.now();
    this.slotFullWarning = null;
    this.slotFullBlinkTimer = 0;
    this.isPaused = false;
    this.timeScale = 1;
    this.pauseOverlay = null;
    this.tutorialStep = 0;
    this.attackSoundCooldown = 0;
    this.killSoundCooldown = 0;

    // Check first play
    this.isFirstPlay = !localStorage.getItem('dg_played');

    // Layout calculations
    const hudHeight = 40;
    const actionBarHeight = 50;
    const slotAreaHeight = 200;
    const mapHeight = height - hudHeight - slotAreaHeight - actionBarHeight - 20;
    const mapY = hudHeight + 5;

    // ---- Map & Path ----
    const { path } = createWaypointPath(10, mapY, width - 20, mapHeight);
    this.gamePath = path;

    this.pathGraphics = this.add.graphics();
    this.pathGraphics.fillStyle(
      Phaser.Display.Color.HexStringToColor(configData.colors.background).color,
      1
    );
    this.pathGraphics.fillRoundedRect(5, mapY - 5, width - 10, mapHeight + 10, 8);
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
      onWaveStart: (waveNum: number) => this.showWaveAnnouncement(waveNum),
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

    this.actionBar.updateSummonButton(
      this.economy.canAfford(this.economy.getSummonCost())
    );

    // ---- D12: Top-right control buttons (Pause, Speed, Sound) ----
    this.createControlButtons(width);

    // ---- D12: Score display in HUD area ----
    this.scoreText = this.add.text(width - 10, 28, '🏅 0', {
      fontSize: '11px',
      color: '#ffd54f',
    }).setOrigin(1, 0.5).setDepth(100);

    // ---- Setup drag input ----
    this.setupDragInput();

    // ---- Keyboard: ESC for pause ----
    this.input.keyboard?.on('keydown-ESC', () => this.togglePause());

    // ---- D12: Tutorial hints ----
    if (this.isFirstPlay) {
      this.showTutorialHint('유닛을 소환하세요! 🎲\n하단의 소환 버튼을 탭하세요');
    }

    // ---- Start first wave after a short delay ----
    this.time.delayedCall(1500, () => {
      this.gameStarted = true;
      this.waveManager.startNextWave();
      this.updateHUD();
    });
  }

  // ========== D12: CONTROL BUTTONS (Pause, Speed, Sound) ==========

  private createControlButtons(width: number): void {
    const btnY = 14;
    const btnSize = 24;

    // Sound toggle
    this.soundBtn = this.add.text(width - 12, btnY, soundManager.muted ? '🔇' : '🔊', {
      fontSize: '16px',
    }).setOrigin(1, 0.5).setDepth(110).setInteractive({ useHandCursor: true });

    this.soundBtn.on('pointerup', () => {
      const muted = soundManager.toggleMute();
      this.soundBtn!.setText(muted ? '🔇' : '🔊');
      if (!muted) soundManager.playClick();
    });

    // Speed toggle
    this.speedBtn = this.add.text(width - 40, btnY, '1x', {
      fontSize: '12px',
      color: '#66bb6a',
      fontStyle: 'bold',
      backgroundColor: '#2d2d44',
      padding: { x: 4, y: 2 },
    }).setOrigin(1, 0.5).setDepth(110).setInteractive({ useHandCursor: true });

    this.speedBtn.on('pointerup', () => {
      soundManager.playClick();
      this.timeScale = this.timeScale === 1 ? 2 : 1;
      this.speedBtn!.setText(this.timeScale === 1 ? '1x' : '2x');
      this.speedBtn!.setColor(this.timeScale === 1 ? '#66bb6a' : '#ff5252');
    });

    // Pause button
    this.pauseBtn = this.add.text(width - 74, btnY, '⏸', {
      fontSize: '16px',
    }).setOrigin(1, 0.5).setDepth(110).setInteractive({ useHandCursor: true });

    this.pauseBtn.on('pointerup', () => {
      soundManager.playClick();
      this.togglePause();
    });
  }

  // ========== PAUSE SYSTEM ==========

  private togglePause(): void {
    if (!this.gameStarted) return;

    this.isPaused = !this.isPaused;

    if (this.isPaused) {
      this.showPauseOverlay();
    } else {
      this.hidePauseOverlay();
    }
  }

  private showPauseOverlay(): void {
    const { width, height } = this.cameras.main;

    this.pauseOverlay = this.add.container(0, 0).setDepth(500);

    // Darkened bg
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.6);
    bg.fillRect(0, 0, width, height);
    this.pauseOverlay.add(bg);

    const pauseText = this.add.text(width / 2, height / 2 - 40, '⏸ 일시정지', {
      fontSize: '28px',
      color: '#fafafa',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5);
    this.pauseOverlay.add(pauseText);

    const resumeText = this.add.text(width / 2, height / 2 + 20, '탭하여 계속하기', {
      fontSize: '14px',
      color: '#888888',
    }).setOrigin(0.5);
    this.pauseOverlay.add(resumeText);

    // Click anywhere to resume
    const hitArea = this.add.rectangle(width / 2, height / 2, width, height)
      .setOrigin(0.5)
      .setInteractive()
      .setAlpha(0.001);
    this.pauseOverlay.add(hitArea);

    hitArea.on('pointerup', () => this.togglePause());
  }

  private hidePauseOverlay(): void {
    if (this.pauseOverlay) {
      this.pauseOverlay.destroy();
      this.pauseOverlay = null;
    }
  }

  // ========== D12: TUTORIAL HINTS ==========

  private showTutorialHint(text: string): void {
    if (this.tutorialText) {
      this.tutorialText.destroy();
    }

    const { width } = this.cameras.main;
    this.tutorialText = this.add.text(width / 2, 65, text, {
      fontSize: '13px',
      color: '#ffd54f',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2,
      align: 'center',
    }).setOrigin(0.5).setDepth(300);

    // Pulsing animation
    this.tweens.add({
      targets: this.tutorialText,
      alpha: 0.5,
      duration: 800,
      yoyo: true,
      repeat: 5,
      onComplete: () => {
        if (this.tutorialText) {
          this.tutorialText.destroy();
          this.tutorialText = null;
        }
      },
    });
  }

  private advanceTutorial(): void {
    if (!this.isFirstPlay) return;

    if (this.tutorialStep === 0) {
      // After first summon
      this.tutorialStep = 1;
      this.showTutorialHint('같은 등급 유닛을 드래그하여\n합성해보세요! 🔄');
    } else if (this.tutorialStep === 1) {
      // After first merge
      this.tutorialStep = 2;
      this.showTutorialHint('잘했어요! 계속 소환하고\n합성하여 강해지세요! 💪');
      localStorage.setItem('dg_played', '1');
    }
  }

  // ========== DRAG & DROP SYSTEM ==========

  private setupDragInput(): void {
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.isPaused) return;
      if (this.infoPopup) {
        this.closeInfoPopup();
        return;
      }

      const slotIndex = this.unitSlots.getSlotAtPosition(pointer.x, pointer.y);
      if (slotIndex === -1) return;

      const unit = this.unitSlots.getUnitAtSlot(slotIndex);
      if (!unit) return;

      this.dragUnit = unit;
      this.dragOriginalSlot = slotIndex;
      this.dragOriginalPos = { x: unit.x, y: unit.y };
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.isPaused) return;
      if (!this.dragUnit) return;

      if (!this.isDragging) {
        const dx = pointer.x - this.dragOriginalPos.x;
        const dy = pointer.y - this.dragOriginalPos.y;
        if (Math.sqrt(dx * dx + dy * dy) < 5) return;
        this.startDrag();
      }

      this.dragUnit.setPosition(pointer.x, pointer.y);
      this.dragUnit.setDepth(200);
      this.updateDragHighlights(pointer.x, pointer.y);
    });

    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (this.isPaused) return;
      if (!this.dragUnit) return;

      if (!this.isDragging) {
        this.showInfoPopup(this.dragUnit);
        this.dragUnit = null;
        this.dragOriginalSlot = -1;
        return;
      }

      this.endDrag(pointer.x, pointer.y);
    });
  }

  private startDrag(): void {
    if (!this.dragUnit) return;
    this.isDragging = true;
    this.dragUnit.setAlpha(0.7);
    this.dragUnit.setDepth(200);
    this.actionBar.highlightSellZone(false);
  }

  private updateDragHighlights(px: number, py: number): void {
    if (this.lastHighlightedSlot !== -1) {
      const prevUnit = this.unitSlots.getUnitAtSlot(this.lastHighlightedSlot);
      if (prevUnit && this.lastHighlightedSlot !== this.dragOriginalSlot) {
        this.unitSlots.highlightSlot(this.lastHighlightedSlot, prevUnit.grade);
      } else if (!prevUnit) {
        this.unitSlots.resetSlotHighlight(this.lastHighlightedSlot);
      }
      this.lastHighlightedSlot = -1;
    }

    if (this.actionBar.isOverSellZone(px, py)) {
      this.actionBar.highlightSellZone(true);
      return;
    } else {
      this.actionBar.highlightSellZone(false);
    }

    const hoverSlot = this.unitSlots.getSlotAtPosition(px, py);
    if (hoverSlot === -1 || hoverSlot === this.dragOriginalSlot) return;

    this.lastHighlightedSlot = hoverSlot;
    const targetUnit = this.unitSlots.getUnitAtSlot(hoverSlot);

    if (!targetUnit) {
      this.unitSlots.highlightSlotDrop(hoverSlot, 'empty');
    } else if (this.dragUnit && MergeSystem.canMerge(this.dragUnit.grade, targetUnit.grade)) {
      this.unitSlots.highlightSlotDrop(hoverSlot, 'merge');
    } else {
      this.unitSlots.highlightSlotDrop(hoverSlot, 'empty');
    }
  }

  private endDrag(px: number, py: number): void {
    if (!this.dragUnit) return;

    const unit = this.dragUnit;
    const fromSlot = this.dragOriginalSlot;

    unit.setAlpha(1);
    unit.setDepth(101);
    this.actionBar.highlightSellZone(false);
    this.unitSlots.resetAllSlotHighlights();
    this.lastHighlightedSlot = -1;

    if (this.actionBar.isOverSellZone(px, py)) {
      this.sellUnit(fromSlot);
      this.dragUnit = null;
      this.dragOriginalSlot = -1;
      this.isDragging = false;
      return;
    }

    const toSlot = this.unitSlots.getSlotAtPosition(px, py);

    if (toSlot !== -1 && toSlot !== fromSlot) {
      const targetUnit = this.unitSlots.getUnitAtSlot(toSlot);

      if (!targetUnit) {
        this.unitSlots.moveUnit(fromSlot, toSlot);
      } else if (MergeSystem.canMerge(unit.grade, targetUnit.grade)) {
        this.executeMerge(fromSlot, toSlot);
      } else {
        this.unitSlots.moveUnit(fromSlot, toSlot);
      }
    } else {
      const center = this.unitSlots.getSlotCenter(fromSlot);
      unit.setPosition(center.x, center.y);
    }

    this.dragUnit = null;
    this.dragOriginalSlot = -1;
    this.isDragging = false;
  }

  // ========== MERGE ==========

  private executeMerge(fromSlot: number, toSlot: number): void {
    const unitA = this.unitSlots.getUnitAtSlot(fromSlot);
    const unitB = this.unitSlots.getUnitAtSlot(toSlot);
    if (!unitA || !unitB) return;

    const result = MergeSystem.merge(unitA.grade);
    if (!result) return;

    const mergePos = this.unitSlots.getSlotCenter(toSlot);

    this.unitSlots.removeUnit(fromSlot);
    this.unitSlots.removeUnit(toSlot);
    unitA.destroy();
    unitB.destroy();

    const newUnit = this.unitSlots.placeUnit(result.unitType, result.grade, toSlot);
    if (newUnit) {
      newUnit.onDamageDealt = (x, y, damage, isCrit) => this.showDamagePopup(x, y, damage, isCrit);
      this.updateHighestGrade(result.grade);
      this.playMergeEffect(mergePos.x, mergePos.y, result.grade);

      newUnit.setScale(0);
      this.tweens.add({
        targets: newUnit,
        scaleX: 1.3,
        scaleY: 1.3,
        duration: 200,
        ease: 'Back.easeOut',
        onComplete: () => {
          this.tweens.add({
            targets: newUnit,
            scaleX: 1,
            scaleY: 1,
            duration: 150,
            ease: 'Sine.easeOut',
          });
        },
      });
    }

    // Score + sound
    this.scoreManager.addMerge();
    this.updateScoreDisplay();
    soundManager.playMerge(MergeSystem.getGradeIndex(result.grade));

    // Tutorial
    if (this.tutorialStep === 1) {
      this.advanceTutorial();
    }

    this.actionBar.updateSummonButton(
      this.economy.canAfford(this.economy.getSummonCost()) && !this.unitSlots.isFull()
    );
    this.updateSlotFullWarning();
  }

  private playMergeEffect(x: number, y: number, grade: UnitGrade): void {
    const gradeColor = Phaser.Display.Color.HexStringToColor(
      (configData.colors.grade as Record<string, string>)[grade]
    ).color;

    const gradeIndex = MergeSystem.getGradeIndex(grade);
    const particleCount = 10 + gradeIndex * 8;

    if (gradeIndex >= 2) {
      const beam = this.add.graphics();
      beam.fillStyle(gradeColor, 0.3);
      beam.fillRect(x - 3 - gradeIndex, 0, 6 + gradeIndex * 2, this.cameras.main.height);
      beam.setDepth(200);
      beam.setAlpha(0);
      this.tweens.add({
        targets: beam,
        alpha: 0.6,
        duration: 150,
        yoyo: true,
        onComplete: () => beam.destroy(),
      });
    }

    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.PI * 2 * i) / particleCount;
      const speed = 45 + gradeIndex * 18;
      const size = 2 + gradeIndex * 0.8;

      const particle = this.add.graphics();
      particle.fillStyle(gradeColor, 1);
      if (i % 3 === 0) {
        particle.fillCircle(0, 0, size);
        particle.fillStyle(0xffffff, 0.6);
        particle.fillCircle(0, 0, size * 0.4);
      } else {
        particle.fillCircle(0, 0, size);
      }
      particle.setPosition(x, y);
      particle.setDepth(210);

      this.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * speed,
        y: y + Math.sin(angle) * speed,
        alpha: 0,
        scaleX: 0.2,
        scaleY: 0.2,
        duration: 400 + Math.random() * 300,
        ease: 'Power2',
        onComplete: () => particle.destroy(),
      });
    }

    const ringCount = gradeIndex >= 2 ? 2 : 1;
    for (let r = 0; r < ringCount; r++) {
      const ring = this.add.graphics();
      ring.lineStyle(3 + gradeIndex, gradeColor, 0.8);
      ring.strokeCircle(x, y, 5);
      ring.setDepth(205);
      this.tweens.add({
        targets: ring,
        scaleX: 3 + r,
        scaleY: 3 + r,
        alpha: 0,
        duration: 400 + r * 200,
        delay: r * 80,
        ease: 'Power2',
        onComplete: () => ring.destroy(),
      });
    }

    const flash = this.add.graphics();
    flash.fillStyle(gradeColor, 0.4 + gradeIndex * 0.05);
    flash.fillCircle(x, y, 30 + gradeIndex * 5);
    flash.setDepth(204);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      scaleX: 2,
      scaleY: 2,
      duration: 350,
      onComplete: () => flash.destroy(),
    });

    if (gradeIndex >= 3) {
      this.cameras.main.flash(250, 255, 215, 0, false);
    }

    const gradeLabels: Record<string, string> = {
      common: '⭐', rare: '⭐⭐ 레어!', epic: '⭐⭐⭐ 에픽!',
      legend: '⭐⭐⭐⭐ 레전드!!', mythic: '⭐⭐⭐⭐⭐ 미시크!!!',
    };
    const gradeText = this.add.text(x, y - 30, gradeLabels[grade] || '', {
      fontSize: gradeIndex >= 4 ? '18px' : gradeIndex >= 3 ? '16px' : '12px',
      color: (configData.colors.grade as Record<string, string>)[grade],
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: gradeIndex >= 3 ? 3 : 2,
    }).setOrigin(0.5).setDepth(220);

    this.tweens.add({
      targets: gradeText,
      y: y - 60,
      alpha: 0,
      duration: 1200,
      ease: 'Power1',
      onComplete: () => gradeText.destroy(),
    });
  }

  // ========== SELL ==========

  private sellUnit(slotIndex: number): void {
    const unit = this.unitSlots.removeUnit(slotIndex);
    if (!unit) return;

    const sellPos = { x: unit.x, y: unit.y };

    this.tweens.add({
      targets: unit,
      scaleX: 0,
      scaleY: 0,
      alpha: 0,
      duration: 200,
      ease: 'Back.easeIn',
      onComplete: () => unit.destroy(),
    });

    const sellReturn = this.economy.getSellReturn();
    this.economy.earn(sellReturn);
    soundManager.playSell();

    const goldText = this.add.text(sellPos.x, sellPos.y, `+${sellReturn}G`, {
      fontSize: '14px',
      color: '#ffd54f',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(200);

    this.tweens.add({
      targets: goldText,
      y: goldText.y - 30,
      alpha: 0,
      duration: 800,
      onComplete: () => goldText.destroy(),
    });

    this.actionBar.updateSummonButton(
      this.economy.canAfford(this.economy.getSummonCost()) && !this.unitSlots.isFull()
    );
    this.updateSlotFullWarning();
  }

  // ========== UNIT INFO POPUP ==========

  private showInfoPopup(unit: Unit): void {
    if (this.infoPopup) this.closeInfoPopup();
    this.infoPopupUnit = unit;

    const { width } = this.cameras.main;
    const popupW = width - 40;
    const popupH = 140;
    const popupX = 20;
    const popupY = unit.y - popupH - 40;
    const adjustedY = Math.max(45, Math.min(popupY, this.cameras.main.height - popupH - 10));

    this.infoPopup = this.add.container(popupX, adjustedY).setDepth(300);

    const bg = this.add.graphics();
    bg.fillStyle(0x1a1a2e, 0.95);
    bg.fillRoundedRect(0, 0, popupW, popupH, 10);
    bg.lineStyle(2, Phaser.Display.Color.HexStringToColor(
      (configData.colors.grade as Record<string, string>)[unit.grade]
    ).color, 0.8);
    bg.strokeRoundedRect(0, 0, popupW, popupH, 10);
    this.infoPopup.add(bg);

    const unitData = (unitsData as Record<string, { name: string; icon: string }>)[unit.unitType];
    const gradeNames: Record<string, string> = {
      common: '커먼 ⭐', rare: '레어 ⭐⭐', epic: '에픽 ⭐⭐⭐',
      legend: '레전드 ⭐⭐⭐⭐', mythic: '미시크 ⭐⭐⭐⭐⭐',
    };

    const titleText = this.add.text(12, 10, `${unitData.icon} ${unitData.name} — ${gradeNames[unit.grade]}`, {
      fontSize: '14px',
      color: (configData.colors.grade as Record<string, string>)[unit.grade],
      fontStyle: 'bold',
    });
    this.infoPopup.add(titleText);

    const statsText = this.add.text(12, 34, [
      `ATK: ${unit.stats.atk}  |  공속: ${unit.stats.attackSpeed}초  |  범위: ${unit.stats.range}px`,
    ].join('\n'), {
      fontSize: '12px',
      color: '#fafafa',
    });
    this.infoPopup.add(statsText);

    const abilityDescriptions = this.getAbilityDescriptions(unit);
    if (abilityDescriptions.length > 0) {
      const abilitiesText = this.add.text(12, 55, '특수능력:', {
        fontSize: '11px',
        color: '#ffd54f',
        fontStyle: 'bold',
      });
      this.infoPopup.add(abilitiesText);

      const abText = this.add.text(12, 70, abilityDescriptions.join('\n'), {
        fontSize: '11px',
        color: '#cccccc',
        wordWrap: { width: popupW - 24 },
      });
      this.infoPopup.add(abText);
    } else {
      const noAbilityText = this.add.text(12, 55, '특수능력 없음', {
        fontSize: '11px',
        color: '#888888',
      });
      this.infoPopup.add(noAbilityText);
    }

    const sellText = this.add.text(12, popupH - 22, `판매 가격: ${configData.economy.sellReturn}G  |  드래그하여 이동/합성`, {
      fontSize: '10px',
      color: '#888888',
    });
    this.infoPopup.add(sellText);

    this.infoPopup.setScale(0.8);
    this.infoPopup.setAlpha(0);
    this.tweens.add({
      targets: this.infoPopup,
      scaleX: 1,
      scaleY: 1,
      alpha: 1,
      duration: 150,
      ease: 'Back.easeOut',
    });

    soundManager.playClick();
  }

  private getAbilityDescriptions(unit: Unit): string[] {
    const descriptions: string[] = [];
    for (const ability of unit.stats.abilities) {
      switch (ability.type) {
        case 'critChance':
          descriptions.push(`크리티컬: ${(ability.chance as number) * 100}% 확률로 ${ability.multiplier}배 데미지`);
          break;
        case 'stun':
          descriptions.push(`스턴: 크리티컬 시 ${ability.duration}초 기절`);
          break;
        case 'splash':
          descriptions.push(`스플래시: 반경 ${ability.radius}px`);
          break;
        case 'multishot':
          descriptions.push(`연사: ${ability.count}발 (추가 화살 ${(ability.damageRatio as number) * 100}% 데미지)`);
          break;
        case 'pierce':
          descriptions.push(`관통: ${ability.count === 99 ? '전체' : ability.count + '마리'}`);
          break;
        case 'slow':
          descriptions.push(`둔화: 이속 -${(ability.percent as number) * 100}% ${ability.duration}초`);
          break;
        case 'dot':
          descriptions.push(`도트: ${ability.damage}/초`);
          break;
        case 'armorReduce':
          descriptions.push(`방어 감소: -${(ability.percent as number) * 100}%`);
          break;
        case 'freeze':
          descriptions.push(`빙결: ${ability.interval}초마다 ${ability.duration}초 빙결`);
          break;
        case 'buffAtk':
          descriptions.push(`버프: 인접 유닛 ATK +${(ability.percent as number) * 100}%`);
          break;
        case 'buffSpeed':
          descriptions.push(`버프: 인접 유닛 공속 +${(ability.percent as number) * 100}%`);
          break;
        case 'buffRange':
          descriptions.push(`버프: 인접 유닛 범위 +${(ability.percent as number) * 100}%`);
          break;
        case 'buffAtkGlobal':
          descriptions.push(`글로벌 버프: 전체 유닛 ATK +${(ability.percent as number) * 100}%`);
          break;
      }
    }
    return descriptions;
  }

  private closeInfoPopup(): void {
    if (this.infoPopup) {
      this.infoPopup.destroy();
      this.infoPopup = null;
      this.infoPopupUnit = null;
    }
  }

  // ========== DAMAGE POPUP ==========

  private getDamagePopupText(): Phaser.GameObjects.Text {
    const pooled = this.damagePopupPool.pop();
    if (pooled) {
      pooled.setActive(true).setVisible(true);
      return pooled;
    }
    return this.add.text(0, 0, '', {
      fontSize: '11px',
      color: '#fafafa',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(250);
  }

  private recycleDamagePopup(text: Phaser.GameObjects.Text): void {
    this.activeDamagePopups.delete(text);
    text.setActive(false).setVisible(false);
    if (this.damagePopupPool.length < 30) {
      this.damagePopupPool.push(text);
    } else {
      text.destroy();
    }
  }

  private showDamagePopup(x: number, y: number, damage: number, isCrit: boolean): void {
    if (!isCrit && this.damagePopupCount >= 15) return;
    this.damagePopupCount++;

    const text = this.getDamagePopupText();
    text.setText(`${damage}`);
    text.setPosition(x, y - 15);
    text.setAlpha(1);
    text.setFontSize(isCrit ? 16 : 11);
    text.setColor(isCrit ? '#ff5252' : '#fafafa');
    (text.style as Phaser.GameObjects.TextStyle & { strokeThickness: number }).strokeThickness = isCrit ? 3 : 2;
    text.setScale(isCrit ? 1.3 : 1);
    this.activeDamagePopups.add(text);

    const offsetX = (Math.random() - 0.5) * 20;
    this.tweens.add({
      targets: text,
      y: y - 35 - Math.random() * 15,
      x: x + offsetX,
      alpha: 0,
      scaleX: isCrit ? 0.8 : 0.6,
      scaleY: isCrit ? 0.8 : 0.6,
      duration: isCrit ? 900 : 600,
      ease: 'Power2',
      onComplete: () => this.recycleDamagePopup(text),
    });
  }

  // ========== WAVE ANNOUNCEMENT ==========

  private showWaveAnnouncement(waveNum: number): void {
    const { width, height } = this.cameras.main;
    const isBoss = waveNum % 5 === 0;

    if (isBoss) {
      soundManager.playBossAppear();
      this.cameras.main.shake(400, 0.01);

      const warningBg = this.add.graphics();
      warningBg.fillStyle(0xd32f2f, 0.3);
      warningBg.fillRect(0, 0, width, height);
      warningBg.setDepth(290);

      this.tweens.add({
        targets: warningBg,
        alpha: 0,
        duration: 600,
        yoyo: true,
        repeat: 1,
        onComplete: () => warningBg.destroy(),
      });

      const bossText = this.add.text(width / 2, height / 3 - 20, '⚠️ BOSS ⚠️', {
        fontSize: '28px',
        color: '#ff1744',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 4,
      }).setOrigin(0.5).setDepth(300).setAlpha(0).setScale(0.5);

      this.tweens.add({
        targets: bossText,
        alpha: 1,
        scaleX: 1.2,
        scaleY: 1.2,
        duration: 300,
        ease: 'Back.easeOut',
        onComplete: () => {
          this.tweens.add({
            targets: bossText,
            alpha: 0,
            y: bossText.y - 30,
            scaleX: 0.8,
            scaleY: 0.8,
            duration: 800,
            delay: 600,
            onComplete: () => bossText.destroy(),
          });
        },
      });
    } else {
      soundManager.playWaveStart();
    }

    const waveText = this.add.text(width / 2, height / 3 + (isBoss ? 15 : 0), `🌊 Wave ${waveNum}`, {
      fontSize: isBoss ? '22px' : '18px',
      color: isBoss ? '#ffd54f' : '#42a5f5',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(300).setAlpha(0).setScale(0.5);

    this.tweens.add({
      targets: waveText,
      alpha: 1,
      scaleX: 1,
      scaleY: 1,
      duration: 300,
      ease: 'Back.easeOut',
      delay: isBoss ? 200 : 0,
      onComplete: () => {
        this.tweens.add({
          targets: waveText,
          alpha: 0,
          y: waveText.y - 30,
          duration: 800,
          delay: 800,
          onComplete: () => waveText.destroy(),
        });
      },
    });
  }

  // ========== SUMMON EFFECT ==========

  private playSummonEffect(unit: Unit, grade: UnitGrade): void {
    const gradeIndex = MergeSystem.getGradeIndex(grade);
    const gradeColor = Phaser.Display.Color.HexStringToColor(
      (configData.colors.grade as Record<string, string>)[grade]
    ).color;

    unit.setScale(0);
    this.tweens.add({
      targets: unit,
      scaleX: 1,
      scaleY: 1,
      duration: 300,
      ease: 'Back.easeOut',
    });

    const ringCount = 1 + Math.floor(gradeIndex / 2);
    for (let r = 0; r < ringCount; r++) {
      const ring = this.add.graphics();
      ring.lineStyle(2 + gradeIndex, gradeColor, 0.6);
      ring.strokeCircle(unit.x, unit.y, 5);
      ring.setDepth(105);
      this.tweens.add({
        targets: ring,
        scaleX: 2 + gradeIndex * 0.5,
        scaleY: 2 + gradeIndex * 0.5,
        alpha: 0,
        duration: 400 + r * 150,
        delay: r * 100,
        ease: 'Power2',
        onComplete: () => ring.destroy(),
      });
    }

    if (gradeIndex >= 1) {
      const count = 4 + gradeIndex * 5;
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count;
        const p = this.add.graphics();
        const pSize = 1.5 + gradeIndex * 0.5;
        p.fillStyle(gradeColor, 0.9);
        p.fillCircle(0, 0, pSize);
        p.setPosition(unit.x, unit.y);
        p.setDepth(106);
        const dist = 25 + gradeIndex * 10;
        this.tweens.add({
          targets: p,
          x: unit.x + Math.cos(angle) * dist,
          y: unit.y + Math.sin(angle) * dist,
          alpha: 0,
          duration: 400 + Math.random() * 200,
          ease: 'Power2',
          onComplete: () => p.destroy(),
        });
      }
    }

    if (gradeIndex >= 3) {
      this.cameras.main.flash(300, 255, 215, 0, false);
      const flash = this.add.graphics();
      flash.fillStyle(gradeColor, 0.4);
      flash.fillCircle(unit.x, unit.y, 50);
      flash.setDepth(104);
      this.tweens.add({
        targets: flash,
        alpha: 0,
        scaleX: 2,
        scaleY: 2,
        duration: 600,
        onComplete: () => flash.destroy(),
      });
    }

    if (gradeIndex >= 4) {
      const glow = this.add.graphics();
      glow.fillStyle(0xff1744, 0.3);
      glow.fillCircle(unit.x, unit.y, 30);
      glow.setDepth(103);
      this.tweens.add({
        targets: glow,
        scaleX: 3,
        scaleY: 3,
        alpha: 0,
        duration: 800,
        onComplete: () => glow.destroy(),
      });
    }

    if (gradeIndex >= 2) {
      const gradeNames: Record<string, string> = {
        epic: '에픽!', legend: '레전드!!', mythic: '미시크!!!',
      };
      const label = gradeNames[grade] || '';
      if (label) {
        const gradeText = this.add.text(unit.x, unit.y - 30, label, {
          fontSize: gradeIndex >= 4 ? '18px' : gradeIndex >= 3 ? '16px' : '13px',
          color: (configData.colors.grade as Record<string, string>)[grade],
          fontStyle: 'bold',
          stroke: '#000000',
          strokeThickness: 3,
        }).setOrigin(0.5).setDepth(220);
        this.tweens.add({
          targets: gradeText,
          y: unit.y - 55,
          alpha: 0,
          duration: 1200,
          ease: 'Power1',
          onComplete: () => gradeText.destroy(),
        });
      }
    }
  }

  // ========== MAIN GAME LOOP ==========

  update(_time: number, delta: number): void {
    if (!this.gameStarted) return;
    if (this.isPaused) return;

    // Apply time scale
    const scaledDelta = delta * this.timeScale;

    // Reset throttles
    this.damagePopupCount = 0;
    this.attackSoundCooldown = Math.max(0, this.attackSoundCooldown - scaledDelta / 1000);
    this.killSoundCooldown = Math.max(0, this.killSoundCooldown - scaledDelta / 1000);

    this.waveManager.update(scaledDelta);

    // ---- Unit Attack AI ----
    this.updateUnitAttacks(scaledDelta);

    // ---- Update free-flying projectiles ----
    for (let i = this.allProjectiles.length - 1; i >= 0; i--) {
      const p = this.allProjectiles[i];
      p.update(scaledDelta);
      if (p.isDone) {
        this.allProjectiles.splice(i, 1);
      }
    }

    // Slot full warning blink
    if (this.slotFullWarning) {
      this.slotFullBlinkTimer += scaledDelta / 1000;
      const alpha = 0.2 + Math.abs(Math.sin(this.slotFullBlinkTimer * 4)) * 0.4;
      this.slotFullWarning.setAlpha(alpha);
    }

    // Check victory
    if (this.waveManager.isAllWavesClear()) {
      const playTime = Math.floor((Date.now() - this.gameStartTime) / 1000);
      this.scoreManager.addWaveClear(this.waveManager.currentWave);
      this.scoreManager.saveIfBest(this.waveManager.currentWave);
      soundManager.playVictory();
      this.scene.start('Victory', {
        kills: this.totalKills,
        playTime,
        highestGrade: this.highestGrade,
        score: this.scoreManager.score,
      });
      return;
    }

    // Check game over
    if (this.lives <= 0) {
      this.waveManager.destroy();
      const playTime = Math.floor((Date.now() - this.gameStartTime) / 1000);
      this.scoreManager.saveIfBest(this.waveManager.currentWave);
      soundManager.playGameOver();
      this.scene.start('GameOver', {
        wave: this.waveManager.currentWave,
        kills: this.totalKills,
        highestGrade: this.highestGrade,
        playTime,
        score: this.scoreManager.score,
      });
      return;
    }
  }

  private updateUnitAttacks(delta: number): void {
    const units = this.unitSlots.getUnits();
    const enemies = this.waveManager.enemies;

    if (enemies.length === 0 || units.length === 0) return;

    this.calculateSupporterBuffs(units);

    for (const unit of units) {
      const newProjectiles = unit.updateAttack(delta, enemies);
      if (newProjectiles.length > 0) {
        // Play attack sound (throttled)
        if (this.attackSoundCooldown <= 0) {
          this.playAttackSound(unit.unitType);
          this.attackSoundCooldown = 0.08; // max ~12 sounds/sec
        }
      }
      for (const proj of newProjectiles) {
        this.allProjectiles.push(proj);
        unit.projectiles.push(proj);
      }
    }
  }

  private playAttackSound(unitType: UnitType): void {
    switch (unitType) {
      case 'warrior': soundManager.playAttackWarrior(); break;
      case 'archer': soundManager.playAttackArcher(); break;
      case 'mage': soundManager.playAttackMage(); break;
      default: soundManager.playAttackArcher(); break; // supporter/special use generic
    }
  }

  private calculateSupporterBuffs(units: Unit[]): void {
    for (const unit of units) {
      unit.resetBuff();
    }

    let globalAtkBuff = 0;
    for (const unit of units) {
      const gBuff = unit.getGlobalAtkBuff();
      if (gBuff > 0) globalAtkBuff += gBuff;
    }

    if (globalAtkBuff > 0) {
      for (const unit of units) {
        unit.applyBuff({ atkPercent: globalAtkBuff, speedPercent: 0, rangePercent: 0 });
      }
    }

    for (const supporter of units) {
      const buff = supporter.getSupporterBuff();
      if (!buff) continue;
      const adjacentSlots = this.getAdjacentSlots(supporter.slotIndex);
      for (const adjSlot of adjacentSlots) {
        const adjUnit = this.unitSlots.getUnitAtSlot(adjSlot);
        if (adjUnit && adjUnit !== supporter) {
          adjUnit.applyBuff(buff);
        }
      }
    }
  }

  private getAdjacentSlots(slotIndex: number): number[] {
    const cols = configData.slots.cols;
    const total = configData.slots.total;
    const row = Math.floor(slotIndex / cols);
    const col = slotIndex % cols;
    const adjacent: number[] = [];

    const directions = [
      [-1, 0], [1, 0], [0, -1], [0, 1],
    ];

    for (const [dr, dc] of directions) {
      const nr = row + dr;
      const nc = col + dc;
      const ni = nr * cols + nc;
      if (nr >= 0 && nr < Math.ceil(total / cols) && nc >= 0 && nc < cols && ni < total) {
        adjacent.push(ni);
      }
    }

    return adjacent;
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
      unit.onDamageDealt = (x, y, damage, isCrit) => this.showDamagePopup(x, y, damage, isCrit);
      this.playSummonEffect(unit, result.grade);
      this.updateHighestGrade(result.grade);
      soundManager.playSummon(MergeSystem.getGradeIndex(result.grade));
    }

    // Tutorial
    if (this.tutorialStep === 0) {
      this.advanceTutorial();
    }

    this.updateSlotFullWarning();
  }

  private handleSkip(): void {
    if (this.waveManager.skipPrepare()) {
      this.economy.earn(configData.economy.waveSkipBonus);
      soundManager.playClick();
    }
  }

  private handleWaveClear(reward: number): void {
    this.economy.earn(reward);
    this.scoreManager.addWaveClear(this.waveManager.currentWave);
    this.updateScoreDisplay();
    this.updateHUD();

    const { width } = this.cameras.main;
    const clearText = this.add.text(width / 2, this.cameras.main.height / 3, `🌊 웨이브 ${this.waveManager.currentWave} 클리어! +${reward}G`, {
      fontSize: '18px',
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

    if (this.lives > 0) {
      this.cameras.main.flash(200, 255, 0, 0, false, (_cam: Phaser.Cameras.Scene2D.Camera, progress: number) => {
        if (progress === 1) { /* flash done */ }
      });
    }
  }

  private handleEnemyKilled(enemy: Enemy): void {
    this.totalKills++;
    this.scoreManager.addKill();
    this.updateScoreDisplay();
    const reward = this.economy.getKillReward(enemy.enemyType);
    this.economy.earn(reward);

    // Sound (throttled)
    if (this.killSoundCooldown <= 0) {
      soundManager.playEnemyKill();
      this.killSoundCooldown = 0.15;
    }

    const goldText = this.add.text(enemy.x, enemy.y - 10, `+${reward}G`, {
      fontSize: '10px',
      color: '#ffd54f',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(200);

    this.tweens.add({
      targets: goldText,
      y: goldText.y - 25,
      alpha: 0,
      duration: 700,
      onComplete: () => goldText.destroy(),
    });
  }

  private updateHUD(): void {
    this.hud.updateGold(this.economy.gold);
    this.hud.updateLives(this.lives);
    this.hud.updateWave(
      this.waveManager ? this.waveManager.currentWave : 0,
      configData.wave.totalWaves
    );
  }

  private updateScoreDisplay(): void {
    if (this.scoreText) {
      this.scoreText.setText(`🏅 ${this.scoreManager.score}`);
    }
  }

  // ========== HELPER: Grade tracking ==========

  private static gradeOrder: UnitGrade[] = ['common', 'rare', 'epic', 'legend', 'mythic'];

  private updateHighestGrade(grade: UnitGrade): void {
    const current = GameScene.gradeOrder.indexOf(this.highestGrade);
    const incoming = GameScene.gradeOrder.indexOf(grade);
    if (incoming > current) {
      this.highestGrade = grade;
    }
  }

  // ========== SLOT FULL WARNING ==========

  private updateSlotFullWarning(): void {
    if (this.unitSlots.isFull()) {
      if (!this.slotFullWarning) {
        this.slotFullBlinkTimer = 0;
        this.slotFullWarning = this.add.graphics();
        this.slotFullWarning.setDepth(99);

        const firstSlot = this.unitSlots.getSlotTopLeft(0);
        const lastSlot = this.unitSlots.getSlotTopLeft(configData.slots.total - 1);
        const padding = 4;
        const gx = firstSlot.x - padding;
        const gy = firstSlot.y - padding;
        const gw = (lastSlot.x + this.unitSlots.slotSize) - firstSlot.x + padding * 2;
        const gh = (lastSlot.y + this.unitSlots.slotSize) - firstSlot.y + padding * 2;

        this.slotFullWarning.lineStyle(3, 0xff5252, 0.8);
        this.slotFullWarning.strokeRoundedRect(gx, gy, gw, gh, 8);

        const warningText = this.add.text(
          gx + gw / 2, gy - 10,
          '⚠️ 슬롯 가득참! 합성/판매 필요',
          { fontSize: '11px', color: '#ff5252', fontStyle: 'bold', stroke: '#000000', strokeThickness: 2 }
        ).setOrigin(0.5).setDepth(99);
        (this.slotFullWarning as Phaser.GameObjects.Graphics & { _warningText?: Phaser.GameObjects.Text })._warningText = warningText;
      }
    } else {
      if (this.slotFullWarning) {
        const warnGraphics = this.slotFullWarning as Phaser.GameObjects.Graphics & { _warningText?: Phaser.GameObjects.Text };
        warnGraphics._warningText?.destroy();
        this.slotFullWarning.destroy();
        this.slotFullWarning = null;
      }
    }
  }
}
