/**
 * ScoreManager — Tracks score and persists best records to localStorage.
 */

export interface GameRecord {
  bestWave: number;
  bestScore: number;
}

export class ScoreManager {
  public score: number = 0;
  public waveClearCount: number = 0;
  public killCount: number = 0;
  public mergeCount: number = 0;

  private static STORAGE_KEY = 'dg_best_record';

  /** Score breakdown:
   *  - Wave clear: 100 × wave number
   *  - Enemy kill: 10
   *  - Merge: 50
   */
  public addWaveClear(waveNum: number): void {
    this.waveClearCount++;
    this.score += 100 * waveNum;
  }

  public addKill(): void {
    this.killCount++;
    this.score += 10;
  }

  public addMerge(): void {
    this.mergeCount++;
    this.score += 50;
  }

  public reset(): void {
    this.score = 0;
    this.waveClearCount = 0;
    this.killCount = 0;
    this.mergeCount = 0;
  }

  /** Save record if it's a new best. Returns true if new best. */
  public saveIfBest(wave: number): boolean {
    const existing = ScoreManager.getBestRecord();
    let isNew = false;
    const record: GameRecord = { ...existing };

    if (wave > record.bestWave) {
      record.bestWave = wave;
      isNew = true;
    }
    if (this.score > record.bestScore) {
      record.bestScore = this.score;
      isNew = true;
    }

    if (isNew) {
      try {
        localStorage.setItem(ScoreManager.STORAGE_KEY, JSON.stringify(record));
      } catch { /* ignore */ }
    }
    return isNew;
  }

  public static getBestRecord(): GameRecord {
    try {
      const data = localStorage.getItem(ScoreManager.STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        return {
          bestWave: parsed.bestWave || 0,
          bestScore: parsed.bestScore || 0,
        };
      }
    } catch { /* ignore */ }
    return { bestWave: 0, bestScore: 0 };
  }
}
