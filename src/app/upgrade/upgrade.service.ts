import { Injectable, inject } from '@angular/core';
import { Subject } from 'rxjs';
import { WalletService } from '../wallet/wallet.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { UPGRADE_DEFS, UpgradeDef, UpgradeCategory, UpgradeGates, CostDef } from '../game-config';
import { UPGRADE_FLAVOR } from '../flavor-text';
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

  /** Emits the upgrade ID whenever a level changes. */
  readonly changed$ = new Subject<string>();

  constructor() {
    for (const def of UPGRADE_DEFS) {
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
    const def = this.defs.get(id);
    return !def || this.level(id) >= def.max;
  }

  canAfford(id: string): boolean {
    const def = this.defs.get(id);
    const rt = this.runtime.get(id);
    if (!def || !rt) return false;
    return def.costs
      .filter(c => this.isCostActive(c, rt.level))
      .every(c => this.wallet.canAfford(c.currency, rt.currentCosts[c.currency]));
  }

  /** Returns upgrade IDs for a given character and category, in registry order. */
  getUpgradesFor(characterId: string, category: UpgradeCategory): string[] {
    return UPGRADE_DEFS
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

    const activeCosts = def.costs.filter(c => this.isCostActive(c, rt.level));

    if (!this.canAfford(id)) {
      const needs = activeCosts
        .map(c => `${rt.currentCosts[c.currency]} ${c.currency} (have ${Math.floor(this.wallet.get(c.currency))})`)
        .join(', ');
      const name = (UPGRADE_FLAVOR as Record<string, { name: string }>)[id]?.name ?? id;
      this.log.log(`Not enough resources for ${name}. Need: ${needs}.`, 'warn');
      return false;
    }

    for (const c of activeCosts) {
      this.wallet.remove(c.currency, rt.currentCosts[c.currency]);
      rt.currentCosts[c.currency] = scaledCost(rt.currentCosts[c.currency], c.scale, 1);
    }
    rt.level++;

    const name = (UPGRADE_FLAVOR as Record<string, { name: string }>)[id]?.name ?? id;
    this.log.log(`${name} upgraded to Lv.${rt.level}.`, 'success');
    this.changed$.next(id);
    return true;
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
   * Sets every upgrade to floor(max / 2) and rebuilds each cost to match
   * the new level, so the next purchase shows the correctly-scaled price.
   * Emits changed$ for each updated upgrade.
   */
  setAllToHalfMax(): void {
    for (const def of this.defs.values()) {
      const rt = this.runtime.get(def.id);
      if (!rt) continue;
      const targetLevel = Math.floor(def.max / 2);
      rt.level = targetLevel;
      for (const c of def.costs) {
        rt.currentCosts[c.currency] = scaledCost(c.base, c.scale, targetLevel);
      }
      this.changed$.next(def.id);
    }
  }

  /**
   * Restore upgrade levels and costs from a generic snapshot.
   * Costs are rebuilt against the def's currency list — if a saved currency
   * is no longer valid (e.g. cost structure changed), the def's base cost is
   * used as a fallback instead of blindly applying the stale value.
   * Unknown upgrade IDs are silently ignored (forward-compat).
   */
  restore(data: UpgradesSnapshot): void {
    for (const [id, entry] of Object.entries(data)) {
      const def = this.defs.get(id);
      const rt  = this.runtime.get(id);
      if (!def || !rt) continue;

      rt.level = entry.level;

      // Rebuild costs using the def's currency list as the authority.
      // Use the saved amount if the key matches; fall back to the def's base cost
      // if the save has a stale or renamed currency (e.g. after a balance change).
      const restoredCosts: Record<string, number> = {};
      for (const costDef of def.costs) {
        restoredCosts[costDef.currency] = entry.costs[costDef.currency] ?? costDef.base;
      }
      rt.currentCosts = restoredCosts;
    }
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
