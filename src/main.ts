import Phaser from 'phaser';
import { BootScene } from './scenes/Boot';
import { GameScene } from './scenes/Game';
import { GameOverScene } from './scenes/GameOver';
import { VictoryScene } from './scenes/Victory';
import gameConfig from './data/config.json';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: gameConfig.game.width,
  height: gameConfig.game.height,
  backgroundColor: gameConfig.game.backgroundColor,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, GameScene, GameOverScene, VictoryScene],
  input: {
    activePointers: 2,
  },
  render: {
    pixelArt: false,
    antialias: true,
  },
};

const game = new Phaser.Game(config);

// Responsive resize handler
function handleResize(): void {
  const w = window.innerWidth;
  const h = window.innerHeight;
  game.scale.resize(
    Math.min(w, gameConfig.game.width),
    Math.min(h, gameConfig.game.height)
  );
  game.scale.refresh();
}

window.addEventListener('resize', handleResize);

// Prevent default touch behaviors for smoother drag
document.addEventListener('touchmove', (e: TouchEvent) => {
  if (e.target && (e.target as HTMLElement).closest('#game-container')) {
    e.preventDefault();
  }
}, { passive: false });

// Prevent double-tap zoom on mobile
document.addEventListener('dblclick', (e: Event) => {
  e.preventDefault();
}, { passive: false });
