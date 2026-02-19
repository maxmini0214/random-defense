import configData from '../data/config.json';
import { UnitType, UnitGrade } from '../entities/Unit';

interface SummonResult {
  unitType: UnitType;
  grade: UnitGrade;
}

export class SummonSystem {
  private gradeRates: Array<{ grade: UnitGrade; weight: number }>;
  private unitTypes: UnitType[];

  constructor() {
    const gradeConfig = configData.summonRates.grade as Record<string, number>;
    this.gradeRates = Object.entries(gradeConfig).map(([grade, weight]) => ({
      grade: grade as UnitGrade,
      weight,
    }));

    this.unitTypes = Object.keys(configData.summonRates.type) as UnitType[];
  }

  /**
   * Roll a random unit type and grade based on configured probabilities.
   */
  public roll(): SummonResult {
    return {
      unitType: this.rollUnitType(),
      grade: this.rollGrade(),
    };
  }

  private rollGrade(): UnitGrade {
    const rand = Math.random();
    let cumulative = 0;

    for (const { grade, weight } of this.gradeRates) {
      cumulative += weight;
      if (rand <= cumulative) {
        return grade;
      }
    }

    // Fallback (shouldn't reach here if weights sum to 1)
    return 'common';
  }

  private rollUnitType(): UnitType {
    const index = Math.floor(Math.random() * this.unitTypes.length);
    return this.unitTypes[index];
  }
}
