import configData from '../data/config.json';
import { EnemyType } from '../entities/Enemy';

export class EconomyManager {
  public gold: number;
  private onChangeCallbacks: Array<() => void> = [];

  constructor() {
    this.gold = configData.economy.startingGold;
  }

  public canAfford(cost: number): boolean {
    return this.gold >= cost;
  }

  public spend(amount: number): boolean {
    if (!this.canAfford(amount)) return false;
    this.gold -= amount;
    this.notifyChange();
    return true;
  }

  public earn(amount: number): void {
    this.gold += amount;
    this.notifyChange();
  }

  public getKillReward(enemyType: EnemyType): number {
    return (configData.economy.killReward as Record<string, number>)[enemyType] || 5;
  }

  public getSummonCost(): number {
    return configData.economy.summonCost;
  }

  public getSellReturn(): number {
    return configData.economy.sellReturn;
  }

  public onChange(callback: () => void): void {
    this.onChangeCallbacks.push(callback);
  }

  private notifyChange(): void {
    this.onChangeCallbacks.forEach(cb => cb());
  }
}
