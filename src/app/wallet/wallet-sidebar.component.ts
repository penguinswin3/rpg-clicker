import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { WalletService, Currency, CurrencyEntry, WalletState } from './wallet.service';
import { CharacterService, Character } from '../character/character.service';
import { XP_THRESHOLDS } from '../game-config';

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

  /** visibleCurrencies further narrowed by the active character filters. */
  get filteredCurrencies(): Currency[] {
    if (this.activeCharacterFilters.size === 0) return this.visibleCurrencies;
    return this.visibleCurrencies.filter(c =>
      this.activeCharacterFilters.has(c.requiredCharacterId ?? 'global')
    );
  }

  /** Filter button descriptors, built from whatever is currently visible. */
  get characterFilters(): { key: string; label: string; color: string }[] {
    const result: { key: string; label: string; color: string }[] = [];
    if (this.visibleCurrencies.some(c => !c.requiredCharacterId)) {
      result.push({ key: 'global', label: 'BASE', color: '#aaa' });
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
    const thresholds = [
      XP_THRESHOLDS.RANGER_UNLOCK,
      XP_THRESHOLDS.APOTHECARY_UNLOCK,
      XP_THRESHOLDS.JACKS_UNLOCK,
      XP_THRESHOLDS.MINIGAME_UNLOCK,
    ];
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
  fmt(amount: number): string {
    const n = Math.floor(amount);
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'k';
    return n.toString();
  }

  /**
   * Format a per-second rate for display.
   * - 0        → '--/s'
   * - integer  → '+N/s'  (or '-N/s' for negative)
   * - fraction → '+N.XX/s' (2 decimal places, trailing zeros stripped)
   */
  fmtRate(rate: number): string {
    if (rate === 0) return '--/s';
    const sign    = rate > 0 ? '+' : '';
    const display = Number.isInteger(rate)
      ? rate.toString()
      : rate.toFixed(2).replace(/\.?0+$/, '');   // strip trailing zeros after rounding
    return `${sign}${display}/s`;
  }
}
