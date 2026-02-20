/**
 * NicknamePopup — Phaser-based nickname input popup using DOM element.
 */
import Phaser from 'phaser';
import { RankingService } from '../systems/RankingService';

export interface NicknameResult {
  nickname: string;
}

export class NicknamePopup {
  private scene: Phaser.Scene;
  private overlay: Phaser.GameObjects.Graphics;
  private panel: Phaser.GameObjects.Graphics;
  private texts: Phaser.GameObjects.Text[] = [];
  private inputElement: Phaser.GameObjects.DOMElement | null = null;
  private onComplete: (result: NicknameResult) => void;
  private destroyed = false;

  constructor(scene: Phaser.Scene, onComplete: (result: NicknameResult) => void) {
    this.scene = scene;
    this.onComplete = onComplete;

    const { width, height } = scene.cameras.main;

    // Dark overlay
    this.overlay = scene.add.graphics();
    this.overlay.fillStyle(0x000000, 0.6);
    this.overlay.fillRect(0, 0, width, height);
    this.overlay.setDepth(400);

    // Panel
    const panelW = width - 40;
    const panelH = 200;
    const panelX = 20;
    const panelY = (height - panelH) / 2;

    this.panel = scene.add.graphics();
    this.panel.fillStyle(0x2d2d44, 0.95);
    this.panel.fillRoundedRect(panelX, panelY, panelW, panelH, 16);
    this.panel.lineStyle(2, 0xffd54f, 0.8);
    this.panel.strokeRoundedRect(panelX, panelY, panelW, panelH, 16);
    this.panel.setDepth(401);

    // Title
    const title = scene.add.text(width / 2, panelY + 24, '🏆 닉네임 입력', {
      fontSize: '18px',
      color: '#ffd54f',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(402);
    this.texts.push(title);

    // Subtitle
    const subtitle = scene.add.text(width / 2, panelY + 50, '랭킹에 등록할 닉네임을 입력하세요', {
      fontSize: '11px',
      color: '#aaaaaa',
    }).setOrigin(0.5).setDepth(402);
    this.texts.push(subtitle);

    // Create HTML input element
    const defaultName = RankingService.generateDefaultNickname();
    const inputHtml = document.createElement('input');
    inputHtml.type = 'text';
    inputHtml.maxLength = 12;
    inputHtml.value = defaultName;
    inputHtml.placeholder = '닉네임 (최대 12자)';
    inputHtml.style.cssText = `
      width: ${panelW - 60}px;
      height: 36px;
      font-size: 16px;
      text-align: center;
      background: #1a1a2e;
      color: #fafafa;
      border: 2px solid #42a5f5;
      border-radius: 8px;
      outline: none;
      padding: 0 8px;
      font-family: inherit;
    `;

    this.inputElement = scene.add.dom(width / 2, panelY + 90, inputHtml).setDepth(403);

    // Focus the input
    setTimeout(() => inputHtml.focus(), 100);

    // Enter key handler
    inputHtml.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        this.submit(inputHtml.value);
      }
    });

    // Submit button
    const btnY = panelY + 135;
    const btnW = 140;
    const btnH = 42;
    const btnX = width / 2 - btnW / 2;

    const btnBg = scene.add.graphics();
    btnBg.fillStyle(0x42a5f5, 0.85);
    btnBg.fillRoundedRect(btnX, btnY, btnW, btnH, 10);
    btnBg.lineStyle(2, 0xffffff, 0.3);
    btnBg.strokeRoundedRect(btnX, btnY, btnW, btnH, 10);
    btnBg.setDepth(402);

    const btnText = scene.add.text(width / 2, btnY + btnH / 2, '✅ 등록', {
      fontSize: '16px',
      color: '#fafafa',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(403);
    this.texts.push(btnText);

    const hitArea = scene.add.rectangle(width / 2, btnY + btnH / 2, btnW, btnH)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .setAlpha(0.001)
      .setDepth(404);

    hitArea.on('pointerup', () => {
      this.submit(inputHtml.value);
    });

    // Skip button
    const skipText = scene.add.text(width / 2, btnY + btnH + 16, '건너뛰기', {
      fontSize: '12px',
      color: '#666666',
    }).setOrigin(0.5).setDepth(402).setInteractive({ useHandCursor: true });
    this.texts.push(skipText);

    skipText.on('pointerup', () => {
      this.submit('');
    });

    // Store references for cleanup
    this.texts.push(btnText);
    // Store extra game objects for cleanup
    (this as Record<string, unknown>)['_btnBg'] = btnBg;
    (this as Record<string, unknown>)['_hitArea'] = hitArea;
  }

  private submit(value: string): void {
    if (this.destroyed) return;
    this.destroyed = true;

    const nickname = value.trim() || RankingService.generateDefaultNickname();
    RankingService.saveNickname(nickname);

    this.destroy();
    this.onComplete({ nickname });
  }

  private destroy(): void {
    this.overlay.destroy();
    this.panel.destroy();
    for (const t of this.texts) t.destroy();
    if (this.inputElement) this.inputElement.destroy();
    const btnBg = (this as Record<string, unknown>)['_btnBg'] as Phaser.GameObjects.Graphics | undefined;
    const hitArea = (this as Record<string, unknown>)['_hitArea'] as Phaser.GameObjects.Rectangle | undefined;
    if (btnBg) btnBg.destroy();
    if (hitArea) hitArea.destroy();
  }
}
