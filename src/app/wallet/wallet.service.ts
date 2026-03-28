import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface Currency {
  id: string;
  name: string;
  shorthand: string;
  color: string;
  /** If set, this currency is hidden in the wallet until the named character is unlocked. */
  requiredCharacterId?: string;
  /**
   * If true, this currency is hidden until `unlockCurrency(id)` is called explicitly.
   * The wallet entry still exists and can accumulate amounts — only the sidebar hides it.
   */
  manualUnlock?: boolean;
}

export interface CurrencyEntry {
  amount: number;
  perSecond: number;
}

export type WalletState = Record<string, CurrencyEntry>;

@Injectable({ providedIn: 'root' })
export class WalletService {
  /** All currencies recognised by the wallet. Add new ones here. */
  readonly currencies: Currency[] = [
    { id: 'gold',        name: 'Gold',          shorthand: 'gp', color: '#ffcc00' },
    { id: 'xp',          name: 'Experience',    shorthand: 'xp', color: '#00ff88' },
    { id: 'herb',          name: 'Herb',          shorthand: 'hr', color: '#44dd44', requiredCharacterId: 'ranger' },
    { id: 'beast',         name: 'Raw Beast Meat', shorthand: 'bm', color: '#e8739a', requiredCharacterId: 'ranger' },
    { id: 'cooked-meat',   name: 'Cooked Meat',    shorthand: 'cm', color: '#c0732a', requiredCharacterId: 'ranger', manualUnlock: true },
    { id: 'pixie-dust',    name: 'Pixie Dust',     shorthand: 'pd', color: '#ffe066', requiredCharacterId: 'ranger', manualUnlock: true },
    { id: 'potion',         name: 'Potion',         shorthand: 'pt', color: '#c37ef0', requiredCharacterId: 'apothecary' },
    { id: 'perfect-potion', name: 'Perfect Potion', shorthand: 'pp', color: '#f5d0ff', requiredCharacterId: 'apothecary', manualUnlock: true },
    { id: 'monster-ear',    name: 'Monster Ear',    shorthand: 'me', color: '#e07820', requiredCharacterId: 'fighter',    manualUnlock: true },
  ];

  private readonly stateSource = new BehaviorSubject<WalletState>(
    Object.fromEntries(this.currencies.map(c => [c.id, { amount: 0, perSecond: 0 }]))
  );

  /** Tracks currencies whose `manualUnlock` gate has been opened. */
  private readonly manualUnlocksSource = new BehaviorSubject<Set<string>>(new Set<string>());
  readonly manualUnlocks$ = this.manualUnlocksSource.asObservable();

  /** Observable of the full wallet state. */
  readonly state$ = this.stateSource.asObservable();

  // ── Public API ────────────────────────────────────────────────

  /** Add `amount` of `currencyId` to the wallet. */
  add(currencyId: string, amount: number): void {
    this._patch(currencyId, e => ({ ...e, amount: e.amount + amount }));
  }

  /**
   * Remove `amount` of `currencyId` from the wallet.
   * Returns `true` on success, `false` if the balance is insufficient.
   */
  remove(currencyId: string, amount: number): boolean {
    if (!this.canAfford(currencyId, amount)) return false;
    this._patch(currencyId, e => ({ ...e, amount: e.amount - amount }));
    return true;
  }

  /** Returns `true` if the wallet holds at least `amount` of `currencyId`. */
  canAfford(currencyId: string, amount: number): boolean {
    return this.get(currencyId) >= amount;
  }

  /** Returns the current amount of `currencyId` (0 if unknown). */
  get(currencyId: string): number {
    return this.stateSource.getValue()[currencyId]?.amount ?? 0;
  }

  /** Set the passive generation rate for `currencyId` (used for display only). */
  setPerSecond(currencyId: string, rate: number): void {
    this._patch(currencyId, e => ({ ...e, perSecond: rate }));
  }

  /** Hard-set `currencyId` to an exact `amount` (clamped to ≥ 0). */
  set(currencyId: string, amount: number): void {
    this._patch(currencyId, e => ({ ...e, amount: Math.max(0, amount) }));
  }

  /**
   * Lift the `manualUnlock` gate for a currency, making it visible in the wallet sidebar.
   * Safe to call multiple times.
   */
  unlockCurrency(id: string): void {
    const current = this.manualUnlocksSource.getValue();
    if (current.has(id)) return;
    const next = new Set(current);
    next.add(id);
    this.manualUnlocksSource.next(next);
  }

  // ── Private ───────────────────────────────────────────────────

  private _patch(
    currencyId: string,
    fn: (entry: CurrencyEntry) => CurrencyEntry
  ): void {
    const state = this.stateSource.getValue();
    if (!state[currencyId]) return;
    this.stateSource.next({ ...state, [currencyId]: fn(state[currencyId]) });
  }
}

