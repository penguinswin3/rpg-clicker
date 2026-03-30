import { Injectable, inject } from '@angular/core';
import { Subject } from 'rxjs';
import { WalletService } from '../wallet/wallet.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { UPGRADE_DEFS, UpgradeDef, UpgradeCategory, UpgradeGates } from '../game-config';
import { UPGRADE_FLAVOR } from '../flavor-text';

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
   * Restore upgrade levels and costs from a generic snapshot.
   * Unknown IDs are silently ignored (forward-compat).
   */
  restore(data: UpgradesSnapshot): void {
    for (const [id, entry] of Object.entries(data)) {
      const rt = this.runtime.get(id);
      if (rt) {
        rt.level        = entry.level;
        rt.currentCosts = { ...entry.costs };
      }
    }
  }
}
