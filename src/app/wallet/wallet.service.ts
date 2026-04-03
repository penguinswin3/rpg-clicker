import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { CURRENCY_FLAVOR } from '../flavor-text';

export interface Currency {
  id: string;
  name: string;
  /** Single ASCII/Unicode symbol shown as the compact identifier. */
  symbol: string;
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
  /** All currencies recognized by the wallet. Add new ones here. */
  readonly currencies: Currency[] = [
    // ── Fighter ──────────────────────────────────────────────────────────────
    { id: 'gold',                 ...CURRENCY_FLAVOR['gold']                  },
    { id: 'xp',                   ...CURRENCY_FLAVOR['xp']                    },
    { id: 'kobold-ear',           ...CURRENCY_FLAVOR['kobold-ear'],            requiredCharacterId: 'fighter',   manualUnlock: true },
    { id: 'kobold-tongue',        ...CURRENCY_FLAVOR['kobold-tongue'],         requiredCharacterId: 'fighter',   manualUnlock: true },
    { id: 'kobold-hair',          ...CURRENCY_FLAVOR['kobold-hair'],           requiredCharacterId: 'fighter',   manualUnlock: true },
    { id: 'kobold-fang',          ...CURRENCY_FLAVOR['kobold-fang'],           requiredCharacterId: 'fighter',   manualUnlock: true },

    // ── Ranger ───────────────────────────────────────────────────────────────
    { id: 'herb',                 ...CURRENCY_FLAVOR['herb'],                  requiredCharacterId: 'ranger'       },
    { id: 'beast',                ...CURRENCY_FLAVOR['beast'],                 requiredCharacterId: 'ranger'       },
    //might go unused { id: 'cooked-meat',          ...CURRENCY_FLAVOR['cooked-meat'],           requiredCharacterId: 'ranger',    manualUnlock: true },
    { id: 'pixie-dust',           ...CURRENCY_FLAVOR['pixie-dust'],            requiredCharacterId: 'ranger',    manualUnlock: true },
    // ── Apothecary ───────────────────────────────────────────────────────────
    { id: 'potion',               ...CURRENCY_FLAVOR['potion'],                requiredCharacterId: 'apothecary'   },
    { id: 'concentrated-potion',  ...CURRENCY_FLAVOR['concentrated-potion'],   requiredCharacterId: 'apothecary', manualUnlock: true },
    // ── Culinarian ───────────────────────────────────────────────────────────
    { id: 'spice',                ...CURRENCY_FLAVOR['spice'],                 requiredCharacterId: 'culinarian'   },
    { id: 'hearty-meal',          ...CURRENCY_FLAVOR['hearty-meal'],           requiredCharacterId: 'culinarian', manualUnlock: true },
    // ── Thief ─────────────────────────────────────────────────────────────────
    { id: 'dossier',              ...CURRENCY_FLAVOR['dossier'],               requiredCharacterId: 'thief'        },
    { id: 'treasure',             ...CURRENCY_FLAVOR['treasure'],              requiredCharacterId: 'thief',     manualUnlock: true },
    { id: 'relic',                ...CURRENCY_FLAVOR['relic'],                 requiredCharacterId: 'thief',     manualUnlock: true },
  ];

  private readonly stateSource = new BehaviorSubject<WalletState>(
    Object.fromEntries(this.currencies.map(c => [c.id, { amount: 0, perSecond: 0 }]))
  );

  /** Tracks the all-time peak XP ever reached, regardless of current XP. */
  private readonly highestXpEverSource = new BehaviorSubject<number>(0);
  readonly highestXpEver$ = this.highestXpEverSource.asObservable();
  get highestXpEver(): number { return this.highestXpEverSource.getValue(); }

  /** Tracks currencies whose `manualUnlock` gate has been opened. */
  private readonly manualUnlocksSource = new BehaviorSubject<Set<string>>(new Set<string>());
  readonly manualUnlocks$ = this.manualUnlocksSource.asObservable();

  /** Observable of the full wallet state. */
  readonly state$ = this.stateSource.asObservable();

  // ── UI State ──────────────────────────────────────────────────

  private readonly collapsedSource = new BehaviorSubject<boolean>(false);
  readonly collapsed$ = this.collapsedSource.asObservable();
  get collapsed(): boolean { return this.collapsedSource.getValue(); }
  setCollapsed(v: boolean): void { this.collapsedSource.next(v); }
  toggleCollapsed(): void { this.collapsedSource.next(!this.collapsedSource.getValue()); }

  private readonly characterFiltersSource = new BehaviorSubject<Set<string>>(new Set<string>());
  readonly characterFilters$ = this.characterFiltersSource.asObservable();
  get characterFilters(): Set<string> { return this.characterFiltersSource.getValue(); }
  setCharacterFilters(filters: Set<string>): void { this.characterFiltersSource.next(new Set(filters)); }

  // ── Public API ────────────────────────────────────────────────

  /** Add `amount` of `currencyId` to the wallet. */
  add(currencyId: string, amount: number): void {
    this._patch(currencyId, e => ({ ...e, amount: e.amount + amount }));
    if (currencyId === 'xp') this._syncHighestXp();
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
    if (currencyId === 'xp') this._syncHighestXp();
  }

  /**
   * Restore the all-time peak XP from a saved value.
   * Never lowers the current tracked peak.
   */
  setHighestXpEver(n: number): void {
    if (n > this.highestXpEverSource.getValue()) {
      this.highestXpEverSource.next(n);
    }
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

  /**
   * Returns true if the given currency's manual-unlock gate has already been opened.
   * Use this instead of local component flags so the check survives page reloads.
   */
  isCurrencyUnlocked(id: string): boolean {
    return this.manualUnlocksSource.getValue().has(id);
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

  /** Update the all-time XP peak if the current XP balance is higher. */
  private _syncHighestXp(): void {
    const current = this.get('xp');
    if (current > this.highestXpEverSource.getValue()) {
      this.highestXpEverSource.next(current);
    }
  }
}

