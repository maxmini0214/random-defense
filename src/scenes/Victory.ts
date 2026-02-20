import Phaser from 'phaser';
import configData from '../data/config.json';
import { UnitGrade } from '../entities/Unit';
import { ScoreManager } from '../systems/ScoreManager';
import { RankingService } from '../systems/RankingService';
import { soundManager } from '../systems/SoundManager';
import { NicknamePopup } from '../ui/NicknamePopup';

interface VictoryData {
  kills?: number;
  playTime?: number;
  highestGrade?: UnitGrade;
  score?: number;
}

export class VictoryScene extends Phaser.Scene {
  constructor() {
    super({ key: 'Victory' });
  }

  create(data: VictoryData): void {
    const { width, height } = this.cameras.main;

    this.cameras.main.setBackgroundColor(configData.colors.background);

    // Celebration particle burst
    this.spawnCelebrationParticles(width, height);

    // Title with bounce animation
    const title = this.add.text(width / 2, height * 0.10, '🎉 승리! 🎉', {
      fontSize: '36px',
      color: '#ffd54f',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5).setScale(0).setDepth(10);

    this.tweens.add({
      targets: title,
      scaleX: 1.1,
      scaleY: 1.1,
      duration: 500,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: title,
          scaleX: 1,
          scaleY: 1,
          duration: 200,
          ease: 'Sine.easeInOut',
        });
      },
    });

    this.add.text(width / 2, height * 0.17, '모든 웨이브를 클리어했습니다!', {
      fontSize: '13px',
      color: '#fafafa',
    }).setOrigin(0.5).setDepth(10);

    // Stats panel
    const panelY = height * 0.22;
    const panelW = width - 60;
    const panelH = 160;
    const panelX = 30;

    const panel = this.add.graphics();
    panel.fillStyle(0x2d2d44, 0.9);
    panel.fillRoundedRect(panelX, panelY, panelW, panelH, 12);
    panel.lineStyle(2, 0xffd54f, 0.5);
    panel.strokeRoundedRect(panelX, panelY, panelW, panelH, 12);
    panel.setDepth(10);

    const statsX = panelX + 20;
    let statsY = panelY + 16;
    const lineHeight = 26;

    if (data.kills !== undefined) {
      this.add.text(statsX, statsY, `⚔️ 총 처치 수: ${data.kills}`, {
        fontSize: '14px', color: '#66bb6a', fontStyle: 'bold',
      }).setDepth(10);
      statsY += lineHeight;
    }

    if (data.score !== undefined) {
      this.add.text(statsX, statsY, `🏅 최종 점수: ${data.score}`, {
        fontSize: '14px', color: '#ffd54f', fontStyle: 'bold',
      }).setDepth(10);
      statsY += lineHeight;
    }

    if (data.highestGrade) {
      const gradeNames: Record<string, string> = {
        common: '커먼 ⭐', rare: '레어 ⭐⭐', epic: '에픽 ⭐⭐⭐',
        legend: '레전드 ⭐⭐⭐⭐', mythic: '미시크 ⭐⭐⭐⭐⭐',
      };
      const gradeColor = (configData.colors.grade as Record<string, string>)[data.highestGrade];
      this.add.text(statsX, statsY, `👑 최고 등급: ${gradeNames[data.highestGrade]}`, {
        fontSize: '14px', color: gradeColor, fontStyle: 'bold',
      }).setDepth(10);
      statsY += lineHeight;
    }

    if (data.playTime !== undefined) {
      const mins = Math.floor(data.playTime / 60);
      const secs = data.playTime % 60;
      this.add.text(statsX, statsY, `⏱️ 플레이 시간: ${mins}분 ${secs}초`, {
        fontSize: '14px', color: '#fafafa',
      }).setDepth(10);
      statsY += lineHeight;
    }

    this.add.text(statsX, statsY, `🌊 25/25 웨이브 완료`, {
      fontSize: '14px', color: '#42a5f5', fontStyle: 'bold',
    }).setDepth(10);

    // Best record
    const record = ScoreManager.getBestRecord();
    if (record.bestScore > 0) {
      this.add.text(width / 2, panelY + panelH + 8, `🏆 최고 기록: ${record.bestScore}점`, {
        fontSize: '12px', color: '#ffd54f',
      }).setOrigin(0.5).setDepth(10);
    }

    // Show nickname popup for ranking
    if (data.score && data.score > 0) {
      this.time.delayedCall(600, () => {
        new NicknamePopup(this, async (result) => {
          await RankingService.submitScore({
            nickname: result.nickname,
            score: data.score!,
            wave: 25,
            playTime: data.playTime || 0,
          });

          // Show nearby rankings
          this.showNearbyRankings(data.score!, panelY + panelH + 26);
        });
      });
    }

    // Buttons
    this.createButtons(width, height);

    // Continuous celebration
    this.time.addEvent({
      delay: 800,
      callback: () => this.spawnCelebrationParticles(width, height),
      loop: true,
    });
  }

  private async showNearbyRankings(score: number, startY: number): Promise<void> {
    const { width } = this.cameras.main;

    try {
      const { rank, entries } = await RankingService.getNearbyRankings(score);

      const rankPanelX = 30;
      const rankPanelW = width - 60;
      const rankPanelH = Math.min(entries.length * 24 + 44, 170);

      const bg = this.add.graphics();
      bg.fillStyle(0x2d2d44, 0.85);
      bg.fillRoundedRect(rankPanelX, startY, rankPanelW, rankPanelH, 10);
      bg.lineStyle(1, 0xffd54f, 0.3);
      bg.strokeRoundedRect(rankPanelX, startY, rankPanelW, rankPanelH, 10);
      bg.setDepth(10);

      this.add.text(width / 2, startY + 14, `📊 내 순위: ${rank}위`, {
        fontSize: '13px', color: '#ffd54f', fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(10);

      const myNickname = RankingService.getSavedNickname();
      let y = startY + 34;

      for (const entry of entries) {
        const isMe = entry.nickname === myNickname && entry.rank === rank;
        const color = isMe ? '#42a5f5' : '#cccccc';
        const prefix = isMe ? '▶ ' : '  ';

        this.add.text(rankPanelX + 14, y, `${prefix}${entry.rank}. ${entry.nickname}`, {
          fontSize: '11px', color, fontStyle: isMe ? 'bold' : 'normal',
        }).setDepth(10);
        this.add.text(rankPanelX + rankPanelW - 14, y, `${entry.score}`, {
          fontSize: '11px', color: '#ffd54f',
        }).setOrigin(1, 0).setDepth(10);

        y += 22;
      }
    } catch {
      // Silently fail
    }
  }

  private createButtons(width: number, height: number): void {
    const btnY = height * 0.78;
    const btnW = 180;
    const btnH = 48;
    const btnX = width / 2 - btnW / 2;

    const btnBg = this.add.graphics();
    btnBg.fillStyle(0xffd54f, 0.85);
    btnBg.fillRoundedRect(btnX, btnY, btnW, btnH, 10);
    btnBg.lineStyle(2, 0xffffff, 0.3);
    btnBg.strokeRoundedRect(btnX, btnY, btnW, btnH, 10);
    btnBg.setDepth(10);

    this.add.text(width / 2, btnY + btnH / 2, '🔄 다시 시작', {
      fontSize: '18px', color: '#1a1a2e', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(10);

    const hitArea = this.add.rectangle(width / 2, btnY + btnH / 2, btnW, btnH)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .setAlpha(0.001)
      .setDepth(11);

    hitArea.on('pointerup', () => {
      soundManager.playClick();
      this.scene.start('Game');
    });

    const menuBtnY = btnY + btnH + 12;
    const menuText = this.add.text(width / 2, menuBtnY, '🏠 메인 메뉴', {
      fontSize: '14px', color: '#888888',
    }).setOrigin(0.5).setDepth(10).setInteractive({ useHandCursor: true });

    menuText.on('pointerup', () => {
      soundManager.playClick();
      this.scene.start('Boot');
    });
  }

  private spawnCelebrationParticles(width: number, height: number): void {
    const colors = [0xffd54f, 0xff5252, 0x42a5f5, 0x66bb6a, 0xab47bc, 0xff1744, 0xffee58];
    const count = 20;

    for (let i = 0; i < count; i++) {
      const g = this.add.graphics();
      const color = colors[Math.floor(Math.random() * colors.length)];
      const size = 2 + Math.random() * 4;

      g.fillStyle(color, 0.9);
      if (Math.random() > 0.5) {
        g.fillCircle(0, 0, size);
      } else {
        g.fillRect(-size, -size, size * 2, size * 2);
      }

      const startX = Math.random() * width;
      const startY = -10 - Math.random() * 50;
      g.setPosition(startX, startY);
      g.setDepth(5);

      this.tweens.add({
        targets: g,
        y: height + 20,
        x: startX + (Math.random() - 0.5) * 100,
        rotation: Math.random() * Math.PI * 4,
        alpha: 0,
        duration: 2000 + Math.random() * 2000,
        ease: 'Sine.easeIn',
        onComplete: () => g.destroy(),
      });
    }
  }
}
