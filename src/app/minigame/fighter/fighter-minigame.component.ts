import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { WalletService } from '../../wallet/wallet.service';
import { ActivityLogService } from '../../activity-log/activity-log.service';
import { FIGHTER_MG } from '../../game-config';
import { CURRENCY_FLAVOR } from '../../flavor-text';
import { FighterCombatState } from '../../save/save.service';

interface Enemy {
  name: string;
  hp: number;
  maxHp: number;
  goldMin: number;
  goldMax: number;
  xpReward: number;
  earReward: number;
  ascii: string;
}

@Component({
  selector: 'app-fighter-minigame',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './fighter-minigame.component.html',
  styleUrls: ['./fighter-minigame.component.scss'],
})
export class FighterMinigameComponent implements OnInit, OnDestroy {
  /** Sword sharpness — fed in from goldPerClick on the Fighter. */
  @Input() attackPower = 1;
  /** Potion Chugging upgrade level — each level adds +1 HP to potion heals. */
  @Input() potionChuggingLevel = 0;
  /** Future upgrades reduce the long-rest lockout by this many seconds. */
  @Input() recoveryReductionSec = 0;
  /** Previously-saved combat state to restore on init. */
  @Input() savedState: FighterCombatState | null = null;
  /** Emitted whenever combat state changes (HP, defeated, rest countdown). */
  @Output() stateChange = new EventEmitter<FighterCombatState>();

  private wallet = inject(WalletService);
  private log    = inject(ActivityLogService);
  private sub    = new Subscription();
  private spawnTimer?: ReturnType<typeof setTimeout>;
  private restInterval?: ReturnType<typeof setInterval>;

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

  // ── Long rest lockout ─────────────────────
  restCountdown = 0;   // seconds remaining; 0 = can retry

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
    return Math.max(0, (this.fighterHp / this.maxHp) * 100);
  }

  get enemyHpPct(): number {
    return Math.max(0, (this.enemy.hp / this.enemy.maxHp) * 100);
  }

  /** Base heal + 1 HP per Potion Chugging level. */
  get potionHealAmount(): number {
    return FIGHTER_MG.POTION_HEAL + this.potionChuggingLevel;
  }

  get actionsDisabled(): boolean {
    return this.defeated || this.awaitingSpawn;
  }

  get healDisabled(): boolean {
    return this.actionsDisabled || this.potions < 1 || this.fighterHp >= this.maxHp;
  }

  // ── Lifecycle ─────────────────────────────

  ngOnInit(): void {
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
        this.lastMsg  = '-- Resumed --';
        this.msgLine2 = '';
        this.msgClass = 'msg-neutral';
      } else {
        // Enemy already dead — spawn fresh kobold
        this.enemy = this.buildKobold();
      }

      this.defeated = s.defeated;
      if (s.defeated && s.restCountdown > 0) {
        this.restCountdown = s.restCountdown;
        this.lastMsg  = `!! DEFEATED !!`;
        this.msgLine2 = `Long resting... ${this.restCountdown}s`;
        this.msgClass = 'msg-bad';
        this.restInterval = setInterval(() => {
          this.restCountdown = Math.max(0, this.restCountdown - 1);
          this.emitState();
          if (this.restCountdown > 0) {
            this.msgLine2 = `Long resting... ${this.restCountdown}s`;
          } else {
            this.msgLine2 = '-- Press RETRY --';
            clearInterval(this.restInterval);
            this.restInterval = undefined;
          }
        }, 1000);
      } else if (s.defeated) {
        this.lastMsg  = `!! DEFEATED !!`;
        this.msgLine2 = '-- Press RETRY --';
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
    });
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
    if (this.spawnTimer)   clearTimeout(this.spawnTimer);
    if (this.restInterval) clearInterval(this.restInterval);
  }

  // ── Actions ───────────────────────────────

  attack(): void {
    if (this.actionsDisabled) return;

    const dmg  = Math.floor(Math.random() * (this.attackPower + 1)) + 1;
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
    this.lastMsg   = '-- Ready to fight --';
    this.msgLine2  = '';
    this.msgClass  = 'msg-neutral';
    this.emitState();
  }

  // ── Private helpers ───────────────────────

  /**
   * Begin the long-rest lockout after a defeat.
   * Updates msgLine2 each second with the remaining time, then clears itself.
   */
  private startRest(): void {
    this.restCountdown = this.effectiveRestSec;
    if (this.restCountdown <= 0) return;   // fully reduced — can retry instantly

    this.msgLine2 = `Long resting... ${this.restCountdown}s`;

    this.restInterval = setInterval(() => {
      this.restCountdown = Math.max(0, this.restCountdown - 1);
      this.emitState();
      if (this.restCountdown > 0) {
        this.msgLine2 = `Long resting... ${this.restCountdown}s`;
      } else {
        this.msgLine2 = '-- Press RETRY --';
        clearInterval(this.restInterval);
        this.restInterval = undefined;
      }
    }, 1000);
  }

  private rollEnemyDamage(): number {
    return Math.max(0, Math.floor(Math.random() * FIGHTER_MG.ENEMY_DMG_MAX) + 1 - this.defense);
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

  private onEnemyDefeated(enemyLastDmg: number): void {
    const gold = this.enemy.goldMin +
      Math.floor(Math.random() * (this.enemy.goldMax - this.enemy.goldMin + 1));

    this.wallet.add('gold',        gold);
    this.wallet.add('xp',          this.enemy.xpReward);
    this.wallet.add('kobold-ear', this.enemy.earReward);

    const isFirst = !this.wallet.isCurrencyUnlocked('kobold-ear');
    if (isFirst) {
      this.wallet.unlockCurrency('kobold-ear');
      this.log.log(
        `Victory! The ${this.enemy.name} drops a Kobold Ear! (+${gold}g, +${this.enemy.xpReward} XP)`,
        'rare'
      );
    } else {
      this.log.log(
        `Victory! ${this.enemy.name} defeated. (+${gold}g, +${this.enemy.xpReward} XP, +${this.enemy.earReward} ear)`,
        'success'
      );
    }

    if (this.fighterHp <= 0) {
      // Mutual kill — awards still granted, but fighter is defeated
      this.fighterHp = 0;
      this.defeated  = true;
      this.lastMsg   = `${this.enemy.name} falls! (mutual kill)`;
      this.msgLine2  = `Kobold's last strike: ${enemyLastDmg} dmg!`;
      this.msgClass  = 'msg-bad';
      this.startRest();
      this.emitState();
      return;
    }

    this.lastMsg       = `${this.enemy.name} defeated!`;
    this.msgLine2      = `Kobold hits back: ${enemyLastDmg} dmg!`;
    this.msgClass      = 'msg-good';
    this.awaitingSpawn = true;
    this.emitState();

    this.spawnTimer = setTimeout(() => {
      this.enemy        = this.buildKobold();
      this.awaitingSpawn = false;
      this.lastMsg      = '-- New enemy! --';
      this.msgLine2     = '';
      this.msgClass     = 'msg-neutral';
      this.emitState();
    }, FIGHTER_MG.SPAWN_DELAY_MS);
  }

  private buildKobold(): Enemy {
    return {
      name:      'Kobold',
      hp:        FIGHTER_MG.KOBOLD_HP,
      maxHp:     FIGHTER_MG.KOBOLD_HP,
      goldMin:   FIGHTER_MG.KOBOLD_GOLD_MIN,
      goldMax:   FIGHTER_MG.KOBOLD_GOLD_MAX,
      xpReward:  FIGHTER_MG.KOBOLD_XP_REWARD,
      earReward: FIGHTER_MG.KOBOLD_EAR_REWARD,
      ascii:
        '  <(>_<)>↟  \n' +
        '   /||-- |   \n' +
        '   d  b  |   ',
    };
  }
}

