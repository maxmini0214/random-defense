import { UnitType, UnitGrade } from '../entities/Unit';

/**
 * Merge system: combines two same-grade units into a higher grade.
 */

export interface MergeResult {
  unitType: UnitType;
  grade: UnitGrade;
}

export class MergeSystem {
  private static gradeOrder: UnitGrade[] = ['common', 'rare', 'epic', 'legend', 'mythic'];
  private static unitTypes: UnitType[] = ['warrior', 'archer', 'mage', 'supporter', 'special'];

  public static canMerge(gradeA: UnitGrade, gradeB: UnitGrade): boolean {
    if (gradeA !== gradeB) return false;
    if (gradeA === 'mythic') return false;
    return true;
  }

  public static getNextGrade(grade: UnitGrade): UnitGrade | null {
    const idx = this.gradeOrder.indexOf(grade);
    if (idx < 0 || idx >= this.gradeOrder.length - 1) return null;
    return this.gradeOrder[idx + 1];
  }

  /**
   * Execute a merge: returns the resulting unit type and grade.
   * Unit type is random among 5 types.
   */
  public static merge(grade: UnitGrade): MergeResult | null {
    const nextGrade = this.getNextGrade(grade);
    if (!nextGrade) return null;

    const randomType = this.unitTypes[Math.floor(Math.random() * this.unitTypes.length)];
    return {
      unitType: randomType,
      grade: nextGrade,
    };
  }

  public static getGradeIndex(grade: UnitGrade): number {
    return this.gradeOrder.indexOf(grade);
  }
}
