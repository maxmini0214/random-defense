import Phaser from 'phaser';
import { soundManager } from '../systems/SoundManager';
import { ScoreManager, GameRecord } from '../systems/ScoreManager';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'Boot' });
  }

  preload(): void {
    // No external assets to load — everything is generated/code-based
  }

  create(): void {
    const { width, height } = this.cameras.main;

    // ---- Background ----
    this.cameras.main.setBackgroundColor('#1a1a2e');

    // Decorative floating particles
    this.spawnMenuParticles(width, height);

    // ---- Title ----
    const titleY = height * 0.22;
    const diceEmoji = this.add.text(width / 2, titleY - 50, '🎲', {
      fontSize: '48px',
    }).setOrigin(0.5);

    this.tweens.add({
      targets: diceEmoji,
      angle: 360,
      duration: 3000,
      repeat: -1,
      ease: 'Linear',
    });

    const title = this.add.text(width / 2, titleY, '다이스 가디언즈', {
      fontSize: '28px',
      color: '#ffd54f',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5).setAlpha(0);

    this.add.text(width / 2, titleY + 32, 'DICE GUARDIANS', {
      fontSize: '12px',
      color: '#888888',
    }).setOrigin(0.5);

    this.add.text(width / 2, titleY + 50, '랜덤 디펜스', {
      fontSize: '14px',
      color: '#42a5f5',
    }).setOrigin(0.5);

    // Title entrance
    this.tweens.add({
      targets: title,
      alpha: 1,
      y: titleY,
      duration: 600,
      ease: 'Back.easeOut',
    });

    // ---- Best Record ----
    const record: GameRecord = ScoreManager.getBestRecord();
    if (record.bestWave > 0) {
      const recordY = titleY + 80;
      this.add.text(width / 2, recordY, '🏆 최고 기록', {
        fontSize: '13px',
        color: '#ffd54f',
        fontStyle: 'bold',
      }).setOrigin(0.5);

      this.add.text(width / 2, recordY + 22, `웨이브 ${record.bestWave}/25  |  점수 ${record.bestScore}`, {
        fontSize: '12px',
        color: '#fafafa',
      }).setOrigin(0.5);
    }

    // ---- Start Button ----
    const startY = height * 0.55;
    this.createMenuButton(width / 2, startY, '▶  게임 시작', 0x42a5f5, () => {
      soundManager.init();
      soundManager.playClick();
      this.cameras.main.fadeOut(300);
      this.time.delayedCall(300, () => {
        this.scene.start('Game');
      });
    });

    // ---- Sound Toggle ----
    const soundY = height * 0.67;
    const soundLabel = soundManager.muted ? '🔇 사운드 OFF' : '🔊 사운드 ON';
    const soundText = this.add.text(width / 2, soundY, soundLabel, {
      fontSize: '14px',
      color: '#fafafa',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    const soundHit = this.add.rectangle(width / 2, soundY, 160, 40)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .setAlpha(0.001);

    soundHit.on('pointerup', () => {
      soundManager.init();
      const muted = soundManager.toggleMute();
      soundText.setText(muted ? '🔇 사운드 OFF' : '🔊 사운드 ON');
      if (!muted) soundManager.playClick();
    });

    // ---- How to play ----
    const helpY = height * 0.78;
    const helpLines = [
      '🎲 소환: 랜덤 유닛 소환 (50G)',
      '🔄 합성: 같은 등급 드래그하여 합성',
      '⚔️ 25 웨이브를 방어하면 승리!',
    ];

    this.add.text(width / 2, helpY - 14, '📖 플레이 방법', {
      fontSize: '12px',
      color: '#ffd54f',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    helpLines.forEach((line, i) => {
      this.add.text(width / 2, helpY + 8 + i * 18, line, {
        fontSize: '11px',
        color: '#aaaaaa',
      }).setOrigin(0.5);
    });

    // ---- Version ----
    this.add.text(width / 2, height - 20, 'v1.0', {
      fontSize: '10px',
      color: '#555555',
    }).setOrigin(0.5);
  }

  private createMenuButton(
    x: number, y: number, label: string, color: number, onClick: () => void
  ): void {
    const btnW = 200;
    const btnH = 52;

    const bg = this.add.graphics();
    bg.fillStyle(color, 0.85);
    bg.fillRoundedRect(x - btnW / 2, y - btnH / 2, btnW, btnH, 12);
    bg.lineStyle(2, 0xffffff, 0.3);
    bg.strokeRoundedRect(x - btnW / 2, y - btnH / 2, btnW, btnH, 12);

    this.add.text(x, y, label, {
      fontSize: '18px',
      color: '#fafafa',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    const hitArea = this.add.rectangle(x, y, btnW, btnH)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .setAlpha(0.001);

    hitArea.on('pointerdown', () => {
      bg.clear();
      bg.fillStyle(color, 0.6);
      bg.fillRoundedRect(x - btnW / 2, y - btnH / 2, btnW, btnH, 12);
    });

    hitArea.on('pointerup', () => {
      bg.clear();
      bg.fillStyle(color, 0.85);
      bg.fillRoundedRect(x - btnW / 2, y - btnH / 2, btnW, btnH, 12);
      bg.lineStyle(2, 0xffffff, 0.3);
      bg.strokeRoundedRect(x - btnW / 2, y - btnH / 2, btnW, btnH, 12);
      onClick();
    });

    hitArea.on('pointerout', () => {
      bg.clear();
      bg.fillStyle(color, 0.85);
      bg.fillRoundedRect(x - btnW / 2, y - btnH / 2, btnW, btnH, 12);
      bg.lineStyle(2, 0xffffff, 0.3);
      bg.strokeRoundedRect(x - btnW / 2, y - btnH / 2, btnW, btnH, 12);
    });

    // Pulse animation
    this.tweens.add({
      targets: hitArea,
      scaleX: 1.03,
      scaleY: 1.03,
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private spawnMenuParticles(width: number, height: number): void {
    const colors = [0xffd54f, 0x42a5f5, 0xab47bc, 0x66bb6a, 0xff5252];

    for (let i = 0; i < 15; i++) {
      const g = this.add.graphics();
      const color = colors[Math.floor(Math.random() * colors.length)];
      g.fillStyle(color, 0.15);
      g.fillCircle(0, 0, 2 + Math.random() * 3);
      g.setPosition(Math.random() * width, Math.random() * height);

      this.tweens.add({
        targets: g,
        y: g.y - 40 - Math.random() * 60,
        x: g.x + (Math.random() - 0.5) * 40,
        alpha: 0,
        duration: 3000 + Math.random() * 4000,
        repeat: -1,
        delay: Math.random() * 3000,
        onRepeat: () => {
          g.setPosition(Math.random() * width, height + 10);
          g.setAlpha(0.15);
        },
      });
    }
  }
}
