import { Injectable, inject } from '@angular/core';
import { Subject } from 'rxjs';
import { WalletService } from '../wallet/wallet.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { UPGRADE_DEFS, UpgradeDef, UpgradeCategory, UpgradeGates, CostDef, RELIC_COSTS } from '../game-config';
import { UPGRADE_FLAVOR, cur, LOG_MSG } from '../flavor-text';
import { scaledCost } from '../utils/mathUtils';

// Re-export types consumed by other components
export type { UpgradeCategory, UpgradeGates };

// ── Save types ────────────────────────────────────────────────

/** Per-upgrade save entry. */
export interface UpgradeSaveEntry {
  level: number;
  costs: Record<string, number>;
}

/** Generic upgrade snapshot: { upgradeId → { level, costs } } */
export type UpgradesSnapshot = Record<string, UpgradeSaveEntry>;

// ── Runtime ───────────────────────────────────────────────────

interface UpgradeRuntime {
  level:        number;
  currentCosts: Record<string, number>;
}

// ── Service ───────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class UpgradeService {
  private readonly wallet  = inject(WalletService);
  private readonly log     = inject(ActivityLogService);
  private readonly defs    = new Map<string, UpgradeDef>(UPGRADE_DEFS.map(d => [d.id, d]));
  private readonly runtime = new Map<string, UpgradeRuntime>();
  /** Stable list of all relic upgrade IDs — used by syncRelicCosts(). */
  private readonly relicIds: string[] = UPGRADE_DEFS.filter(d => d.category === 'relic').map(d => d.id);
  /** Per-upgrade max overrides — used for upgrades with dynamically capped levels. */
  private readonly maxOverrides = new Map<string, number>();

  /** Emits the upgrade ID whenever a level changes. */
  readonly changed$ = new Subject<string>();

  constructor() {
    for (const def of UPGRADE_DEFS) {
      const currentCosts: Record<string, number> = {};
      for (const c of def.costs) currentCosts[c.currency] = c.base;
      this.runtime.set(def.id, { level: 0, currentCosts });
    }
    this.syncRelicCosts();
  }

  // ── Relic cost helpers ─────────────────────────────────────────

  /** How many relic upgrades (category === 'relic') have already been purchased. */
  relicsOwned(): number {
    return this.relicIds.filter(id => (this.runtime.get(id)?.level ?? 0) >= 1).length;
  }

  /**
   * Recalculates the jewelry component of every un-purchased relic upgrade
   * based on how many relic upgrades are currently owned globally.
   * Because ALL unpurchased relics are repriced to the same value, the cost
   * is identical regardless of the order in which the player buys them.
   *
   * Call this whenever relicsOwned() could change (buy, restore, bulk-set).
   */
  syncRelicCosts(): void {
    const owned = this.relicsOwned();
    const jewelryCost = Math.round(RELIC_COSTS.JEWELRY_BASE * Math.pow(RELIC_COSTS.JEWELRY_SCALE, owned));
    for (const id of this.relicIds) {
      const rt = this.runtime.get(id);
      if (!rt || rt.level >= 1) continue; // already purchased — cost irrelevant
      rt.currentCosts['jewelry'] = jewelryCost;
    }
  }

  // ── Queries ───────────────────────────────────────────────────

  level(id: string): number {
    return this.runtime.get(id)?.level ?? 0;
  }

  maxLevel(id: string): number {
    if (this.maxOverrides.has(id)) return this.maxOverrides.get(id)!;
    return this.defs.get(id)?.max ?? 0;
  }

  /** Override the effective max level for an upgrade (e.g. dynamically capped upgrades). */
  setMaxOverride(id: string, value: number): void {
    this.maxOverrides.set(id, Math.max(0, value));
  }

  /** Dynamically update the runtime cost for a single currency on an upgrade.
   *  Used for upgrades whose cost depends on runtime state (e.g. all current ichor). */
  updateCost(id: string, currency: string, amount: number): void {
    const rt = this.runtime.get(id);
    if (rt) rt.currentCosts[currency] = Math.max(1, Math.floor(amount));
  }

  /** Force a single-use upgrade to level 1 without deducting costs. Used by
   *  special purchase handlers that handle cost deduction themselves. */
  forceLevel(id: string, level: number): void {
    const rt = this.runtime.get(id);
    if (!rt) return;
    rt.level = level;
    this.changed$.next(id);
  }

  category(id: string): UpgradeCategory | undefined {
    return this.defs.get(id)?.category;
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

  /** All current costs for an upgrade — [{currency, amount}] in definition order, filtered to the current level. */
  allCosts(id: string): Array<{ currency: string; amount: number }> {
    const def = this.defs.get(id);
    const rt = this.runtime.get(id);
    if (!def || !rt) return [];
    return def.costs
      .filter(c => this.isCostActive(c, rt.level))
      .map(c => ({ currency: c.currency, amount: rt.currentCosts[c.currency] }));
  }

  isMaxed(id: string): boolean {
    return this.level(id) >= this.maxLevel(id);
  }

  canAfford(id: string): boolean {
    const def = this.defs.get(id);
    const rt = this.runtime.get(id);
    if (!def || !rt) return false;
    return def.costs
      .filter(c => this.isCostActive(c, rt.level))
      .every(c => this.wallet.canAfford(c.currency, rt.currentCosts[c.currency]));
  }

  /** Returns upgrade IDs for a given character and category, in registry order.
   *  Upgrades with `enabled: false` are always excluded. */
  getUpgradesFor(characterId: string, category: UpgradeCategory): string[] {
    return UPGRADE_DEFS
      .filter(d => d.characterId === characterId && d.category === category && d.enabled !== false)
      .map(d => d.id);
  }

  /** Returns the visibility gates for an upgrade, or undefined if always visible. */
  getGates(id: string): UpgradeGates | undefined {
    return this.defs.get(id)?.gates;
  }

  /** Returns the character ID that owns a given upgrade, or undefined. */
  charIdFor(id: string): string | undefined {
    return this.defs.get(id)?.characterId;
  }

  // ── Multi-buy queries ──────────────────────────────────────────

  /**
   * Sum of all costs for buying `count` levels starting from the current level.
   * Returns an array of { currency, amount } in definition order, with amounts
   * representing the total across all levels.
   */
  allCostsMulti(id: string, count: number): Array<{ currency: string; amount: number }> {
    const def = this.defs.get(id);
    const rt = this.runtime.get(id);
    if (!def || !rt) return [];
    const currentLevel = rt.level;
    const effectiveMax = this.maxLevel(id);
    const effectiveCount = Math.min(count, effectiveMax - currentLevel);
    if (effectiveCount <= 0) return [];

    const totals: Record<string, number> = {};
    for (let i = 0; i < effectiveCount; i++) {
      const lvl = currentLevel + i;
      for (const c of def.costs) {
        if (!this.isCostActive(c, lvl)) continue;
        const cost = scaledCost(c.base, c.scale, lvl);
        totals[c.currency] = (totals[c.currency] ?? 0) + cost;
      }
    }

    // Return in definition order, deduplicated by currency
    const seen = new Set<string>();
    return def.costs
      .filter(c => c.currency in totals && !seen.has(c.currency) && (seen.add(c.currency), true))
      .map(c => ({ currency: c.currency, amount: totals[c.currency] }));
  }

  /** Whether the player can afford to buy `count` levels of an upgrade. */
  canAffordMulti(id: string, count: number): boolean {
    const costs = this.allCostsMulti(id, count);
    return costs.length > 0 && costs.every(c => this.wallet.canAfford(c.currency, c.amount));
  }

  /**
   * Maximum number of levels the player can currently afford for this upgrade.
   * Simulates successive purchases, deducting from a copy of the wallet.
   */
  maxAffordable(id: string): number {
    const def = this.defs.get(id);
    const rt = this.runtime.get(id);
    if (!def || !rt) return 0;

    const remaining = this.maxLevel(id) - rt.level;
    if (remaining <= 0) return 0;

    // Snapshot available funds
    const available: Record<string, number> = {};
    for (const c of def.costs) {
      if (!(c.currency in available)) {
        available[c.currency] = this.wallet.get(c.currency);
      }
    }

    let count = 0;
    for (let i = 0; i < remaining; i++) {
      const lvl = rt.level + i;
      let canAfford = true;
      const levelCosts: { currency: string; amount: number }[] = [];

      for (const c of def.costs) {
        if (!this.isCostActive(c, lvl)) continue;
        const cost = scaledCost(c.base, c.scale, lvl);
        levelCosts.push({ currency: c.currency, amount: cost });
        if (available[c.currency] < cost) { canAfford = false; break; }
      }
      if (!canAfford) break;
      for (const lc of levelCosts) available[lc.currency] -= lc.amount;
      count++;
    }
    return count;
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
    if (!def || !rt || rt.level >= this.maxLevel(id)) return false;

    const activeCosts = def.costs.filter(c => this.isCostActive(c, rt.level));

    if (!this.canAfford(id)) {
      const needs = activeCosts
        .map(c => `${cur(c.currency, rt.currentCosts[c.currency], '')} (have ${cur(c.currency, Math.floor(this.wallet.get(c.currency)), '')})`)
        .join(', ');
      const name = (UPGRADE_FLAVOR as Record<string, { name: string }>)[id]?.name ?? id;
      this.log.log(LOG_MSG.SYSTEM.UPGRADE_CANT_AFFORD(name, needs), 'warn');
      return false;
    }

    for (const c of activeCosts) {
      this.wallet.remove(c.currency, rt.currentCosts[c.currency]);
    }
    rt.level++;

    // Recalculate costs for the new level from the canonical formula
    // (base × scale^level) so buy and restore always agree.
    for (const c of def.costs) {
      rt.currentCosts[c.currency] = scaledCost(c.base, c.scale, rt.level);
    }

    const name = (UPGRADE_FLAVOR as Record<string, { name: string }>)[id]?.name ?? id;
    this.log.log(LOG_MSG.SYSTEM.UPGRADE_SUCCESS(name, rt.level), 'success');
    this.syncRelicCosts();
    this.changed$.next(id);
    return true;
  }

  /**
   * Attempt to purchase up to `count` levels of the given upgrade.
   * Buys one at a time; stops when the player can no longer afford or hits max.
   * Returns the number of levels actually purchased.
   */
  buyMulti(id: string, count: number): number {
    let bought = 0;
    for (let i = 0; i < count; i++) {
      if (!this.buy(id)) break;
      bought++;
    }
    return bought;
  }

  // ── Save / load ───────────────────────────────────────────────

  /**
   * Serialize all upgrade levels and current costs into a generic snapshot.
   * Adding new upgrades never requires changing this method.
   */
  snapshot(): UpgradesSnapshot {
    const result: UpgradesSnapshot = {};
    for (const [id, rt] of this.runtime) {
      result[id] = { level: rt.level, costs: { ...rt.currentCosts } };
    }
    return result;
  }

  /**
   * Sets every upgrade to 0 and resets each cost back to its base value.
   * Emits changed$ for each updated upgrade.
   */
  setAllToZero(): void {
    for (const def of this.defs.values()) {
      const rt = this.runtime.get(def.id);
      if (!rt) continue;
      rt.level = 0;
      for (const c of def.costs) {
        rt.currentCosts[c.currency] = c.base;
      }
      this.changed$.next(def.id);
    }
    this.syncRelicCosts();
  }

  /**
   * Sets every upgrade to its maximum level and rebuilds each cost to match,
   * so the button correctly shows "MAXED".
   * Emits changed$ for each updated upgrade.
   */
  setAllToMax(): void {
    for (const def of this.defs.values()) {
      const rt = this.runtime.get(def.id);
      if (!rt) continue;
      const effectiveMax = this.maxLevel(def.id);
      rt.level = effectiveMax;
      for (const c of def.costs) {
        rt.currentCosts[c.currency] = scaledCost(c.base, c.scale, effectiveMax);
      }
      this.changed$.next(def.id);
    }
    this.syncRelicCosts();
  }

  /**
   * Sets every upgrade to floor(max / 2) and rebuilds each cost to match
   * the new level, so the next purchase shows the correctly-scaled price.
   * Emits changed$ for each updated upgrade.
   */
  setAllToHalfMax(): void {
    for (const def of this.defs.values()) {
      const rt = this.runtime.get(def.id);
      if (!rt) continue;
      const targetLevel = Math.floor(this.maxLevel(def.id) / 2);
      rt.level = targetLevel;
      for (const c of def.costs) {
        rt.currentCosts[c.currency] = scaledCost(c.base, c.scale, targetLevel);
      }
      this.changed$.next(def.id);
    }
    this.syncRelicCosts();
  }

  /**
   * Restore upgrade levels from a generic snapshot.
   * Costs are always **recalculated** from the current config definition
   * (base × scale^level) — saved cost values are intentionally discarded.
   * This ensures that balance changes to base/scale in UPGRADE_DEFS are
   * reflected immediately on load, rather than carrying forward stale
   * numbers from an older save.
   * Unknown upgrade IDs are silently ignored (forward-compat).
   */
  restore(data: UpgradesSnapshot): void {
    for (const [id, entry] of Object.entries(data)) {
      const def = this.defs.get(id);
      const rt  = this.runtime.get(id);
      if (!def || !rt) continue;

      rt.level = entry.level;

      // Always rebuild costs from the live config so balance tweaks take
      // effect immediately without requiring a save wipe.
      const restoredCosts: Record<string, number> = {};
      for (const costDef of def.costs) {
        restoredCosts[costDef.currency] = scaledCost(costDef.base, costDef.scale, rt.level);
      }
      rt.currentCosts = restoredCosts;
    }
    // Recompute jewelry costs for all un-purchased relic upgrades based on
    // how many relics were restored from save.
    this.syncRelicCosts();
  }

  // ── Private helpers ───────────────────────────────────────────

  /**
   * Returns true if the given cost definition is active at the specified upgrade level.
   * Costs without fromLevel/untilLevel are always active (backward compatible).
   */
  private isCostActive(costDef: CostDef, currentLevel: number): boolean {
    if (costDef.fromLevel != null && currentLevel < costDef.fromLevel) return false;
    if (costDef.untilLevel != null && currentLevel >= costDef.untilLevel) return false;
    return true;
  }
}
