import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { WalletService, Currency, CurrencyEntry, WalletState } from './wallet.service';
import { CharacterService, Character } from '../character/character.service';
import { XP_THRESHOLDS } from '../game-config';
import { fmtNumber } from '../utils/mathUtils';

@Component({
  selector: 'app-wallet-sidebar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './wallet-sidebar.component.html',
  styleUrl: './wallet-sidebar.component.scss',
})
export class WalletSidebarComponent implements OnInit, OnDestroy {
  private walletService    = inject(WalletService);
  private characterService = inject(CharacterService);
  private sub = new Subscription();

  allCurrencies: Currency[]  = [];
  unlockedCharacters: Character[] = [];
  state: WalletState = {};
  collapsed = false;
  manualUnlockIds = new Set<string>();

  /** Empty = show all. Keys are character IDs or the sentinel 'global'. */
  activeCharacterFilters = new Set<string>();

  private static readonly EMPTY: CurrencyEntry = { amount: 0, perSecond: 0 };

  // ── Derived ───────────────────────────────

  /** Currencies whose gating character (if any) is unlocked, and whose manual-unlock gate (if any) has been opened. */
  get visibleCurrencies(): Currency[] {
    const unlockedIds = new Set(this.unlockedCharacters.map(c => c.id));
    return this.allCurrencies.filter(c => {
      if (c.requiredCharacterId && !unlockedIds.has(c.requiredCharacterId)) return false;
      if (c.manualUnlock && !this.manualUnlockIds.has(c.id)) return false;
      return true;
    });
  }

  /** Currency IDs always floated to the top of the list when visible. */
  private static readonly PINNED_IDS = ['gold', 'xp'];

  /** visibleCurrencies further narrowed by the active character filters. */
  get filteredCurrencies(): Currency[] {
    if (this.activeCharacterFilters.size === 0) return this.visibleCurrencies;
    return this.visibleCurrencies.filter(c =>
      this.activeCharacterFilters.has(c.requiredCharacterId ?? 'global')
    );
  }

  /** Pinned currencies (gold, xp) from the filtered set — rendered above the scroll area. */
  get pinnedCurrencies(): Currency[] {
    return this.filteredCurrencies.filter(c => WalletSidebarComponent.PINNED_IDS.includes(c.id));
  }

  /** All other filtered currencies — rendered in the scrollable area below. */
  get scrollableCurrencies(): Currency[] {
    return this.filteredCurrencies.filter(c => !WalletSidebarComponent.PINNED_IDS.includes(c.id));
  }

  /** Filter button descriptors, built from whatever is currently visible. */
  get characterFilters(): { key: string; label: string; color: string }[] {
    const result: { key: string; label: string; color: string }[] = [];
    if (this.visibleCurrencies.some(c => !c.requiredCharacterId)) {
      result.push({ key: 'global', label: 'GLOBAL', color: '#888' });
    }
    for (const char of this.unlockedCharacters) {
      if (this.visibleCurrencies.some(c => c.requiredCharacterId === char.id)) {
        result.push({ key: char.id, label: char.name.toUpperCase(), color: char.color });
      }
    }
    return result;
  }

  get allFiltersActive(): boolean {
    return this.activeCharacterFilters.size === 0;
  }

  /** 0–100 percentage progress toward the next XP unlock threshold. */
  get xpProgressPct(): number {
    const xp = Math.floor(this.state['xp']?.amount ?? 0);
    const thresholds = Object.values(XP_THRESHOLDS).sort((a, b) => a - b);

    let prev = 0;
    for (const t of thresholds) {
      if (xp < t) return Math.min(100, ((xp - prev) / (t - prev)) * 100);
      prev = t;
    }
    return 100;
  }

  /** True once all XP unlock thresholds have been reached. */
  get xpComplete(): boolean {
    return this.xpProgressPct === 100;
  }

  // ── Lifecycle ─────────────────────────────

  ngOnInit(): void {
    this.allCurrencies = this.walletService.currencies;
    this.sub.add(this.walletService.state$.subscribe(s => (this.state = s)));
    this.sub.add(
      this.characterService.characters$.subscribe(chars => {
        this.unlockedCharacters = chars.filter(c => c.unlocked);
      })
    );
    this.sub.add(
      this.walletService.manualUnlocks$.subscribe(ids => {
        this.manualUnlockIds = ids;
      })
    );
    this.sub.add(this.walletService.collapsed$.subscribe(v => (this.collapsed = v)));
    this.sub.add(this.walletService.characterFilters$.subscribe(f => (this.activeCharacterFilters = f)));
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  // ── Actions ───────────────────────────────

  toggle(): void {
    this.walletService.toggleCollapsed();
  }

  toggleCharacterFilter(key: string): void {
    const next = new Set(this.activeCharacterFilters);
    if (next.has(key)) { next.delete(key); } else { next.add(key); }
    this.walletService.setCharacterFilters(next);
  }

  clearCharacterFilters(): void {
    this.walletService.setCharacterFilters(new Set());
  }

  // ── Helpers ───────────────────────────────

  /** Safe accessor — never returns undefined. */
  getEntry(currencyId: string): CurrencyEntry {
    return this.state[currencyId] ?? WalletSidebarComponent.EMPTY;
  }

  /** Format large numbers into compact shorthand (e.g. 12400 → 12.4k). */
  fmtNumber = fmtNumber;

  /**
   * Format a per-second rate for display using fmtNumber rules for large values.
   * - 0             → '--/s'
   * - |rate| < 1000 → '+N/s' or '+N.XX/s' (2 dp, trailing zeros stripped)
   * - |rate| ≥ 1000 → '+1.2k/s' / '+3.4M/s' etc. via fmtNumber compact notation
   */
  fmtRate(rate: number): string {
    if (rate === 0) return '--/s';
    const sign = rate > 0 ? '+' : '-';
    const abs  = Math.abs(rate);
    let display: string;
    if (abs >= 1_000) {
      display = fmtNumber(abs);
    } else {
      display = Number.isInteger(abs)
        ? abs.toString()
        : abs.toFixed(2).replace(/\.?0+$/, '');
    }
    return `${sign}${display}/s`;
  }
}
