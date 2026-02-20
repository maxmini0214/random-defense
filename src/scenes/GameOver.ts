import Phaser from 'phaser';
import configData from '../data/config.json';
import { UnitGrade } from '../entities/Unit';
import { ScoreManager } from '../systems/ScoreManager';
import { RankingService, RankingEntry } from '../systems/RankingService';
import { soundManager } from '../systems/SoundManager';
import { NicknamePopup } from '../ui/NicknamePopup';

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
    const title = this.add.text(width / 2, height * 0.12, '💀 게임 오버', {
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
    const panelY = height * 0.20;
    const panelW = width - 60;
    const panelH = 180;
    const panelX = 30;

    const panel = this.add.graphics();
    panel.fillStyle(0x2d2d44, 0.9);
    panel.fillRoundedRect(panelX, panelY, panelW, panelH, 12);
    panel.lineStyle(2, 0xef5350, 0.5);
    panel.strokeRoundedRect(panelX, panelY, panelW, panelH, 12);

    const statsX = panelX + 20;
    let statsY = panelY + 16;
    const lineHeight = 26;

    if (data.wave) {
      this.add.text(statsX, statsY, `🌊 도달 웨이브: ${data.wave} / ${configData.wave.totalWaves}`, {
        fontSize: '14px', color: '#42a5f5', fontStyle: 'bold',
      });
      statsY += lineHeight;
    }

    if (data.kills !== undefined) {
      this.add.text(statsX, statsY, `⚔️ 처치 수: ${data.kills}`, {
        fontSize: '14px', color: '#66bb6a', fontStyle: 'bold',
      });
      statsY += lineHeight;
    }

    if (data.score !== undefined) {
      this.add.text(statsX, statsY, `🏅 점수: ${data.score}`, {
        fontSize: '14px', color: '#ffd54f', fontStyle: 'bold',
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
        fontSize: '14px', color: gradeColor, fontStyle: 'bold',
      });
      statsY += lineHeight;
    }

    if (data.playTime !== undefined) {
      const mins = Math.floor(data.playTime / 60);
      const secs = data.playTime % 60;
      this.add.text(statsX, statsY, `⏱️ 플레이 시간: ${mins}분 ${secs}초`, {
        fontSize: '14px', color: '#fafafa',
      });
      statsY += lineHeight;
    }

    // Best record
    const record = ScoreManager.getBestRecord();
    if (record.bestWave > 0) {
      this.add.text(statsX, statsY, `🏆 최고 기록: W${record.bestWave} / ${record.bestScore}점`, {
        fontSize: '12px', color: '#ffd54f',
      });
    }

    // Show nickname popup for ranking
    if (data.score && data.score > 0) {
      this.time.delayedCall(600, () => {
        new NicknamePopup(this, async (result) => {
          // Submit to ranking
          await RankingService.submitScore({
            nickname: result.nickname,
            score: data.score!,
            wave: data.wave || 0,
            playTime: data.playTime || 0,
          });

          // Show nearby rankings
          this.showNearbyRankings(data.score!, panelY + panelH + 10);
        });
      });
    }

    // Buttons (positioned lower to make room for rankings)
    this.createButtons(width, height, panelY + panelH);
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

      this.add.text(width / 2, startY + 14, `📊 내 순위: ${rank}위`, {
        fontSize: '13px',
        color: '#ffd54f',
        fontStyle: 'bold',
      }).setOrigin(0.5);

      const myNickname = RankingService.getSavedNickname();
      let y = startY + 34;

      for (const entry of entries) {
        const isMe = entry.nickname === myNickname && entry.rank === rank;
        const color = isMe ? '#42a5f5' : '#cccccc';
        const prefix = isMe ? '▶ ' : '  ';

        this.add.text(rankPanelX + 14, y, `${prefix}${entry.rank}. ${entry.nickname}`, {
          fontSize: '11px', color, fontStyle: isMe ? 'bold' : 'normal',
        });
        this.add.text(rankPanelX + rankPanelW - 14, y, `${entry.score}`, {
          fontSize: '11px', color: '#ffd54f',
        }).setOrigin(1, 0);

        y += 22;
      }
    } catch {
      // Silently fail - rankings are optional
    }
  }

  private createButtons(width: number, height: number, _panelBottom: number): void {
    // Restart button
    const btnY = height * 0.78;
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
