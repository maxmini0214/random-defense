import { Unit, UnitGrade } from '../entities/Unit';

/**
 * Placeholder for merge system (D6+).
 * Handles combining two same-grade units into a higher grade.
 */
export class MergeSystem {
  private static gradeOrder: UnitGrade[] = ['common', 'rare', 'epic', 'legend', 'mythic'];

  public static canMerge(unitA: Unit, unitB: Unit): boolean {
    if (unitA === unitB) return false;
    if (unitA.grade !== unitB.grade) return false;
    if (unitA.grade === 'mythic') return false; // Can't merge max grade
    return true;
  }

  public static getNextGrade(grade: UnitGrade): UnitGrade | null {
    const idx = this.gradeOrder.indexOf(grade);
    if (idx < 0 || idx >= this.gradeOrder.length - 1) return null;
    return this.gradeOrder[idx + 1];
  }
}
