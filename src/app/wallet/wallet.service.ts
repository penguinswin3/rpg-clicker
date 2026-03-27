import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface Currency {
  id: string;
  name: string;
  shorthand: string;
  color: string;
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
    { id: 'gold', name: 'Gold',       shorthand: 'gp', color: '#ffcc00' },
    { id: 'xp',   name: 'Experience', shorthand: 'xp', color: '#00ff88' },
  ];

  private readonly stateSource = new BehaviorSubject<WalletState>(
    Object.fromEntries(this.currencies.map(c => [c.id, { amount: 0, perSecond: 0 }]))
  );

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

