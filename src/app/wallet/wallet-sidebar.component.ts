import { Component, OnInit, OnDestroy, inject, ChangeDetectionStrategy, ChangeDetectorRef, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { WalletService, Currency, CurrencyEntry, WalletState, PerSecondBreakdown } from './wallet.service';
import { CharacterService, Character } from '../character/character.service';
import { XP_THRESHOLDS } from '../game-config';
import { fmtNumber } from '../utils/mathUtils';

@Component({
  selector: 'app-wallet-sidebar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './wallet-sidebar.component.html',
  styleUrl: './wallet-sidebar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WalletSidebarComponent implements OnInit, OnDestroy, OnChanges {
  private walletService    = inject(WalletService);
  private characterService = inject(CharacterService);
  private cdr              = inject(ChangeDetectorRef);
  private sub = new Subscription();

  /** When true, only show the ichor currency. */
  @Input() slayerMode = false;

  allCurrencies: Currency[]  = [];
  unlockedCharacters: Character[] = [];
  state: WalletState = {};
  collapsed = false;
  manualUnlockIds = new Set<string>();
  /** All-time peak XP, used for progress bar and threshold checks. */
  highestXpEver = 0;
  /** Per-currency, per-source breakdown of per-second contributions (for tooltips). */
  breakdown: PerSecondBreakdown = {};
  /** Currency ID currently hovered (shows tooltip). null = none. */
  hoveredCurrencyId: string | null = null;

  /** Empty = show all. Keys are character IDs or the sentinel 'global'. */
  activeCharacterFilters = new Set<string>();

  private static readonly EMPTY: CurrencyEntry = { amount: 0, perSecond: 0 };

  // ── Pre-computed derived state (updated on subscription callbacks) ──

  /** Currencies whose gating character (if any) is unlocked, and whose manual-unlock gate (if any) has been opened. */
  visibleCurrencies: Currency[] = [];

  /** Currency IDs always floated to the top of the list when visible. */
  private static readonly PINNED_IDS = ['gold', 'xp'];

  /** visibleCurrencies further narrowed by the active character filters. */
  filteredCurrencies: Currency[] = [];

  /** Pinned currencies (gold, xp) from the filtered set — rendered above the scroll area. */
  pinnedCurrencies: Currency[] = [];

  /** All other filtered currencies — rendered in the scrollable area below. */
  scrollableCurrencies: Currency[] = [];

  /** Filter button descriptors, built from whatever is currently visible. */
  characterFilters: { key: string; label: string; color: string }[] = [];

  /** 0–100 percentage progress toward the next XP unlock threshold (based on all-time peak XP). */
  xpProgressPct = 0;

  /** True once all XP unlock thresholds have been reached. */
  xpComplete = false;

  get allFiltersActive(): boolean {
    return this.activeCharacterFilters.size === 0;
  }

  /** Recompute all derived state from current inputs. Called from subscription callbacks. */
  private _recalc(): void {
    // In Slayer mode, only show ichor
    if (this.slayerMode) {
      this.visibleCurrencies = this.allCurrencies.filter(c => c.id === 'ichor');
      this.filteredCurrencies = this.visibleCurrencies;
      this.pinnedCurrencies = [];
      this.scrollableCurrencies = this.visibleCurrencies;
      this.characterFilters = [];
      this.xpProgressPct = 100;
      this.xpComplete = true;
      return;
    }

    // visibleCurrencies
    const unlockedIds = new Set(this.unlockedCharacters.map(c => c.id));
    this.visibleCurrencies = this.allCurrencies.filter(c => {
      if (c.requiredCharacterId && !unlockedIds.has(c.requiredCharacterId)) return false;
      if (c.manualUnlock && !this.manualUnlockIds.has(c.id)) return false;
      return true;
    });

    // filteredCurrencies
    if (this.activeCharacterFilters.size === 0) {
      this.filteredCurrencies = this.visibleCurrencies;
    } else {
      this.filteredCurrencies = this.visibleCurrencies.filter(c =>
        this.activeCharacterFilters.has(c.requiredCharacterId ?? 'global')
      );
    }

    // pinned / scrollable
    this.pinnedCurrencies = this.filteredCurrencies.filter(c => WalletSidebarComponent.PINNED_IDS.includes(c.id));
    this.scrollableCurrencies = this.filteredCurrencies.filter(c => !WalletSidebarComponent.PINNED_IDS.includes(c.id));

    // characterFilters
    const filters: { key: string; label: string; color: string }[] = [];
    if (this.visibleCurrencies.some(c => !c.requiredCharacterId)) {
      filters.push({ key: 'global', label: 'GLOBAL', color: '#888' });
    }
    for (const char of this.unlockedCharacters) {
      if (this.visibleCurrencies.some(c => c.requiredCharacterId === char.id)) {
        filters.push({ key: char.id, label: char.name.toUpperCase(), color: char.color });
      }
    }
    this.characterFilters = filters;

    // XP progress
    const xp = this.highestXpEver;
    const thresholds = Object.values(XP_THRESHOLDS).sort((a, b) => a - b);
    let pct = 100;
    let prev = 0;
    for (const t of thresholds) {
      if (xp < t) { pct = Math.min(100, ((xp - prev) / (t - prev)) * 100); break; }
      prev = t;
    }
    this.xpProgressPct = pct;
    this.xpComplete = pct === 100;
  }

  // ── Lifecycle ─────────────────────────────

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['slayerMode']) {
      this._recalc();
      this.cdr.markForCheck();
    }
  }

  ngOnInit(): void {
    this.allCurrencies = this.walletService.currencies;
    this.sub.add(this.walletService.state$.subscribe(s => {
      this.state = s;
      // No _recalc needed — state changes don't affect currency visibility lists
      this.cdr.markForCheck();
    }));
    this.sub.add(this.walletService.highestXpEver$.subscribe(v => {
      this.highestXpEver = v;
      this._recalc();
      this.cdr.markForCheck();
    }));
    this.sub.add(
      this.characterService.characters$.subscribe(chars => {
        this.unlockedCharacters = chars.filter(c => c.unlocked);
        this._recalc();
        this.cdr.markForCheck();
      })
    );
    this.sub.add(
      this.walletService.manualUnlocks$.subscribe(ids => {
        this.manualUnlockIds = ids;
        this._recalc();
        this.cdr.markForCheck();
      })
    );
    this.sub.add(this.walletService.collapsed$.subscribe(v => { this.collapsed = v; this.cdr.markForCheck(); }));
    this.sub.add(this.walletService.characterFilters$.subscribe(f => {
      this.activeCharacterFilters = f;
      this._recalc();
      this.cdr.markForCheck();
    }));
    this.sub.add(this.walletService.perSecondBreakdown$.subscribe(b => { this.breakdown = b; this.cdr.markForCheck(); }));
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

  /** If All is already active, enable every individual character filter and disable All.
   *  Otherwise, clear individual filters to re-enable All. */
  toggleAllCharacterFilters(): void {
    if (this.allFiltersActive) {
      this.walletService.setCharacterFilters(new Set(this.characterFilters.map(f => f.key)));
    } else {
      this.walletService.setCharacterFilters(new Set());
    }
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

  // ── Tooltip (per-second breakdown) ────────

  /** Returns breakdown entries for a currency, sorted by absolute magnitude. */
  getBreakdownEntries(currencyId: string): { source: string; rate: number; color: string }[] {
    const sources = this.breakdown[currencyId];
    if (!sources) return [];
    return Object.entries(sources)
      .filter(([, v]) => v !== 0)
      .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
      .map(([source, rate]) => ({
        source,
        rate,
        color: this.getSourceColor(source),
      }));
  }

  /** Whether a tooltip should be shown for the given currency. */
  hasBreakdown(currencyId: string): boolean {
    const sources = this.breakdown[currencyId];
    return !!sources && Object.keys(sources).length > 0;
  }

  showTooltip(currencyId: string, event: MouseEvent): void {
    this.hoveredCurrencyId = currencyId;

    // Compute fixed-position placement so the tooltip isn't clipped by
    // the sidebar's overflow:hidden or the viewport edge.
    const el = event.currentTarget as HTMLElement;
    const rect = el.getBoundingClientRect();

    // Estimated tooltip size (min-width 120, typical height ~100)
    const tooltipW = 160;
    const tooltipH = 120;
    const pad = 4;

    // Default: below the element, right-aligned with it
    let top = rect.bottom + pad;
    let left = rect.right - tooltipW;

    // Flip above if it would overflow the bottom
    if (top + tooltipH > window.innerHeight) {
      top = rect.top - tooltipH - pad;
    }

    // Push right if it would overflow the left edge
    if (left < 0) {
      left = rect.left;
    }

    // Push left if it would overflow the right edge
    if (left + tooltipW > window.innerWidth) {
      left = window.innerWidth - tooltipW - pad;
    }

    this.tooltipStyle = {
      top: `${top}px`,
      left: `${left}px`,
    };
  }

  /** Computed fixed-position style for the tooltip. */
  tooltipStyle: { top: string; left: string } = { top: '0', left: '0' };

  hideTooltip(): void {
    this.hoveredCurrencyId = null;
  }

  /** Resolve a source label to the matching character color, or a neutral grey for "Passive". */
  private getSourceColor(source: string): string {
    if (source === 'Passive') return '#888';
    const lower = source.toLowerCase();
    // Try to find a character whose name appears anywhere in the source label
    // (handles "Familiar (Fighter)", "Necromancer (Defile)", etc.)
    const char = this.unlockedCharacters.find(
      c => lower.includes(c.name.toLowerCase())
    );
    if (char) return char.color;
    // Necromancer sub-sources that don't include "Necromancer" in the label
    if (['defile', 'ward', 'exhume'].some(k => lower.includes(k))) {
      const necro = this.unlockedCharacters.find(c => c.id === 'necromancer');
      if (necro) return necro.color;
    }
    // Apothecary sub-sources
    if (['fermentation'].some(k => lower.includes(k))) {
      const apoth = this.unlockedCharacters.find(c => c.id === 'apothecary');
      if (apoth) return apoth.color;
    }
    return '#aaa';
  }
}
