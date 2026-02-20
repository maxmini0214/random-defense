/**
 * RankingBoard — Displays top rankings as a Phaser overlay.
 */
import Phaser from 'phaser';
import { RankingService, RankingEntry } from '../systems/RankingService';
import { soundManager } from '../systems/SoundManager';

export class RankingBoard {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private isVisible = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0).setDepth(300).setVisible(false);
  }

  async show(): Promise<void> {
    if (this.isVisible) {
      this.hide();
      return;
    }
    this.isVisible = true;
    this.container.removeAll(true);
    this.container.setVisible(true);

    const { width, height } = this.scene.cameras.main;

    // Overlay
    const overlay = this.scene.add.graphics();
    overlay.fillStyle(0x000000, 0.7);
    overlay.fillRect(0, 0, width, height);
    overlay.setInteractive(new Phaser.Geom.Rectangle(0, 0, width, height), Phaser.Geom.Rectangle.Contains);
    this.container.add(overlay);

    // Panel
    const panelX = 15;
    const panelY = 40;
    const panelW = width - 30;
    const panelH = height - 80;

    const panel = this.scene.add.graphics();
    panel.fillStyle(0x1a1a2e, 0.95);
    panel.fillRoundedRect(panelX, panelY, panelW, panelH, 16);
    panel.lineStyle(2, 0xffd54f, 0.6);
    panel.strokeRoundedRect(panelX, panelY, panelW, panelH, 16);
    this.container.add(panel);

    // Title
    const title = this.scene.add.text(width / 2, panelY + 22, '🏆 온라인 랭킹', {
      fontSize: '20px',
      color: '#ffd54f',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.container.add(title);

    // Loading text
    const loading = this.scene.add.text(width / 2, height / 2, '불러오는 중...', {
      fontSize: '14px',
      color: '#888888',
    }).setOrigin(0.5);
    this.container.add(loading);

    // Close button
    const closeBtn = this.scene.add.text(panelX + panelW - 16, panelY + 12, '✕', {
      fontSize: '20px',
      color: '#888888',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerup', () => {
      soundManager.playClick();
      this.hide();
    });
    this.container.add(closeBtn);

    // Click overlay to close
    overlay.on('pointerup', () => this.hide());

    // Fetch rankings
    try {
      const rankings = await RankingService.fetchRankings(20);
      loading.destroy();

      if (rankings.length === 0) {
        const noData = this.scene.add.text(width / 2, height / 2, '아직 기록이 없습니다\n첫 번째 기록을 남겨보세요! 🎮', {
          fontSize: '13px',
          color: '#aaaaaa',
          align: 'center',
        }).setOrigin(0.5);
        this.container.add(noData);
        return;
      }

      // Header
      const headerY = panelY + 50;
      const colRank = panelX + 16;
      const colName = panelX + 46;
      const colScore = panelX + panelW - 46;
      const colWave = panelX + panelW - 100;

      const headerStyle = { fontSize: '10px', color: '#888888' };
      this.container.add(this.scene.add.text(colRank, headerY, '#', headerStyle));
      this.container.add(this.scene.add.text(colName, headerY, '닉네임', headerStyle));
      this.container.add(this.scene.add.text(colWave, headerY, '웨이브', headerStyle));
      this.container.add(this.scene.add.text(colScore, headerY, '점수', { ...headerStyle }).setOrigin(1, 0));

      // Separator
      const sep = this.scene.add.graphics();
      sep.lineStyle(1, 0xffffff, 0.1);
      sep.lineBetween(panelX + 10, headerY + 16, panelX + panelW - 10, headerY + 16);
      this.container.add(sep);

      // My nickname for highlighting
      const myNickname = RankingService.getSavedNickname();

      // Rows
      const startY = headerY + 24;
      const rowHeight = 26;

      rankings.forEach((entry, i) => {
        const y = startY + i * rowHeight;
        if (y > panelY + panelH - 30) return; // Don't overflow

        const isMe = entry.nickname === myNickname;
        const rank = i + 1;

        // Rank medal
        let rankText = `${rank}`;
        if (rank === 1) rankText = '🥇';
        else if (rank === 2) rankText = '🥈';
        else if (rank === 3) rankText = '🥉';

        const color = isMe ? '#42a5f5' : '#fafafa';
        const alpha = isMe ? 1 : (i < 3 ? 0.95 : 0.7);

        // Highlight row for my record
        if (isMe) {
          const rowBg = this.scene.add.graphics();
          rowBg.fillStyle(0x42a5f5, 0.1);
          rowBg.fillRoundedRect(panelX + 8, y - 4, panelW - 16, rowHeight - 2, 4);
          this.container.add(rowBg);
        }

        const style = { fontSize: '12px', color, fontStyle: isMe ? 'bold' : 'normal' };

        this.container.add(
          this.scene.add.text(colRank, y, rankText, { fontSize: rank <= 3 ? '14px' : '12px', color }).setAlpha(alpha)
        );
        this.container.add(
          this.scene.add.text(colName, y, this.truncate(entry.nickname, 8), style as Phaser.Types.GameObjects.Text.TextStyle).setAlpha(alpha)
        );
        this.container.add(
          this.scene.add.text(colWave, y, `W${entry.wave}`, { fontSize: '11px', color: '#42a5f5' }).setAlpha(alpha)
        );
        this.container.add(
          this.scene.add.text(colScore, y, `${entry.score}`, { fontSize: '12px', color: '#ffd54f', fontStyle: 'bold' }).setOrigin(1, 0).setAlpha(alpha)
        );
      });

    } catch (err) {
      loading.setText('랭킹을 불러올 수 없습니다');
    }
  }

  hide(): void {
    this.isVisible = false;
    this.container.setVisible(false);
    this.container.removeAll(true);
  }

  private truncate(str: string, max: number): string {
    if (str.length <= max) return str;
    return str.slice(0, max) + '…';
  }
}
