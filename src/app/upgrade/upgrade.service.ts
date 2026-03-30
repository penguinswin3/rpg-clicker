import { Injectable, inject } from '@angular/core';
import { Subject } from 'rxjs';
import { WalletService } from '../wallet/wallet.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { BASE_COSTS, COST_SCALE, UPGRADE_MAX, XP_THRESHOLDS } from '../game-config';
import { UPGRADE_FLAVOR } from '../flavor-text';
import { UpgradeState } from '../save/save.service';

// ── Types ─────────────────────────────────────────────────────

export type UpgradeId       = keyof typeof UPGRADE_MAX;
export type UpgradeCategory = 'standard' | 'minigame';

interface CostEntry {
  readonly currency: string;
  readonly base:     number;
  readonly scale:    number;
}

/** Optional visibility gates — evaluated by the host component. */
export interface UpgradeGates {
  /** Hide until the Apothecary character is unlocked. */
  readonly requiresApothecary?: boolean;
  /** Minimum XP required before the card is shown. */
  readonly xpMin?: number;
}

interface UpgradeDef {
  readonly id:          UpgradeId;
  readonly max:         number;
  readonly costs:       readonly CostEntry[];
  /** Which upgrades column this card appears in. */
  readonly category:    UpgradeCategory;
  /** Which character tab owns this upgrade. */
  readonly characterId: string;
  /** Optional visibility gates. */
  readonly gates?:      UpgradeGates;
}

interface UpgradeRuntime {
  level:        number;
  currentCosts: Record<string, number>;
}

// ── Declarative upgrade registry ──────────────────────────────

const UPGRADE_REGISTRY: readonly UpgradeDef[] = [
  // ── Fighter — standard ───────────────────────────────────────
  { id: 'BETTER_BOUNTIES',      category: 'standard', characterId: 'fighter',
    max: UPGRADE_MAX.BETTER_BOUNTIES,
    costs: [{ currency: 'gold', base: BASE_COSTS.BETTER_BOUNTIES, scale: COST_SCALE.BETTER_BOUNTIES }] },
  { id: 'CONTRACTED_HIRELINGS', category: 'standard', characterId: 'fighter',
    max: UPGRADE_MAX.CONTRACTED_HIRELINGS,
    costs: [{ currency: 'gold', base: BASE_COSTS.CONTRACTED_HIRELINGS, scale: COST_SCALE.CONTRACTED_HIRELINGS }] },
  { id: 'INSIGHTFUL_CONTRACTS', category: 'standard', characterId: 'fighter',
    max: UPGRADE_MAX.INSIGHTFUL_CONTRACTS,
    gates: { xpMin: XP_THRESHOLDS.INSIGHTFUL_CONTRACTS_UNLOCK },
    costs: [{ currency: 'gold', base: BASE_COSTS.INSIGHTFUL_CONTRACTS, scale: COST_SCALE.INSIGHTFUL_CONTRACTS }] },

  // ── Fighter — minigame ───────────────────────────────────────
  { id: 'SHARPER_SWORDS',   category: 'minigame', characterId: 'fighter',
    max: UPGRADE_MAX.SHARPER_SWORDS,
    costs: [{ currency: 'gold', base: BASE_COSTS.SHARPER_SWORDS, scale: COST_SCALE.SHARPER_SWORDS }] },
  { id: 'POTION_CHUGGING',  category: 'minigame', characterId: 'fighter',
    max: UPGRADE_MAX.POTION_CHUGGING,
    gates: { requiresApothecary: true },
    costs: [{ currency: 'potion', base: BASE_COSTS.POTION_CHUGGING, scale: COST_SCALE.POTION_CHUGGING }] },
  { id: 'STRONGER_KOBOLDS', category: 'minigame', characterId: 'fighter',
    max: UPGRADE_MAX.STRONGER_KOBOLDS,
    gates: { xpMin: XP_THRESHOLDS.STRONGER_KOBOLDS_UNLOCK },
    costs: [
      { currency: 'kobold-ear', base: BASE_COSTS.STRONGER_KOBOLDS_EARS, scale: COST_SCALE.STRONGER_KOBOLDS },
      { currency: 'beast',      base: BASE_COSTS.STRONGER_KOBOLDS_MEAT, scale: COST_SCALE.STRONGER_KOBOLDS },
    ] },

  // ── Ranger — standard ────────────────────────────────────────
  { id: 'MORE_HERBS',      category: 'standard', characterId: 'ranger',
    max: UPGRADE_MAX.MORE_HERBS,
    costs: [{ currency: 'gold', base: BASE_COSTS.MORE_HERBS, scale: COST_SCALE.MORE_HERBS }] },
  { id: 'BETTER_TRACKING', category: 'standard', characterId: 'ranger',
    max: UPGRADE_MAX.BETTER_TRACKING,
    costs: [{ currency: 'gold', base: BASE_COSTS.BETTER_TRACKING, scale: COST_SCALE.BETTER_TRACKING }] },
  { id: 'BIGGER_GAME',     category: 'standard', characterId: 'ranger',
    max: UPGRADE_MAX.BIGGER_GAME,
    costs: [{ currency: 'gold', base: BASE_COSTS.BIGGER_GAME, scale: COST_SCALE.BIGGER_GAME }] },
  { id: 'POTION_CATS_EYE', category: 'standard', characterId: 'ranger',
    max: UPGRADE_MAX.POTION_CATS_EYE,
    gates: { requiresApothecary: true },
    costs: [
      { currency: 'concentrated-potion', base: BASE_COSTS.POTION_CATS_EYE_CONC,  scale: COST_SCALE.POTION_CATS_EYE },
      { currency: 'pixie-dust',          base: BASE_COSTS.POTION_CATS_EYE_PIXIE, scale: COST_SCALE.POTION_CATS_EYE },
    ] },

  // ── Ranger — minigame ────────────────────────────────────────
  { id: 'BOUNTIFUL_LANDS', category: 'minigame', characterId: 'ranger',
    max: UPGRADE_MAX.BOUNTIFUL_LANDS,
    costs: [{ currency: 'kobold-ear', base: BASE_COSTS.BOUNTIFUL_LANDS, scale: COST_SCALE.BOUNTIFUL_LANDS }] },
  { id: 'ABUNDANT_LANDS',  category: 'minigame', characterId: 'ranger',
    max: UPGRADE_MAX.ABUNDANT_LANDS,
    costs: [{ currency: 'pixie-dust', base: BASE_COSTS.ABUNDANT_LANDS,  scale: COST_SCALE.ABUNDANT_LANDS  }] },

  // ── Apothecary — standard ────────────────────────────────────
  { id: 'POTION_TITRATION', category: 'standard', characterId: 'apothecary',
    max: UPGRADE_MAX.POTION_TITRATION,
    costs: [{ currency: 'gold', base: BASE_COSTS.POTION_TITRATION, scale: COST_SCALE.POTION_TITRATION }] },
  { id: 'POTION_MARKETING', category: 'standard', characterId: 'apothecary',
    max: UPGRADE_MAX.POTION_MARKETING,
    costs: [{ currency: 'gold', base: BASE_COSTS.POTION_MARKETING, scale: COST_SCALE.POTION_MARKETING }] },
];

// ── Service ───────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class UpgradeService {
  private readonly wallet  = inject(WalletService);
  private readonly log     = inject(ActivityLogService);
  private readonly defs    = new Map<string, UpgradeDef>(UPGRADE_REGISTRY.map(d => [d.id, d]));
  private readonly runtime = new Map<string, UpgradeRuntime>();

  /** Emits the upgrade ID whenever a level changes. */
  readonly changed$ = new Subject<string>();

  constructor() {
    for (const def of UPGRADE_REGISTRY) {
      const currentCosts: Record<string, number> = {};
      for (const c of def.costs) currentCosts[c.currency] = c.base;
      this.runtime.set(def.id, { level: 0, currentCosts });
    }
  }

  // ── Queries ───────────────────────────────────────────────────

  level(id: string): number {
    return this.runtime.get(id)?.level ?? 0;
  }

  maxLevel(id: string): number {
    return this.defs.get(id)?.max ?? 0;
  }

  /** Current cost for the primary (first) currency of this upgrade. */
  cost(id: string): number {
    const rt = this.runtime.get(id);
    if (!rt) return 0;
    return Object.values(rt.currentCosts)[0] ?? 0;
  }

  /** Current cost for a specific currency of a multi-cost upgrade. */
  costFor(id: string, currency: string): number {
    return this.runtime.get(id)?.currentCosts[currency] ?? 0;
  }

  /** All current costs for an upgrade — [{currency, amount}] in definition order. */
  allCosts(id: string): Array<{ currency: string; amount: number }> {
    const rt = this.runtime.get(id);
    if (!rt) return [];
    return Object.entries(rt.currentCosts).map(([currency, amount]) => ({ currency, amount }));
  }

  isMaxed(id: string): boolean {
    const def = this.defs.get(id);
    return !def || this.level(id) >= def.max;
  }

  canAfford(id: string): boolean {
    const rt = this.runtime.get(id);
    if (!rt) return false;
    return Object.entries(rt.currentCosts)
      .every(([currency, amount]) => this.wallet.canAfford(currency, amount));
  }

  /** Returns upgrade IDs for a given character and category, in registry order. */
  getUpgradesFor(characterId: string, category: UpgradeCategory): string[] {
    return UPGRADE_REGISTRY
      .filter(d => d.characterId === characterId && d.category === category)
      .map(d => d.id);
  }

  /** Returns the visibility gates for an upgrade, or undefined if always visible. */
  getGates(id: string): UpgradeGates | undefined {
    return this.defs.get(id)?.gates;
  }

  // ── Mutation ──────────────────────────────────────────────────

  /**
   * Attempt to purchase one level of the given upgrade.
   * Deducts all required currencies, scales costs for the next purchase,
   * and logs success or failure. Returns `true` on success.
   */
  buy(id: string): boolean {
    const def = this.defs.get(id);
    const rt  = this.runtime.get(id);
    if (!def || !rt || rt.level >= def.max) return false;

    if (!this.canAfford(id)) {
      const needs = Object.entries(rt.currentCosts)
        .map(([currency, need]) => `${need} ${currency} (have ${Math.floor(this.wallet.get(currency))})`)
        .join(', ');
      const name = (UPGRADE_FLAVOR as Record<string, { name: string }>)[id]?.name ?? id;
      this.log.log(`Not enough resources for ${name}. Need: ${needs}.`, 'warn');
      return false;
    }

    for (const c of def.costs) {
      this.wallet.remove(c.currency, rt.currentCosts[c.currency]);
      rt.currentCosts[c.currency] = Math.floor(rt.currentCosts[c.currency] * c.scale);
    }
    rt.level++;

    const name = (UPGRADE_FLAVOR as Record<string, { name: string }>)[id]?.name ?? id;
    this.log.log(`${name} upgraded to Lv.${rt.level}.`, 'success');
    this.changed$.next(id);
    return true;
  }

  // ── Save / load ───────────────────────────────────────────────

  /**
   * Serialize current upgrade state into the legacy flat UpgradeState shape
   * so save files remain fully backward-compatible.
   */
  snapshotToLegacy(): Omit<UpgradeState,
    'selectedKoboldLevel' | 'minigameUnlocked' | 'jacksOwned' | 'jacksAllocations' | 'fighterCombatState'
  > {
    return {
      goldPerClick:             this.level('BETTER_BOUNTIES') + 1,
      clickUpgradeLevel:        this.level('BETTER_BOUNTIES'),
      clickUpgradeCost:         this.cost('BETTER_BOUNTIES'),
      autoUpgradeLevel:         this.level('CONTRACTED_HIRELINGS'),
      autoUpgradeCost:          this.cost('CONTRACTED_HIRELINGS'),
      insightfulContractsLevel: this.level('INSIGHTFUL_CONTRACTS'),
      insightfulContractsCost:  this.cost('INSIGHTFUL_CONTRACTS'),
      potionChuggingLevel:      this.level('POTION_CHUGGING'),
      potionChuggingCost:       this.cost('POTION_CHUGGING'),
      sharperSwordsLevel:       this.level('SHARPER_SWORDS'),
      sharperSwordsCost:        this.cost('SHARPER_SWORDS'),
      strongerKoboldsLevel:     this.level('STRONGER_KOBOLDS'),
      strongerKoboldsEarsCost:  this.costFor('STRONGER_KOBOLDS', 'kobold-ear'),
      strongerKoboldsMeatCost:  this.costFor('STRONGER_KOBOLDS', 'beast'),
      moreHerbsLevel:           this.level('MORE_HERBS'),
      moreHerbsCost:            this.cost('MORE_HERBS'),
      betterTrackingLevel:      this.level('BETTER_TRACKING'),
      betterTrackingCost:       this.cost('BETTER_TRACKING'),
      biggerGameLevel:          this.level('BIGGER_GAME'),
      biggerGameCost:           this.cost('BIGGER_GAME'),
      bountifulLandsLevel:      this.level('BOUNTIFUL_LANDS'),
      bountifulLandsCost:       this.cost('BOUNTIFUL_LANDS'),
      abundantLandsLevel:       this.level('ABUNDANT_LANDS'),
      abundantLandsCost:        this.cost('ABUNDANT_LANDS'),
      potionCatsEyeLevel:       this.level('POTION_CATS_EYE'),
      potionCatsEyeConcCost:    this.costFor('POTION_CATS_EYE', 'concentrated-potion'),
      potionCatsEyePixieCost:   this.costFor('POTION_CATS_EYE', 'pixie-dust'),
      herbSaveChance:           this.level('POTION_TITRATION'),
      potionTitrationLevel:     this.level('POTION_TITRATION'),
      potionTitrationCost:      this.cost('POTION_TITRATION'),
      potionMarketingLevel:     this.level('POTION_MARKETING'),
      potionMarketingCost:      this.cost('POTION_MARKETING'),
    };
  }

  /**
   * Restore upgrade levels and costs from a legacy save snapshot.
   * Handles old-save backward compat via `?? default` for optional fields.
   */
  restoreFromLegacy(s: UpgradeState): void {
    this.restoreEntry('BETTER_BOUNTIES',      s.clickUpgradeLevel,           { 'gold':         s.clickUpgradeCost });
    this.restoreEntry('CONTRACTED_HIRELINGS', s.autoUpgradeLevel,            { 'gold':         s.autoUpgradeCost });
    this.restoreEntry('INSIGHTFUL_CONTRACTS', s.insightfulContractsLevel ?? 0, { 'gold':        s.insightfulContractsCost  ?? BASE_COSTS.INSIGHTFUL_CONTRACTS });
    this.restoreEntry('POTION_CHUGGING',      s.potionChuggingLevel,         { 'potion':       s.potionChuggingCost });
    this.restoreEntry('SHARPER_SWORDS',       s.sharperSwordsLevel  ?? 0,    { 'gold':         s.sharperSwordsCost   ?? BASE_COSTS.SHARPER_SWORDS });
    this.restoreEntry('STRONGER_KOBOLDS',     s.strongerKoboldsLevel ?? 0,   {
      'kobold-ear': s.strongerKoboldsEarsCost ?? BASE_COSTS.STRONGER_KOBOLDS_EARS,
      'beast':      s.strongerKoboldsMeatCost ?? BASE_COSTS.STRONGER_KOBOLDS_MEAT,
    });
    this.restoreEntry('MORE_HERBS',           s.moreHerbsLevel,              { 'gold':         s.moreHerbsCost });
    this.restoreEntry('BETTER_TRACKING',      s.betterTrackingLevel,         { 'gold':         s.betterTrackingCost });
    this.restoreEntry('BIGGER_GAME',          s.biggerGameLevel  ?? 0,       { 'gold':         s.biggerGameCost  ?? BASE_COSTS.BIGGER_GAME });
    this.restoreEntry('BOUNTIFUL_LANDS',      s.bountifulLandsLevel ?? 0,    { 'kobold-ear':   s.bountifulLandsCost ?? BASE_COSTS.BOUNTIFUL_LANDS });
    this.restoreEntry('ABUNDANT_LANDS',       s.abundantLandsLevel  ?? 0,    { 'pixie-dust':   s.abundantLandsCost  ?? BASE_COSTS.ABUNDANT_LANDS });
    this.restoreEntry('POTION_CATS_EYE',      s.potionCatsEyeLevel  ?? 0,    {
      'concentrated-potion': s.potionCatsEyeConcCost  ?? BASE_COSTS.POTION_CATS_EYE_CONC,
      'pixie-dust':          s.potionCatsEyePixieCost ?? BASE_COSTS.POTION_CATS_EYE_PIXIE,
    });
    this.restoreEntry('POTION_TITRATION',     s.potionTitrationLevel,        { 'gold':         s.potionTitrationCost });
    this.restoreEntry('POTION_MARKETING',     s.potionMarketingLevel,        { 'gold':         s.potionMarketingCost });
  }

  private restoreEntry(id: string, level: number, costs: Record<string, number>): void {
    const rt = this.runtime.get(id);
    if (rt) {
      rt.level        = level;
      rt.currentCosts = { ...costs };
    }
  }
}
