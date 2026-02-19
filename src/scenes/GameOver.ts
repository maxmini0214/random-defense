import Phaser from 'phaser';
import configData from '../data/config.json';
import { UnitGrade } from '../entities/Unit';
import { ScoreManager } from '../systems/ScoreManager';
import { soundManager } from '../systems/SoundManager';

interface GameOverData {
  wave?: number;
  kills?: number;
  highestGrade?: UnitGrade;
  playTime?: number;
  score?: number;
}

export class GameOverScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameOver' });
  }

  create(data: GameOverData): void {
    const { width, height } = this.cameras.main;

    this.cameras.main.setBackgroundColor(configData.colors.background);

    // Darkened vignette
    const vignette = this.add.graphics();
    vignette.fillStyle(0x000000, 0.4);
    vignette.fillRect(0, 0, width, height);

    // Title
    const title = this.add.text(width / 2, height * 0.2, '💀 게임 오버', {
      fontSize: '32px',
      color: '#ef5350',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5);

    title.setScale(0);
    this.tweens.add({
      targets: title,
      scaleX: 1,
      scaleY: 1,
      duration: 400,
      ease: 'Back.easeOut',
    });

    // Stats panel
    const panelY = height * 0.30;
    const panelW = width - 60;
    const panelH = 210;
    const panelX = 30;

    const panel = this.add.graphics();
    panel.fillStyle(0x2d2d44, 0.9);
    panel.fillRoundedRect(panelX, panelY, panelW, panelH, 12);
    panel.lineStyle(2, 0xef5350, 0.5);
    panel.strokeRoundedRect(panelX, panelY, panelW, panelH, 12);

    const statsX = panelX + 20;
    let statsY = panelY + 20;
    const lineHeight = 28;

    if (data.wave) {
      this.add.text(statsX, statsY, `🌊 도달 웨이브: ${data.wave} / ${configData.wave.totalWaves}`, {
        fontSize: '15px', color: '#42a5f5', fontStyle: 'bold',
      });
      statsY += lineHeight;
    }

    if (data.kills !== undefined) {
      this.add.text(statsX, statsY, `⚔️ 처치 수: ${data.kills}`, {
        fontSize: '15px', color: '#66bb6a', fontStyle: 'bold',
      });
      statsY += lineHeight;
    }

    if (data.score !== undefined) {
      this.add.text(statsX, statsY, `🏅 점수: ${data.score}`, {
        fontSize: '15px', color: '#ffd54f', fontStyle: 'bold',
      });
      statsY += lineHeight;
    }

    if (data.highestGrade) {
      const gradeNames: Record<string, string> = {
        common: '커먼 ⭐', rare: '레어 ⭐⭐', epic: '에픽 ⭐⭐⭐',
        legend: '레전드 ⭐⭐⭐⭐', mythic: '미시크 ⭐⭐⭐⭐⭐',
      };
      const gradeColor = (configData.colors.grade as Record<string, string>)[data.highestGrade];
      this.add.text(statsX, statsY, `👑 최고 등급: ${gradeNames[data.highestGrade]}`, {
        fontSize: '15px', color: gradeColor, fontStyle: 'bold',
      });
      statsY += lineHeight;
    }

    if (data.playTime !== undefined) {
      const mins = Math.floor(data.playTime / 60);
      const secs = data.playTime % 60;
      this.add.text(statsX, statsY, `⏱️ 플레이 시간: ${mins}분 ${secs}초`, {
        fontSize: '15px', color: '#fafafa',
      });
      statsY += lineHeight;
    }

    // Best record
    const record = ScoreManager.getBestRecord();
    if (record.bestWave > 0) {
      this.add.text(statsX, statsY, `🏆 최고 기록: W${record.bestWave} / ${record.bestScore}점`, {
        fontSize: '13px', color: '#ffd54f',
      });
    }

    // Tip text
    this.add.text(width / 2, panelY + panelH + 15, '💡 합성으로 상위 등급을 만들어 보세요!', {
      fontSize: '12px', color: '#888888',
    }).setOrigin(0.5);

    // Restart button
    const btnY = panelY + panelH + 50;
    const btnW = 180;
    const btnH = 48;
    const btnX = width / 2 - btnW / 2;

    const btnBg = this.add.graphics();
    btnBg.fillStyle(0x42a5f5, 0.85);
    btnBg.fillRoundedRect(btnX, btnY, btnW, btnH, 10);
    btnBg.lineStyle(2, 0xffffff, 0.3);
    btnBg.strokeRoundedRect(btnX, btnY, btnW, btnH, 10);

    this.add.text(width / 2, btnY + btnH / 2, '🔄 다시 시작', {
      fontSize: '18px', color: '#fafafa', fontStyle: 'bold',
    }).setOrigin(0.5);

    const hitArea = this.add.rectangle(width / 2, btnY + btnH / 2, btnW, btnH)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .setAlpha(0.001);

    hitArea.on('pointerup', () => {
      soundManager.playClick();
      this.scene.start('Game');
    });

    // Menu button
    const menuBtnY = btnY + btnH + 12;
    const menuText = this.add.text(width / 2, menuBtnY, '🏠 메인 메뉴', {
      fontSize: '14px', color: '#888888',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    menuText.on('pointerup', () => {
      soundManager.playClick();
      this.scene.start('Boot');
    });
  }
}
