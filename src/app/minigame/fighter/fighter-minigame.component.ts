import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, OnChanges, SimpleChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { WalletService } from '../../wallet/wallet.service';
import { ActivityLogService } from '../../activity-log/activity-log.service';
import { StatisticsService } from '../../statistics/statistics.service';
import { FIGHTER_MG } from '../../game-config';
import { CURRENCY_FLAVOR, KOBOLD_VARIANTS, KoboldVariant, MINIGAME_MSG, cur } from '../../flavor-text';
import { FighterCombatState } from '../../options/save.service';
import { toPct, randInt, rollChance } from '../../utils/mathUtils';

interface Enemy {
  name: string;
  hp: number;
  maxHp: number;
  goldMin: number;
  goldMax: number;
  xpReward: number;
  earReward: number;
  dmgMax: number;
  ascii: string;
  /** Optional secondary drop (in addition to the kobold ear). */
  secondaryDrop: {
    currencyId: string;
    amount:     number;
    chance:     number;   // 0–100
  } | null;
}

@Component({
  selector: 'app-fighter-minigame',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './fighter-minigame.component.html',
  styleUrls: ['./fighter-minigame.component.scss'],
})
export class FighterMinigameComponent implements OnInit, OnChanges, OnDestroy {
  /** Sword sharpness — fed in from goldPerClick on the Fighter. */
  @Input() attackPower = 1;
  /** Potion Chugging upgrade level — each level adds +1 HP to potion heals. */
  @Input() potionChuggingLevel = 0;
  /** Future upgrades reduce the long-rest lockout by this many seconds. */
  @Input() recoveryReductionSec = 0;
  /** Short Rest upgrade level — unlocks the auto-heal toggle. */
  @Input() shortRestLevel = 0;
  /** Whether Short Rest auto-heal is currently enabled. */
  @Input() shortRestEnabled = false;
  /** Emitted when the player toggles Short Rest on/off. */
  @Output() shortRestEnabledChange = new EventEmitter<boolean>();
  /** Number of Stronger Kobolds tiers purchased — determines max selectable level. */
  @Input() strongerKoboldsLevel = 0;
  /** Currently-selected kobold difficulty (1 = base). */
  @Input() selectedKoboldLevel = 1;
  /** Emitted when the player clicks +/- on the kobold level selector. */
  @Output() selectedKoboldLevelChange = new EventEmitter<number>();
  /** First Strike level — when ≥ 1, the fighter attacks before the enemy can counter on a killing blow. */
  @Input() firstStrikeLevel = 0;
  /** Slow Blade level — each level adds +1 to the fighter's minimum hit. */
  @Input() slowBladeLevel = 0;
  /** Previously-saved combat state to restore on init. */
  @Input() savedState: FighterCombatState | null = null;
  /** Emitted whenever combat state changes (HP, defeated, rest countdown). */
  @Output() stateChange = new EventEmitter<FighterCombatState>();

  private wallet = inject(WalletService);
  private log    = inject(ActivityLogService);
  private stats  = inject(StatisticsService);
  private sub    = new Subscription();
  private spawnTimer?: ReturnType<typeof setTimeout>;
  private restInterval?: ReturnType<typeof setInterval>;
  private fleeInterval?: ReturnType<typeof setInterval>;

  // ── Fighter state ─────────────────────────
  readonly maxHp   = FIGHTER_MG.MAX_HP;
  readonly defense = FIGHTER_MG.DEFENSE;
  readonly currencyFlavor = CURRENCY_FLAVOR;
  fighterHp: number = FIGHTER_MG.MAX_HP;

  // ── Wallet-synced ─────────────────────────
  potions = 0;

  // ── Combat state ──────────────────────────
  defeated      = false;
  awaitingSpawn = false;
  fleeing       = false;
  fleeCountdown = 0;     // seconds remaining while fleeing
  /** True while a First Strike chain is running — flee is permitted even though awaitingSpawn is true. */
  inFirstStrikeChain = false;
  /** Number of consecutive First Strike kills in the current chain (0 when no chain active). */
  private firstStrikeChainCount = 0;

  /** When true, potions are consumed automatically to top up HP after each kill. */
  // shortRestEnabled is now an @Input() — see above

  // ── Long rest lockout ─────────────────────
  restCountdown = 0;   // seconds remaining; 0 = can retry
  /** Absolute wall-clock time (ms) when the long rest ends. 0 when not resting. */
  private restEndsAt = 0;

  /** Effective rest duration after applying any upgrade reductions. */
  get effectiveRestSec(): number {
    return Math.max(0, Math.floor(FIGHTER_MG.RECOVERY_TIME_MS / 1000) - this.recoveryReductionSec);
  }

  // ── Enemy ─────────────────────────────────
  enemy: Enemy = this.buildKobold();

  // ── Combat message ────────────────────────
  lastMsg  = '-- Ready to fight --';
  msgLine2 = '';
  msgClass = 'msg-neutral';

  // ── Computed ──────────────────────────────

  get fighterHpPct(): number {
    return toPct(this.fighterHp, this.maxHp);
  }

  get enemyHpPct(): number {
    return toPct(this.enemy.hp, this.enemy.maxHp);
  }

  /** Base heal + 1 HP per Potion Chugging level. */
  get potionHealAmount(): number {
    return FIGHTER_MG.POTION_HEAL + this.potionChuggingLevel;
  }

  get potionHealEfficiency(): number{
    return FIGHTER_MG.BASE_SR_POTION_HEAL;
  }

  get actionsDisabled(): boolean {
    return this.defeated || this.awaitingSpawn || this.fleeing;
  }

  get healDisabled(): boolean {
    return this.actionsDisabled || this.potions < 1 || this.fighterHp >= this.maxHp;
  }

  get fleeDisabled(): boolean {
    // Allow fleeing during a first-strike chain so the player can break out
    return this.defeated || (this.awaitingSpawn && !this.inFirstStrikeChain) || this.fleeing;
  }

  /** Maximum selectable kobold level: base 1 + one per Stronger Kobolds tier. */
  get maxKoboldLevel(): number {
    return this.strongerKoboldsLevel + 1;
  }

  increaseKoboldLevel(): void {
    if (this.selectedKoboldLevel < this.maxKoboldLevel) {
      this.selectedKoboldLevelChange.emit(this.selectedKoboldLevel + 1);
    }
  }

  decreaseKoboldLevel(): void {
    if (this.selectedKoboldLevel > 1) {
      this.selectedKoboldLevelChange.emit(this.selectedKoboldLevel - 1);
    }
  }

  toggleShortRest(): void {
    this.shortRestEnabledChange.emit(!this.shortRestEnabled);
  }

  // ── Lifecycle ─────────────────────────────

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['firstStrikeLevel'] && this.firstStrikeLevel >= 1) {
      this.stats.markFirstStrikeUnlocked();
    }
  }

  ngOnInit(): void {
    if (this.firstStrikeLevel >= 1) this.stats.markFirstStrikeUnlocked();
    this.sub.add(
      this.wallet.state$.subscribe(s => {
        this.potions = Math.floor(s['potion']?.amount ?? 0);
      })
    );

    // Restore persisted combat state if available
    if (this.savedState) {
      const s = this.savedState;
      this.fighterHp = Math.min(s.fighterHp, this.maxHp);

      if (s.enemyHp > 0 && !s.defeated) {
        // Rebuild a kobold and apply the saved HP
        const k = this.buildKobold();
        k.hp = Math.min(s.enemyHp, k.maxHp);
        this.enemy = k;
        this.lastMsg  = MINIGAME_MSG.FIGHTER.RESUMED;
        this.msgLine2 = '';
        this.msgClass = 'msg-neutral';
      } else {
        // Enemy already dead — spawn fresh kobold
        this.enemy = this.buildKobold();
      }

      this.defeated = s.defeated;
      if (s.defeated && s.restCountdown > 0) {
        // Derive remaining time from the wall-clock end timestamp when available,
        // so the countdown reflects real elapsed time even if the tab was away.
        const remaining = s.restEndsAt
          ? Math.max(0, Math.ceil((s.restEndsAt - Date.now()) / 1000))
          : s.restCountdown;
        this.restEndsAt    = s.restEndsAt ?? (Date.now() + remaining * 1000);
        this.restCountdown = remaining;

        this.lastMsg  = `!! DEFEATED !!`;
        this.msgClass = 'msg-bad';

        if (this.restCountdown <= 0) {
          this.msgLine2 = '';
        } else {
          this.msgLine2 = '';
          this.restInterval = setInterval(() => {
            this.restCountdown = Math.max(0, this.restCountdown - 1);
            this.emitState();
            if (this.restCountdown <= 0) {
              clearInterval(this.restInterval);
              this.restInterval = undefined;
            }
          }, 1000);
        }
      } else if (s.defeated) {
        this.lastMsg  = `!! DEFEATED !!`;
        this.msgLine2 = '';
        this.msgClass = 'msg-bad';
      }
    }
  }

  /** Emit the current combat state to the parent for persistence. */
  private emitState(): void {
    this.stateChange.emit({
      fighterHp:     this.fighterHp,
      enemyHp:       this.enemy.hp,
      defeated:      this.defeated,
      restCountdown: this.restCountdown,
      restEndsAt:    this.restEndsAt,
    });
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
    if (this.spawnTimer)   clearTimeout(this.spawnTimer);
    if (this.restInterval) clearInterval(this.restInterval);
    if (this.fleeInterval) clearInterval(this.fleeInterval);
  }

  // ── Actions ───────────────────────────────

  attack(): void {
    if (this.actionsDisabled) return;

    const minHit = Math.min(1 + this.slowBladeLevel, this.attackPower + 1);
    const dmg  = randInt(minHit, this.attackPower + 1);
    const eDmg = this.rollEnemyDamage();   // always rolled — counter fires even on a killing blow

    this.enemy.hp  = Math.max(0, this.enemy.hp - dmg);
    this.fighterHp = Math.max(0, this.fighterHp - eDmg);  // always applied

    if (this.enemy.hp <= 0) {
      this.onEnemyDefeated(eDmg);
      return;
    }

    // Normal round — show both lines, then check if the fighter was killed
    this.lastMsg  = `You deal ${dmg} dmg.`;
    this.msgLine2 = `${this.enemy.name} hits ${eDmg}!`;
    this.msgClass = 'msg-neutral';

    if (this.fighterHp <= 0) {
      this.fighterHp = 0;
      this.defeated  = true;
      this.lastMsg   = `!! DEFEATED by ${this.enemy.name} !!`;
      this.msgLine2  = '';
      this.msgClass  = 'msg-bad';
      this.log.log(`The Fighter was slain by a ${this.enemy.name}!`, 'warn');
      this.startRest();
    }
    this.emitState();
  }

  heal(): void {
    if (this.healDisabled) return;

    this.wallet.remove('potion', 1);
    this.stats.trackFighterPotionDrank(1);
    const healed = Math.min(this.potionHealAmount, this.maxHp - this.fighterHp);
    this.fighterHp += healed;

    const eDmg = this.rollEnemyDamage();
    this.lastMsg  = `You heal ${healed} HP.`;
    this.msgLine2 = `${this.enemy.name} hits ${eDmg}!`;
    this.msgClass = 'msg-neutral';
    this.applyEnemyDamage(eDmg);
    this.emitState();
  }

  retry(): void {
    if (this.restCountdown > 0) return;   // still long resting
    this.fighterHp = this.maxHp;
    this.enemy     = this.buildKobold();
    this.defeated  = false;
    this.lastMsg   = MINIGAME_MSG.FIGHTER.READY;
    this.msgLine2  = '';
    this.msgClass  = 'msg-neutral';
    this.emitState();
  }


  flee(): void {
    if (this.fleeDisabled) return;

    // If fleeing mid-chain, cancel the pending spawn and clear chain state
    if (this.inFirstStrikeChain) {
      if (this.spawnTimer) {
        clearTimeout(this.spawnTimer);
        this.spawnTimer = undefined;
      }
      this.stats.trackFighterKillChain(this.firstStrikeChainCount);
      this.inFirstStrikeChain    = false;
      this.firstStrikeChainCount = 0;
      this.awaitingSpawn         = false;
    }

    this.fleeing       = true;
    this.fleeCountdown = 3;
    this.lastMsg  = MINIGAME_MSG.FIGHTER.FLEEING;
    this.msgLine2 = `${this.fleeCountdown}s`;
    this.msgClass = 'msg-neutral';

    this.fleeInterval = setInterval(() => {
      this.fleeCountdown--;
      if (this.fleeCountdown > 0) {
        this.msgLine2 = `${this.fleeCountdown}s`;
      } else {
        clearInterval(this.fleeInterval);
        this.fleeInterval = undefined;
        this.fleeing = false;

        // Reset the enemy but keep fighter HP
        this.enemy    = this.buildKobold();
        this.lastMsg  = MINIGAME_MSG.FIGHTER.ESCAPED;
        this.msgLine2 = '';
        this.msgClass = 'msg-neutral';
        this.log.log('The Fighter fled from combat.', 'default');
        this.emitState();
      }
    }, 1000);
  }

  // ── Private helpers ───────────────────────

  /**
   * Begin the long-rest lockout after a defeat.
   * Records an absolute end timestamp so the countdown stays accurate even
   * if the component is destroyed and recreated (e.g. switching characters).
   */
  private startRest(): void {
    this.stats.trackFighterDefeated();
    this.restCountdown = this.effectiveRestSec;
    if (this.restCountdown <= 0) return;   // fully reduced — can retry instantly

    this.restEndsAt = Date.now() + this.restCountdown * 1000;

    this.restInterval = setInterval(() => {
      this.restCountdown = Math.max(0, this.restCountdown - 1);
      this.emitState();
      if (this.restCountdown <= 0) {
        clearInterval(this.restInterval);
        this.restInterval = undefined;
      }
    }, 1000);
  }

  private rollEnemyDamage(): number {
    return Math.max(0, randInt(1, this.enemy.dmgMax) - this.defense);
  }

  /** Consume potions one at a time until HP is full or potions run out. */
  private autoHealToFull(): void {
    let potionsConsumed = 0;
    while (this.potions > 0 && this.fighterHp < this.maxHp) {
      this.wallet.remove('potion', 1);
      potionsConsumed++;
      this.fighterHp = Math.min(this.maxHp, this.fighterHp + this.potionHealAmount*this.potionHealEfficiency);
    }
    this.log.log(`Chugged some potions during a short rest. (${cur('potion', potionsConsumed, '-')})`, "default")
    this.stats.trackFighterPotionDrank(potionsConsumed);
  }

  private applyEnemyDamage(dmg: number): void {
    this.fighterHp -= dmg;
    if (this.fighterHp <= 0) {
      this.fighterHp = 0;
      this.defeated  = true;
      this.lastMsg   = `!! DEFEATED by ${this.enemy.name} !!`;
      this.msgLine2  = '';
      this.msgClass  = 'msg-bad';
      this.log.log(`The Fighter was slain by a ${this.enemy.name}!`, 'warn');
      this.startRest();
    }
    this.emitState();
  }

  private onEnemyDefeated(enemyLastDmg: number, firstStrike: boolean = false): void {
    const gold = randInt(this.enemy.goldMin, this.enemy.goldMax);

    this.wallet.add('gold',       gold);
    this.wallet.add('xp',         this.enemy.xpReward);
    this.wallet.add('kobold-ear', this.enemy.earReward);

    // Track stats
    const variantIdx = Math.min(this.selectedKoboldLevel - 1, KOBOLD_VARIANTS.length - 1);
    this.stats.trackKoboldKill(KOBOLD_VARIANTS[variantIdx].name);
    this.stats.trackCurrencyGain('gold', gold);
    this.stats.trackCurrencyGain('xp', this.enemy.xpReward);
    this.stats.trackCurrencyGain('kobold-ear', this.enemy.earReward);

    const isFirstEar = !this.wallet.isCurrencyUnlocked('kobold-ear');
    if (isFirstEar) {
      this.wallet.unlockCurrency('kobold-ear');
    }

    // ── Secondary drop roll ───────────────────────
    let secondaryMsg = '';
    let gotSecondaryDrop = false;
    if (this.enemy.secondaryDrop) {
      const drop = this.enemy.secondaryDrop;
      if (rollChance(drop.chance)) {
        this.wallet.add(drop.currencyId, drop.amount);
        gotSecondaryDrop = true;
        this.stats.trackCurrencyGain(drop.currencyId, drop.amount);
        const isFirstSecondary = !this.wallet.isCurrencyUnlocked(drop.currencyId);
        if (isFirstSecondary) {
          this.wallet.unlockCurrency(drop.currencyId);
          const dropFlavor = (CURRENCY_FLAVOR as Record<string, { name: string; symbol: string; color: string }>)[drop.currencyId];
          const dropName = dropFlavor?.name ?? drop.currencyId;
          this.log.log(
            `The ${this.enemy.name} drops a ${dropName}! A new trophy!`,
            'rare'
          );
        }
        secondaryMsg = `, ${cur(drop.currencyId, drop.amount)}`;
      }
    }

    // ── Log message ───────────────────────────────
    const logType = gotSecondaryDrop ? 'success' : (isFirstEar ? 'rare' : 'default');
    if (isFirstEar) {
      this.log.log(
        `Victory! The ${this.enemy.name} drops a Kobold Ear! (${cur('gold', gold)}, ${cur('xp', this.enemy.xpReward)}, ${cur('kobold-ear', this.enemy.earReward)}${secondaryMsg})`,
        'rare'
      );
    } else {
      this.log.log(
        `Victory! ${this.enemy.name} defeated. (${cur('gold', gold)}, ${cur('xp', this.enemy.xpReward)}, ${cur('kobold-ear', this.enemy.earReward)}${secondaryMsg})`,
        logType
      );
    }

    if (this.fighterHp <= 0) {
      // Mutual kill — awards still granted, but fighter is defeated
      this.fighterHp = 0;
      this.defeated  = true;
      this.lastMsg   = `A Mutual kill! `;
      this.msgLine2  = `Last strike: ${enemyLastDmg} dmg!`;
      this.msgClass  = 'msg-bad';
      this.startRest();
      this.emitState();
      return;
    }

    this.lastMsg       = `${this.enemy.name} defeated!`;
    this.msgLine2      = firstStrike
      ? (this.firstStrikeChainCount >= 2 ? `[ CHAIN x${this.firstStrikeChainCount}! ]` : `[ FIRST STRIKE! ]`)
      : `Final blow: ${enemyLastDmg} dmg!`;
    this.msgClass      = 'msg-good';
    this.awaitingSpawn = true;
    if (this.shortRestEnabled) this.autoHealToFull();
    this.emitState();

    this.spawnTimer = setTimeout(() => {
      this.enemy        = this.buildKobold();
      this.awaitingSpawn = false;
      this.lastMsg      = MINIGAME_MSG.FIGHTER.NEW_ENEMY;
      this.msgLine2     = '';
      this.msgClass     = 'msg-neutral';
      this.emitState();

      // First Strike: free opening hit at the start of every combat encounter.
      // Only fires here (enemy spawned after a kill), never after fleeing.
      if (this.firstStrikeLevel >= 1) {
        this.applyFirstStrike();
      }
    }, FIGHTER_MG.SPAWN_DELAY_MS);
  }

  /**
   * First Strike free hit — applied automatically when a new enemy spawns after a kill.
   * The fighter deals normal attack damage with no enemy counter.
   * If the hit kills the enemy, rewards are awarded and the chain continues
   * (the next spawn also gets a First Strike hit).
   */
  private applyFirstStrike(): void {
    const minHit = Math.min(1 + this.slowBladeLevel, this.attackPower + 1);
    const dmg = randInt(minHit, this.attackPower + 1);
    this.enemy.hp = Math.max(0, this.enemy.hp - dmg);

    if (this.enemy.hp <= 0) {
      // Count the kill: fresh chain starts at 1, continuation increments
      this.firstStrikeChainCount = this.inFirstStrikeChain
        ? this.firstStrikeChainCount + 1
        : 1;
      this.inFirstStrikeChain = true;
      this.onEnemyDefeated(0, true);
    } else {
      // Enemy survived — chain is over, normal combat resumes
      this.stats.trackFighterKillChain(this.firstStrikeChainCount);
      this.inFirstStrikeChain    = false;
      this.firstStrikeChainCount = 0;
      this.lastMsg  = `First Strike! ${dmg} dmg!`;
      this.msgLine2 = `The kobold can't keep up!`;
      this.msgClass = 'msg-good';
      this.emitState();
    }
  }

  private buildKobold(): Enemy {
    const lvl   = this.selectedKoboldLevel;
    const extra = lvl - 1;
    const hp    = FIGHTER_MG.KOBOLD_HP + extra * FIGHTER_MG.KOBOLD_HP_PER_LEVEL;

    // Pick the variant definition for this level (fall back to the last entry for high levels).
    const variantIdx = Math.min(lvl - 1, KOBOLD_VARIANTS.length - 1);
    const variant: KoboldVariant = KOBOLD_VARIANTS[variantIdx];

    return {
      name:      variant.name + (lvl > KOBOLD_VARIANTS.length ? ` Lv.${lvl}` : ''),
      hp,
      maxHp:     hp,
      goldMin:   FIGHTER_MG.KOBOLD_GOLD_MIN   + extra * FIGHTER_MG.KOBOLD_GOLD_MIN_PER_LEVEL,
      goldMax:   FIGHTER_MG.KOBOLD_GOLD_MAX   + extra * FIGHTER_MG.KOBOLD_GOLD_MAX_PER_LEVEL,
      xpReward:  FIGHTER_MG.KOBOLD_XP_REWARD  + extra * FIGHTER_MG.KOBOLD_XP_PER_LEVEL,
      earReward: FIGHTER_MG.KOBOLD_EAR_REWARD + extra * FIGHTER_MG.KOBOLD_EAR_PER_LEVEL,
      dmgMax:    FIGHTER_MG.ENEMY_DMG_MAX      + extra * FIGHTER_MG.KOBOLD_DMG_PER_LEVEL,
      ascii:     variant.ascii,
      secondaryDrop: variant.secondaryDrop ? { ...variant.secondaryDrop } : null,
    };
  }
}

