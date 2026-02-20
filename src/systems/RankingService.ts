/**
 * RankingService — Online ranking via Firebase Realtime Database REST API.
 * Falls back to localStorage if Firebase is unavailable.
 */

export interface RankingEntry {
  nickname: string;
  score: number;
  wave: number;
  playTime: number; // seconds
  date: string; // ISO string
  id?: string;  // Firebase key
}

const FIREBASE_DB_URL = 'https://random-defense-ranking-default-rtdb.firebaseio.com';
const LOCAL_STORAGE_KEY = 'dg_rankings';
const LOCAL_NICKNAME_KEY = 'dg_nickname';
const MAX_ENTRIES = 100; // Keep top 100 in DB
const SUBMIT_COOLDOWN_MS = 5000; // 5 second cooldown between submissions

let lastSubmitTime = 0;

export class RankingService {
  private static cache: RankingEntry[] = [];
  private static cacheTime = 0;
  private static readonly CACHE_TTL = 30000; // 30 seconds

  /** Submit a score to the ranking */
  static async submitScore(entry: Omit<RankingEntry, 'id' | 'date'>): Promise<boolean> {
    // Cooldown check
    const now = Date.now();
    if (now - lastSubmitTime < SUBMIT_COOLDOWN_MS) {
      console.warn('Score submission too fast, skipped');
      return false;
    }
    lastSubmitTime = now;

    // Validate
    if (!this.validateEntry(entry)) return false;

    const fullEntry: Omit<RankingEntry, 'id'> = {
      ...entry,
      nickname: this.sanitizeNickname(entry.nickname),
      date: new Date().toISOString(),
    };

    try {
      const response = await fetch(`${FIREBASE_DB_URL}/scores.json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fullEntry),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      // Invalidate cache
      this.cacheTime = 0;

      // Also save to localStorage as backup
      this.saveLocal(fullEntry);
      return true;
    } catch (err) {
      console.warn('Firebase submit failed, saving locally:', err);
      this.saveLocal(fullEntry);
      return false;
    }
  }

  /** Fetch top N rankings */
  static async fetchRankings(limit: number = 20): Promise<RankingEntry[]> {
    // Return cache if fresh
    if (Date.now() - this.cacheTime < this.CACHE_TTL && this.cache.length > 0) {
      return this.cache.slice(0, limit);
    }

    try {
      const url = `${FIREBASE_DB_URL}/scores.json?orderBy="score"&limitToLast=${MAX_ENTRIES}`;
      const response = await fetch(url);

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      if (!data) return this.getLocalRankings(limit);

      const entries: RankingEntry[] = Object.entries(data).map(([key, val]) => {
        const v = val as Omit<RankingEntry, 'id'>;
        return {
          id: key,
          nickname: v.nickname || 'Player',
          score: v.score || 0,
          wave: v.wave || 0,
          playTime: v.playTime || 0,
          date: v.date || '',
        };
      });

      // Sort: score descending, then playTime ascending (faster = better)
      entries.sort((a, b) => b.score - a.score || (a.playTime || 9999) - (b.playTime || 9999));

      this.cache = entries;
      this.cacheTime = Date.now();

      return entries.slice(0, limit);
    } catch (err) {
      console.warn('Firebase fetch failed, using local:', err);
      return this.getLocalRankings(limit);
    }
  }

  /** Get ranking position for a given score */
  static async getRankPosition(score: number): Promise<number> {
    const rankings = await this.fetchRankings(MAX_ENTRIES);
    const position = rankings.findIndex(r => score >= r.score);
    if (position === -1) return rankings.length + 1;
    return position + 1;
  }

  /** Get nearby rankings (2 above and 2 below the player's position) */
  static async getNearbyRankings(score: number): Promise<{ rank: number; entries: (RankingEntry & { rank: number })[] }> {
    const rankings = await this.fetchRankings(MAX_ENTRIES);
    let myRank = rankings.findIndex(r => score >= r.score);
    if (myRank === -1) myRank = rankings.length;

    const start = Math.max(0, myRank - 2);
    const end = Math.min(rankings.length, myRank + 3);

    const entries = rankings.slice(start, end).map((entry, i) => ({
      ...entry,
      rank: start + i + 1,
    }));

    return { rank: myRank + 1, entries };
  }

  /** Save/load nickname */
  static saveNickname(nickname: string): void {
    try {
      localStorage.setItem(LOCAL_NICKNAME_KEY, this.sanitizeNickname(nickname));
    } catch { /* ignore */ }
  }

  static getSavedNickname(): string {
    try {
      return localStorage.getItem(LOCAL_NICKNAME_KEY) || '';
    } catch {
      return '';
    }
  }

  static generateDefaultNickname(): string {
    const saved = this.getSavedNickname();
    if (saved) return saved;
    const num = Math.floor(1000 + Math.random() * 9000);
    return `Player${num}`;
  }

  // ---- Private helpers ----

  private static validateEntry(entry: Omit<RankingEntry, 'id' | 'date'>): boolean {
    if (entry.score < 0 || entry.score > 99999) return false;
    if (entry.wave < 0 || entry.wave > 25) return false;
    if (!entry.nickname || entry.nickname.length > 12) return false;
    return true;
  }

  private static sanitizeNickname(name: string): string {
    // Remove potentially dangerous characters, keep alphanumeric + Korean + basic symbols
    return name
      .replace(/[<>{}()\[\]\\\/'"`;]/g, '')
      .trim()
      .slice(0, 12) || 'Player';
  }

  private static saveLocal(entry: Omit<RankingEntry, 'id'>): void {
    try {
      const existing = this.getLocalRankings(MAX_ENTRIES);
      existing.push({ ...entry, id: `local_${Date.now()}` });
      existing.sort((a, b) => b.score - a.score || (a.playTime || 9999) - (b.playTime || 9999));
      const trimmed = existing.slice(0, MAX_ENTRIES);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(trimmed));
    } catch { /* ignore */ }
  }

  private static getLocalRankings(limit: number): RankingEntry[] {
    try {
      const data = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (!data) return [];
      const parsed: RankingEntry[] = JSON.parse(data);
      return parsed.sort((a, b) => b.score - a.score || (a.playTime || 9999) - (b.playTime || 9999)).slice(0, limit);
    } catch {
      return [];
    }
  }
}
