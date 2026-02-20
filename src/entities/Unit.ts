import Phaser from 'phaser';
import unitsData from '../data/units.json';
import configData from '../data/config.json';
import { Enemy } from './Enemy';
import { Projectile } from './Projectile';

export type UnitType = 'warrior' | 'archer' | 'mage' | 'supporter' | 'special';
export type UnitGrade = 'common' | 'rare' | 'epic' | 'legend' | 'mythic';

interface AbilityDef {
  type: string;
  [key: string]: unknown;
}

interface UnitStats {
  atk: number;
  attackSpeed: number;
  range: number;
  abilities: AbilityDef[];
}

/** Buff applied by supporters */
export interface UnitBuff {
  atkPercent: number;
  speedPercent: number;
  rangePercent: number;
}

export class Unit extends Phaser.GameObjects.Container {
  public unitType: UnitType;
  public grade: UnitGrade;
  public stats: UnitStats;
  public slotIndex: number;
  public gridCol: number = -1;
  public gridRow: number = -1;

  // Attack state
  private attackCooldown: number = 0;
  private rangeCircle: Phaser.GameObjects.Graphics;
  private attackFlash: Phaser.GameObjects.Graphics;

  // Buff from supporters
  public buff: UnitBuff = { atkPercent: 0, speedPercent: 0, rangePercent: 0 };

  // Projectile tracking
  public projectiles: Projectile[] = [];

  // Freeze timer for special mythic
  private freezeAccum: number = 0;

  // Archer burst state
  private archerBurstRemaining: number = 0;
  private archerBurstDelay: number = 0;
  private archerBurstTarget: Enemy | null = null;

  // Damage popup callback (set by Game scene)
  public onDamageDealt: ((x: number, y: number, damage: number, isCrit: boolean) => void) | null = null;

  private baseCircle: Phaser.GameObjects.Graphics;
  private iconText: Phaser.GameObjects.Text;
  private gradeIndicator: Phaser.GameObjects.Graphics;
  private buffGlow: Phaser.GameObjects.Graphics;
  private mythicPulseTimer: number = 0;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    unitType: UnitType,
    grade: UnitGrade,
    slotIndex: number
  ) {
    super(scene, x, y);

    this.unitType = unitType;
    this.grade = grade;
    this.slotIndex = slotIndex;

    const unitData = (unitsData as Record<string, { name: string; icon: string; stats: Record<string, UnitStats> }>)[unitType];
    this.stats = { ...unitData.stats[grade] };

    // Draw base circle with grade color
    this.baseCircle = scene.add.graphics();
    this.drawBase();
    this.add(this.baseCircle);

    // Grade stars indicator
    this.gradeIndicator = scene.add.graphics();
    this.drawGradeIndicator();
    this.add(this.gradeIndicator);

    // Icon text
    this.iconText = scene.add.text(0, -2, unitData.icon, {
      fontSize: '18px',
    }).setOrigin(0.5);
    this.add(this.iconText);

    // Buff glow indicator
    this.buffGlow = scene.add.graphics();
    this.add(this.buffGlow);

    // Range circle (hidden by default)
    this.rangeCircle = scene.add.graphics();
    this.rangeCircle.setAlpha(0);
    this.add(this.rangeCircle);

    // Attack flash effect
    this.attackFlash = scene.add.graphics();
    this.add(this.attackFlash);

    scene.add.existing(this);
  }

  private drawBase(): void {
    const gradeColor = Phaser.Display.Color.HexStringToColor(
      (configData.colors.grade as Record<string, string>)[this.grade]
    ).color;
    const typeColor = Phaser.Display.Color.HexStringToColor(
      (configData.colors.unitType as Record<string, string>)[this.unitType]
    ).color;

    const radius = 22;

    this.baseCircle.clear();

    if (this.grade === 'mythic') {
      this.baseCircle.fillStyle(0xff1744, 0.3);
      this.baseCircle.fillCircle(0, 0, radius + 3);
      this.baseCircle.fillStyle(0xff5252, 0.9);
      this.baseCircle.fillCircle(0, 0, radius);
      this.baseCircle.fillStyle(typeColor, 0.8);
      this.baseCircle.fillCircle(0, 0, radius - 4);
      this.baseCircle.lineStyle(2, 0xff1744, 1);
      this.baseCircle.strokeCircle(0, 0, radius);
      this.baseCircle.lineStyle(1, 0xffffff, 0.5);
      this.baseCircle.strokeCircle(0, 0, radius + 3);
    } else if (this.grade === 'legend') {
      this.baseCircle.fillStyle(gradeColor, 0.9);
      this.baseCircle.fillCircle(0, 0, radius);
      this.baseCircle.fillStyle(typeColor, 0.7);
      this.baseCircle.fillCircle(0, 0, radius - 4);
      this.baseCircle.lineStyle(2.5, gradeColor, 1);
      this.baseCircle.strokeCircle(0, 0, radius);
      this.baseCircle.lineStyle(1, 0xffffff, 0.3);
      this.baseCircle.strokeCircle(0, 0, radius + 1);
    } else {
      this.baseCircle.fillStyle(gradeColor, 0.9);
      this.baseCircle.fillCircle(0, 0, radius);
      this.baseCircle.fillStyle(typeColor, 0.7);
      this.baseCircle.fillCircle(0, 0, radius - 4);
      this.baseCircle.lineStyle(2, gradeColor, 1);
      this.baseCircle.strokeCircle(0, 0, radius);
    }
  }

  /** Draw buff glow ring when buffed */
  private drawBuffGlow(): void {
    this.buffGlow.clear();
    const totalBuff = this.buff.atkPercent + this.buff.speedPercent + this.buff.rangePercent;
    if (totalBuff <= 0) return;

    const intensity = Math.min(totalBuff, 1);
    this.buffGlow.lineStyle(2, 0xffee58, 0.3 + intensity * 0.4);
    this.buffGlow.strokeCircle(0, 0, 26);
  }

  /** Update mythic pulsing visual */
  private updateMythicPulse(delta: number): void {
    if (this.grade !== 'mythic') return;
    this.mythicPulseTimer += delta / 1000;
    const pulse = 0.85 + Math.sin(this.mythicPulseTimer * 3) * 0.15;
    this.baseCircle.setScale(pulse);
  }

  private drawGradeIndicator(): void {
    const gradeStars: Record<UnitGrade, number> = {
      common: 1, rare: 2, epic: 3, legend: 4, mythic: 5,
    };
    const stars = gradeStars[this.grade];
    const dotSize = 2.5;
    const spacing = 7;
    const startX = -((stars - 1) * spacing) / 2;
    const dotY = 16;

    const gradeColor = Phaser.Display.Color.HexStringToColor(
      (configData.colors.grade as Record<string, string>)[this.grade]
    ).color;

    this.gradeIndicator.clear();
    this.gradeIndicator.fillStyle(gradeColor, 1);

    for (let i = 0; i < stars; i++) {
      this.gradeIndicator.fillCircle(startX + i * spacing, dotY, dotSize);
    }
  }

  // ---- Effective stats (with buffs) ----

  public get effectiveAtk(): number {
    return Math.round(this.stats.atk * (1 + this.buff.atkPercent));
  }

  public get effectiveAttackSpeed(): number {
    return this.stats.attackSpeed * (1 - this.buff.speedPercent);
  }

  public get effectiveRange(): number {
    return this.stats.range * (1 + this.buff.rangePercent);
  }

  // ---- Attack AI ----

  public updateAttack(delta: number, enemies: Enemy[]): Projectile[] {
    const deltaSec = delta / 1000;
    const newProjectiles: Projectile[] = [];

    // Visual updates
    this.updateMythicPulse(delta);
    this.drawBuffGlow();

    // Update existing projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.update(delta);
      if (p.isDone) {
        this.projectiles.splice(i, 1);
      }
    }

    // Handle archer burst fire (delayed shots)
    if (this.unitType === 'archer' && this.archerBurstRemaining > 0) {
      this.archerBurstDelay -= deltaSec;
      if (this.archerBurstDelay <= 0) {
        this.archerBurstDelay = 0.1; // 100ms between burst shots
        this.archerBurstRemaining--;

        const target = this.archerBurstTarget;
        if (target && !target.isDead && target.active) {
          const atk = this.effectiveAtk;
          const burstDmg = Math.round(atk * 0.5);
          const pierceAbility = this.findAbility('pierce');
          const pierceCount = pierceAbility ? (pierceAbility.count as number) : 0;
          const dmgCallback = this.onDamageDealt;
          const inRange = this.getEnemiesInRange(enemies, this.effectiveRange);
          const hitEnemies: Set<Enemy> = new Set();

          const proj = new Projectile(
            this.scene, this.x, this.y, target, burstDmg,
            pierceCount > 0 ? 0xffd54f : 0x66bb6a, // Yellow if piercing, green otherwise
            (hitEnemy: Enemy) => {
              hitEnemy.takeDamage(burstDmg);
              dmgCallback?.(hitEnemy.x, hitEnemy.y, burstDmg, false);
              hitEnemies.add(hitEnemy);
              if (pierceCount > 0) {
                for (const enemy of inRange) {
                  if (hitEnemies.size >= pierceCount + 1) break;
                  if (hitEnemies.has(enemy) || enemy.isDead) continue;
                  const dx = enemy.x - hitEnemy.x;
                  const dy = enemy.y - hitEnemy.y;
                  if (Math.sqrt(dx * dx + dy * dy) < 60) {
                    enemy.takeDamage(burstDmg);
                    hitEnemies.add(enemy);
                    dmgCallback?.(enemy.x, enemy.y, burstDmg, false);
                  }
                }
              }
            },
            400, // Fast arrow speed
            'arrow'
          );
          newProjectiles.push(proj);
        } else {
          this.archerBurstRemaining = 0; // Target dead, stop bursting
        }
      }
    }

    // Cooldown
    this.attackCooldown -= deltaSec;
    if (this.attackCooldown > 0) return newProjectiles;

    // Find target(s)
    const range = this.effectiveRange;
    const inRange = this.getEnemiesInRange(enemies, range);

    if (inRange.length === 0) {
      this.rangeCircle.setAlpha(0);
      return newProjectiles;
    }

    // Show range briefly
    this.showRangeIndicator(range);

    // Reset cooldown
    this.attackCooldown = this.effectiveAttackSpeed;

    const atk = this.effectiveAtk;
    const typeColor = Phaser.Display.Color.HexStringToColor(
      (configData.colors.unitType as Record<string, string>)[this.unitType]
    ).color;

    switch (this.unitType) {
      case 'warrior':
        newProjectiles.push(...this.attackWarrior(inRange, atk, typeColor));
        break;
      case 'archer':
        newProjectiles.push(...this.attackArcher(inRange, atk, typeColor));
        break;
      case 'mage':
        newProjectiles.push(...this.attackMage(inRange, atk, typeColor, enemies));
        break;
      case 'supporter':
        newProjectiles.push(...this.attackSupporter(inRange, atk, typeColor));
        break;
      case 'special':
        newProjectiles.push(...this.attackSpecial(inRange, atk, typeColor));
        break;
    }

    // Attack flash
    this.showAttackFlash(typeColor);

    return newProjectiles;
  }

  private getEnemiesInRange(enemies: Enemy[], range: number): Enemy[] {
    const results: Enemy[] = [];
    for (const enemy of enemies) {
      if (enemy.isDead || enemy.reachedEnd || !enemy.active) continue;
      if (enemy.isFlying && this.unitType === 'warrior') continue;

      const dx = enemy.x - this.x;
      const dy = enemy.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= range) {
        results.push(enemy);
      }
    }
    results.sort((a, b) => b.pathT - a.pathT);
    return results;
  }

  // ---- WARRIOR: Instant melee hit with slash arc ----
  private attackWarrior(inRange: Enemy[], atk: number, color: number): Projectile[] {
    const target = inRange[0];
    if (!target) return [];

    let damage = atk;
    let didCrit = false;

    const critAbility = this.findAbility('critChance');
    if (critAbility) {
      const chance = critAbility.chance as number;
      const mult = critAbility.multiplier as number;
      if (Math.random() < chance) {
        damage = Math.round(atk * mult);
        didCrit = true;
      }
    }

    // Stun (on crit only for legend+)
    const stunAbility = this.findAbility('stun');
    if (stunAbility && didCrit) {
      target.applyStun(stunAbility.duration as number);
    }

    // Splash (mythic warrior)
    const splashAbility = this.findAbility('splash');
    if (splashAbility && didCrit) {
      const splashRadius = splashAbility.radius as number;
      this.showWarriorSplash(target.x, target.y, splashRadius);
      for (const enemy of inRange) {
        if (enemy === target) continue;
        const dx = enemy.x - target.x;
        const dy = enemy.y - target.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= splashRadius) {
          enemy.takeDamage(Math.round(damage * 0.5));
        }
      }
    }

    target.takeDamage(damage);
    this.onDamageDealt?.(target.x, target.y, damage, didCrit);
    this.showSlashArc(target, color, didCrit);

    return [];
  }

  // ---- ARCHER: Burst fire projectiles ----
  private attackArcher(inRange: Enemy[], atk: number, _color: number): Projectile[] {
    const projectiles: Projectile[] = [];
    const multishotAbility = this.findAbility('multishot');
    const pierceAbility = this.findAbility('pierce');
    const critAbility = this.findAbility('critChance');

    const shotCount = multishotAbility ? (multishotAbility.count as number) : 1;
    const pierceCount = pierceAbility ? (pierceAbility.count as number) : 0;

    // First shot fires immediately
    const target = inRange[0];
    if (!target) return [];

    let damage = atk;
    let isCrit = false;
    if (critAbility && Math.random() < (critAbility.chance as number)) {
      damage = Math.round(damage * (critAbility.multiplier as number));
      isCrit = true;
    }

    const arrowColor = pierceCount > 0 ? 0xffd54f : 0x66bb6a;
    const hitEnemies: Set<Enemy> = new Set();
    const dmgCallback = this.onDamageDealt;

    const proj = new Projectile(
      this.scene, this.x, this.y, target, damage, arrowColor,
      (hitEnemy: Enemy) => {
        hitEnemy.takeDamage(damage);
        dmgCallback?.(hitEnemy.x, hitEnemy.y, damage, isCrit);
        hitEnemies.add(hitEnemy);
        if (pierceCount > 0) {
          for (const enemy of inRange) {
            if (hitEnemies.size >= pierceCount + 1) break;
            if (hitEnemies.has(enemy) || enemy.isDead) continue;
            const dx = enemy.x - hitEnemy.x;
            const dy = enemy.y - hitEnemy.y;
            if (Math.sqrt(dx * dx + dy * dy) < 60) {
              enemy.takeDamage(damage);
              hitEnemies.add(enemy);
              dmgCallback?.(enemy.x, enemy.y, damage, false);
            }
          }
        }
      },
      400,
      'arrow'
    );
    projectiles.push(proj);

    // Queue burst shots (2nd, 3rd, etc.)
    if (shotCount > 1) {
      this.archerBurstRemaining = shotCount - 1;
      this.archerBurstDelay = 0.1; // 100ms before next burst shot
      this.archerBurstTarget = target;
    }

    return projectiles;
  }

  // ---- MAGE: Slow large projectile + splash AoE ----
  private attackMage(inRange: Enemy[], atk: number, color: number, allEnemies: Enemy[]): Projectile[] {
    const target = inRange[0];
    if (!target) return [];

    const splashAbility = this.findAbility('splash');
    const slowAbility = this.findAbility('slow');
    const dotAbility = this.findAbility('dot');
    const splashRadius = splashAbility ? (splashAbility.radius as number) : 0;
    const dmgCallback = this.onDamageDealt;

    const proj = new Projectile(
      this.scene, this.x, this.y, target, atk, 0x5c6bc0,
      (hitEnemy: Enemy) => {
        hitEnemy.takeDamage(atk);
        dmgCallback?.(hitEnemy.x, hitEnemy.y, atk, false);

        if (splashRadius > 0) {
          // Purple explosion visual
          this.showMageSplash(hitEnemy.x, hitEnemy.y, splashRadius);

          for (const enemy of allEnemies) {
            if (enemy === hitEnemy || enemy.isDead || !enemy.active) continue;
            const dx = enemy.x - hitEnemy.x;
            const dy = enemy.y - hitEnemy.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist <= splashRadius) {
              const splashDmg = Math.round(atk * 0.6);
              enemy.takeDamage(splashDmg);
              dmgCallback?.(enemy.x, enemy.y, splashDmg, false);
            }
          }
        }

        if (slowAbility) {
          const targets = [hitEnemy];
          if (splashRadius > 0) {
            for (const enemy of allEnemies) {
              if (enemy === hitEnemy || enemy.isDead || !enemy.active) continue;
              const dx = enemy.x - hitEnemy.x;
              const dy = enemy.y - hitEnemy.y;
              if (Math.sqrt(dx * dx + dy * dy) <= splashRadius) targets.push(enemy);
            }
          }
          for (const t of targets) {
            t.applySlow(slowAbility.percent as number, slowAbility.duration as number);
          }
        }

        if (dotAbility) {
          hitEnemy.applyDot(dotAbility.damage as number, dotAbility.interval as number, 3);
        }
      },
      180, // Slow, large projectile
      'mage'
    );

    return [proj];
  }

  // ---- SUPPORTER: Light attack ----
  private attackSupporter(inRange: Enemy[], atk: number, color: number): Projectile[] {
    const target = inRange[0];
    if (!target) return [];

    const dmgCallback = this.onDamageDealt;
    const proj = new Projectile(
      this.scene, this.x, this.y, target, atk, 0xffee58,
      (hitEnemy: Enemy) => {
        hitEnemy.takeDamage(atk);
        dmgCallback?.(hitEnemy.x, hitEnemy.y, atk, false);
      },
      200,
      'supporter'
    );

    return [proj];
  }

  // ---- SPECIAL: Attack + debuffs ----
  private attackSpecial(inRange: Enemy[], atk: number, color: number): Projectile[] {
    const target = inRange[0];
    if (!target) return [];

    const slowAbility = this.findAbility('slow');
    const armorReduceAbility = this.findAbility('armorReduce');
    const dotAbility = this.findAbility('dot');
    const freezeAbility = this.findAbility('freeze');
    const dmgCallback = this.onDamageDealt;

    // Periodic freeze (mythic)
    if (freezeAbility) {
      this.freezeAccum += this.effectiveAttackSpeed;
      if (this.freezeAccum >= (freezeAbility.interval as number)) {
        this.freezeAccum -= (freezeAbility.interval as number);
        const proj = new Projectile(
          this.scene, this.x, this.y, target, atk, 0x42a5f5,
          (hitEnemy: Enemy) => {
            hitEnemy.takeDamage(atk);
            dmgCallback?.(hitEnemy.x, hitEnemy.y, atk, true);
            hitEnemy.applyFreeze(freezeAbility.duration as number);
            this.showFreezeEffect(hitEnemy.x, hitEnemy.y);
            if (slowAbility) hitEnemy.applySlow(slowAbility.percent as number, slowAbility.duration as number);
            if (armorReduceAbility) hitEnemy.applyArmorReduce(armorReduceAbility.percent as number, slowAbility?.duration as number || 3);
            if (dotAbility) hitEnemy.applyDot(dotAbility.damage as number, dotAbility.interval as number, 3);
          },
          280,
          'electric'
        );
        return [proj];
      }
    }

    const proj = new Projectile(
      this.scene, this.x, this.y, target, atk, 0x26c6da,
      (hitEnemy: Enemy) => {
        hitEnemy.takeDamage(atk);
        dmgCallback?.(hitEnemy.x, hitEnemy.y, atk, false);
        if (slowAbility) hitEnemy.applySlow(slowAbility.percent as number, slowAbility.duration as number);
        if (armorReduceAbility) hitEnemy.applyArmorReduce(armorReduceAbility.percent as number, slowAbility?.duration as number || 3);
        if (dotAbility) hitEnemy.applyDot(dotAbility.damage as number, dotAbility.interval as number, 3);
      },
      280,
      'electric'
    );

    return [proj];
  }

  // ---- Buff system ----

  public getSupporterBuff(): UnitBuff | null {
    if (this.unitType !== 'supporter') return null;

    const buff: UnitBuff = { atkPercent: 0, speedPercent: 0, rangePercent: 0 };

    for (const ability of this.stats.abilities) {
      switch (ability.type) {
        case 'buffAtk':
          buff.atkPercent = ability.percent as number;
          break;
        case 'buffSpeed':
          buff.speedPercent = ability.percent as number;
          break;
        case 'buffRange':
          buff.rangePercent = ability.percent as number;
          break;
        case 'buffAtkGlobal':
          buff.atkPercent = ability.percent as number;
          break;
      }
    }

    return buff;
  }

  public getGlobalAtkBuff(): number {
    if (this.unitType !== 'supporter') return 0;
    const ability = this.findAbility('buffAtkGlobal');
    return ability ? (ability.percent as number) : 0;
  }

  public resetBuff(): void {
    this.buff.atkPercent = 0;
    this.buff.speedPercent = 0;
    this.buff.rangePercent = 0;
  }

  public applyBuff(buff: UnitBuff): void {
    this.buff.atkPercent += buff.atkPercent;
    this.buff.speedPercent += buff.speedPercent;
    this.buff.rangePercent += buff.rangePercent;
  }

  // ---- Visual effects ----

  private showRangeIndicator(range: number): void {
    this.rangeCircle.clear();
    this.rangeCircle.lineStyle(1, 0xfafafa, 0.15);
    this.rangeCircle.strokeCircle(0, 0, range);
    this.rangeCircle.setAlpha(0.3);

    this.scene?.tweens.add({
      targets: this.rangeCircle,
      alpha: 0,
      duration: 400,
    });
  }

  private showAttackFlash(color: number): void {
    this.attackFlash.clear();
    this.attackFlash.fillStyle(color, 0.4);
    this.attackFlash.fillCircle(0, 0, 26);

    this.scene?.tweens.add({
      targets: this.attackFlash,
      alpha: 0,
      duration: 150,
      onComplete: () => {
        this.attackFlash.clear();
        this.attackFlash.setAlpha(1);
      },
    });
  }

  /** Warrior: Slash arc effect (short curved line) */
  private showSlashArc(target: Enemy, color: number, isCrit: boolean): void {
    if (!this.scene) return;
    const g = this.scene.add.graphics();
    g.setDepth(140);

    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const angle = Math.atan2(dy, dx);
    const dist = Math.sqrt(dx * dx + dy * dy);
    const midX = this.x + dx * 0.6;
    const midY = this.y + dy * 0.6;

    // Draw slash arc
    const arcRadius = Math.min(dist * 0.5, 25);
    const lineWidth = isCrit ? 4 : 2.5;
    g.lineStyle(lineWidth, isCrit ? 0xffd54f : color, isCrit ? 1 : 0.8);

    g.beginPath();
    const arcStart = angle - Math.PI * 0.4;
    const arcEnd = angle + Math.PI * 0.4;
    g.arc(midX, midY, arcRadius, arcStart, arcEnd, false);
    g.strokePath();

    // Extra flash for crit
    if (isCrit) {
      g.lineStyle(2, 0xffffff, 0.6);
      g.arc(midX, midY, arcRadius + 3, arcStart, arcEnd, false);
      g.strokePath();
    }

    this.scene.tweens.add({
      targets: g,
      alpha: 0,
      duration: isCrit ? 250 : 150,
      onComplete: () => g.destroy(),
    });

    // Stun star icon
    const stunAbility = this.findAbility('stun');
    if (stunAbility && isCrit) {
      const star = this.scene.add.text(target.x, target.y - 18, '⭐', {
        fontSize: '12px',
      }).setOrigin(0.5).setDepth(200);

      this.scene.tweens.add({
        targets: star,
        y: target.y - 28,
        alpha: 0,
        duration: 500,
        onComplete: () => star.destroy(),
      });
    }
  }

  /** Warrior mythic: Red shockwave splash */
  private showWarriorSplash(x: number, y: number, radius: number): void {
    if (!this.scene) return;
    const g = this.scene.add.graphics();
    g.setDepth(140);

    // Red shockwave ring
    g.lineStyle(3, 0xef5350, 0.8);
    g.strokeCircle(x, y, 5);
    g.fillStyle(0xef5350, 0.2);
    g.fillCircle(x, y, 5);

    this.scene.tweens.add({
      targets: g,
      scaleX: radius / 5,
      scaleY: radius / 5,
      alpha: 0,
      duration: 300,
      ease: 'Power2',
      onComplete: () => g.destroy(),
    });
  }

  /** Mage: Purple explosion splash */
  private showMageSplash(x: number, y: number, radius: number): void {
    if (!this.scene) return;
    const g = this.scene.add.graphics();
    g.setDepth(140);

    // Purple expanding explosion
    g.lineStyle(2.5, 0xab47bc, 0.7);
    g.strokeCircle(x, y, radius * 0.3);
    g.fillStyle(0x5c6bc0, 0.2);
    g.fillCircle(x, y, radius * 0.3);

    this.scene.tweens.add({
      targets: g,
      scaleX: 3,
      scaleY: 3,
      alpha: 0,
      duration: 350,
      ease: 'Power2',
      onComplete: () => g.destroy(),
    });

    // Purple particles
    for (let i = 0; i < 5; i++) {
      const p = this.scene.add.graphics();
      p.fillStyle(0xab47bc, 0.6);
      p.fillCircle(0, 0, 1.5);
      p.setPosition(x, y);
      p.setDepth(141);

      const angle = Math.random() * Math.PI * 2;
      const dist = radius * 0.5 + Math.random() * radius * 0.5;
      this.scene.tweens.add({
        targets: p,
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist,
        alpha: 0,
        duration: 300 + Math.random() * 200,
        onComplete: () => p.destroy(),
      });
    }
  }

  /** Special mythic: Freeze burst effect */
  private showFreezeEffect(x: number, y: number): void {
    if (!this.scene) return;

    // Cyan ice burst
    const g = this.scene.add.graphics();
    g.setDepth(140);
    g.lineStyle(2, 0x26c6da, 0.9);
    g.strokeCircle(x, y, 5);
    g.fillStyle(0x26c6da, 0.3);
    g.fillCircle(x, y, 5);

    this.scene.tweens.add({
      targets: g,
      scaleX: 4,
      scaleY: 4,
      alpha: 0,
      duration: 400,
      onComplete: () => g.destroy(),
    });

    // Ice crystal text
    const ice = this.scene.add.text(x, y - 15, '❄️', {
      fontSize: '14px',
    }).setOrigin(0.5).setDepth(200);

    this.scene.tweens.add({
      targets: ice,
      y: y - 30,
      alpha: 0,
      duration: 600,
      onComplete: () => ice.destroy(),
    });
  }

  // ---- Helpers ----

  private findAbility(type: string): AbilityDef | undefined {
    return this.stats.abilities.find(a => a.type === type);
  }

  public getDisplayName(): string {
    const unitData = (unitsData as Record<string, { name: string }>)[this.unitType];
    const gradeNames: Record<UnitGrade, string> = {
      common: '커먼', rare: '레어', epic: '에픽', legend: '레전드', mythic: '미시크',
    };
    return `${gradeNames[this.grade]} ${unitData.name}`;
  }
}
