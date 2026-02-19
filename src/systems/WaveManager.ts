import Phaser from 'phaser';
import wavesData from '../data/waves.json';
import configData from '../data/config.json';
import { Enemy, EnemyType } from '../entities/Enemy';

interface WaveGroup {
  type: EnemyType;
  count: number;
  hp: number;
}

interface WaveData {
  wave: number;
  groups: WaveGroup[];
  reward: number;
}

export class WaveManager {
  public currentWave: number = 0;
  public isSpawning: boolean = false;
  public isPreparing: boolean = false;
  public enemies: Enemy[] = [];

  private scene: Phaser.Scene;
  private path: Phaser.Curves.Path;
  private waves: WaveData[];
  private spawnQueue: Array<{ type: EnemyType; hp: number }> = [];
  private spawnTimer: Phaser.Time.TimerEvent | null = null;
  private prepareTimer: Phaser.Time.TimerEvent | null = null;
  private onWaveClear: (reward: number) => void;
  private onEnemyReachEnd: (enemy: Enemy) => void;
  private onEnemyKilled: (enemy: Enemy) => void;
  private onWaveStart: ((waveNum: number) => void) | null;

  constructor(
    scene: Phaser.Scene,
    path: Phaser.Curves.Path,
    callbacks: {
      onWaveClear: (reward: number) => void;
      onEnemyReachEnd: (enemy: Enemy) => void;
      onEnemyKilled: (enemy: Enemy) => void;
      onWaveStart?: (waveNum: number) => void;
    }
  ) {
    this.scene = scene;
    this.path = path;
    this.waves = wavesData.waves as WaveData[];
    this.onWaveClear = callbacks.onWaveClear;
    this.onEnemyReachEnd = callbacks.onEnemyReachEnd;
    this.onEnemyKilled = callbacks.onEnemyKilled;
    this.onWaveStart = callbacks.onWaveStart || null;
  }

  public startNextWave(): void {
    if (this.currentWave >= this.waves.length) return;

    const waveData = this.waves[this.currentWave];
    this.currentWave++;

    // Build spawn queue
    this.spawnQueue = [];
    for (const group of waveData.groups) {
      for (let i = 0; i < group.count; i++) {
        this.spawnQueue.push({ type: group.type as EnemyType, hp: group.hp });
      }
    }

    // Shuffle spawn queue for mixed waves
    this.shuffleArray(this.spawnQueue);

    this.isSpawning = true;
    this.isPreparing = false;
    this.onWaveStart?.(this.currentWave);
    this.spawnNext();
  }

  private spawnNext(): void {
    if (this.spawnQueue.length === 0) {
      this.isSpawning = false;
      return;
    }

    const data = this.spawnQueue.shift()!;
    const enemy = new Enemy(this.scene, data.type, data.hp, this.path);
    this.enemies.push(enemy);

    if (this.spawnQueue.length > 0) {
      this.spawnTimer = this.scene.time.delayedCall(
        configData.wave.spawnInterval,
        () => this.spawnNext()
      );
    } else {
      this.isSpawning = false;
    }
  }

  public update(delta: number): void {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];

      if (enemy.isDead) {
        this.onEnemyKilled(enemy);
        this.enemies.splice(i, 1);
        continue;
      }

      enemy.moveAlongPath(this.path, delta);

      if (enemy.reachedEnd) {
        this.onEnemyReachEnd(enemy);
        this.enemies.splice(i, 1);
        continue;
      }
    }

    // Check wave clear
    if (
      !this.isSpawning &&
      this.enemies.length === 0 &&
      this.currentWave > 0 &&
      !this.isPreparing
    ) {
      this.onWaveCleared();
    }
  }

  private onWaveCleared(): void {
    const waveData = this.waves[this.currentWave - 1];
    this.onWaveClear(waveData.reward);

    if (this.currentWave >= this.waves.length) {
      // All waves complete — victory!
      return;
    }

    // Prepare for next wave
    this.isPreparing = true;
    this.prepareTimer = this.scene.time.delayedCall(
      configData.wave.prepareTime,
      () => {
        this.startNextWave();
      }
    );
  }

  public skipPrepare(): boolean {
    if (!this.isPreparing || !this.prepareTimer) return false;

    this.prepareTimer.remove();
    this.prepareTimer = null;
    this.startNextWave();
    return true;
  }

  public getTotalWaves(): number {
    return this.waves.length;
  }

  public isAllWavesClear(): boolean {
    return this.currentWave >= this.waves.length && this.enemies.length === 0 && !this.isSpawning;
  }

  private shuffleArray<T>(arr: T[]): void {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  public destroy(): void {
    this.spawnTimer?.remove();
    this.prepareTimer?.remove();
    this.enemies.forEach(e => {
      if (!e.isDead) e.destroy();
    });
    this.enemies = [];
  }
}
