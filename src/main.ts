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

new Phaser.Game(config);
