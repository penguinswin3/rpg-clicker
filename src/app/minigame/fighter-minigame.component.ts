import { Component, Input, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { WalletService } from '../wallet/wallet.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { FIGHTER_MG } from '../game-config';

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

  private wallet = inject(WalletService);
  private log    = inject(ActivityLogService);
  private sub    = new Subscription();
  private spawnTimer?: ReturnType<typeof setTimeout>;

  // ── Fighter state ─────────────────────────
  readonly maxHp   = FIGHTER_MG.MAX_HP;
  readonly defense = FIGHTER_MG.DEFENSE;
  fighterHp: number = FIGHTER_MG.MAX_HP;

  // ── Wallet-synced ─────────────────────────
  potions = 0;

  // ── Combat state ──────────────────────────
  defeated      = false;
  awaitingSpawn = false;
  firstKillDone = false;

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
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
    if (this.spawnTimer) clearTimeout(this.spawnTimer);
  }

  // ── Actions ───────────────────────────────

  attack(): void {
    if (this.actionsDisabled) return;

    const dmg = this.attackPower;
    this.enemy.hp = Math.max(0, this.enemy.hp - dmg);

    if (this.enemy.hp <= 0) {
      this.onEnemyDefeated();
      return;
    }

    const eDmg = this.rollEnemyDamage();
    this.lastMsg  = `You deal ${dmg} dmg.`;
    this.msgLine2 = `${this.enemy.name} hits ${eDmg}!`;
    this.applyEnemyDamage(eDmg);
  }

  heal(): void {
    if (this.healDisabled) return;

    this.wallet.remove('potion', 1);
    const healed = Math.min(FIGHTER_MG.POTION_HEAL, this.maxHp - this.fighterHp);
    this.fighterHp += healed;

    const eDmg = this.rollEnemyDamage();
    this.lastMsg  = `You heal ${healed} HP.`;
    this.msgLine2 = `${this.enemy.name} hits ${eDmg}!`;
    this.msgClass = 'msg-neutral';
    this.applyEnemyDamage(eDmg);
  }

  retry(): void {
    this.fighterHp = this.maxHp;
    this.enemy     = this.buildKobold();
    this.defeated  = false;
    this.lastMsg   = '-- Ready to fight --';
    this.msgLine2  = '';
    this.msgClass  = 'msg-neutral';
  }

  // ── Private helpers ───────────────────────

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
    }
  }

  private onEnemyDefeated(): void {
    const gold = this.enemy.goldMin +
      Math.floor(Math.random() * (this.enemy.goldMax - this.enemy.goldMin + 1));

    this.wallet.add('gold',        gold);
    this.wallet.add('xp',          this.enemy.xpReward);
    this.wallet.add('monster-ear', this.enemy.earReward);

    const isFirst = !this.firstKillDone;
    if (isFirst) {
      this.firstKillDone = true;
      this.wallet.unlockCurrency('monster-ear');
      this.log.log(
        `Victory! The ${this.enemy.name} drops a Monster Ear! (+${gold}g, +${this.enemy.xpReward} XP)`,
        'rare'
      );
    } else {
      this.log.log(
        `Victory! ${this.enemy.name} defeated. (+${gold}g, +${this.enemy.xpReward} XP, +${this.enemy.earReward} ear)`,
        'success'
      );
    }

    this.lastMsg      = `${this.enemy.name} defeated!`;
    this.msgLine2     = '';
    this.msgClass     = 'msg-good';
    this.awaitingSpawn = true;

    this.spawnTimer = setTimeout(() => {
      this.enemy        = this.buildKobold();
      this.awaitingSpawn = false;
      this.lastMsg      = '-- New enemy! --';
      this.msgLine2     = '';
      this.msgClass     = 'msg-neutral';
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
        ' <(>_<)>↟  \n' +
        '   /||-- |   \n' +
        '   d  b  |   ',
    };
  }
}

