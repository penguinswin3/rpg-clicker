import {
  Component, OnInit, OnDestroy, inject, Input, Output, EventEmitter,
  ChangeDetectionStrategy, ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { WalletService } from '../../wallet/wallet.service';
import { ActivityLogService } from '../../activity-log/activity-log.service';
import { StatisticsService } from '../../statistics/statistics.service';
import { UpgradeService } from '../../upgrade/upgrade.service';
import { MERCHANT_MG, BEADS, GOLD2_CONDITIONS } from '../../game-config';
import { CURRENCY_FLAVOR, MINIGAME_MSG, cur, LOG_MSG, GOLD2_STEP_MESSAGES } from '../../flavor-text';
import { randInt } from '../../utils/mathUtils';

export interface StockMarketItem {
  currencyId: string;
  name: string;
  symbol: string;
  color: string;
  basePrice: number;
  minPrice: number;
  maxPrice: number;
  currentPrice: number;
  /** Portfolio tier — determines when this item becomes visible. */
  tier: number;
}

/** Info about an active auto-buyer — emitted so per-second rates can account for it. */
export interface AutoBuyerInfo {
  currencyId: string;
  goldCostPerTick: number;
  qtyPerTick: number;
}

@Component({
  selector: 'app-merchant-minigame',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './merchant-minigame.component.html',
  styleUrls: ['./merchant-minigame.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MerchantMinigameComponent implements OnInit, OnDestroy {
  private wallet   = inject(WalletService);
  private log      = inject(ActivityLogService);
  private stats    = inject(StatisticsService);
  private upgrades = inject(UpgradeService);
  private cdr      = inject(ChangeDetectorRef);
  private sub      = new Subscription();

  // ── Inputs from minigame panel ──────────────────────────────
  @Input() autoSolveUnlocked = false;
  @Input() autoSolveGoodMode = false;
  @Input() autoSolveEnabled  = false;
  @Output() autoSolveEnabledChange = new EventEmitter<boolean>();
  @Output() goldBeadFound = new EventEmitter<void>();
  @Input() gold2Progress: unknown = {};
  @Output() gold2ProgressChange = new EventEmitter<{ charId: string; progress: unknown }>();
  @Output() gold2BeadFound = new EventEmitter<string>();
  @Input() gold2BeadFoundState = false;
  @Input() gemHunterLevel = 0;

  /** Emitted whenever auto-buyer configuration or prices change. */
  @Output() autoBuyerStateChange = new EventEmitter<AutoBuyerInfo[]>();

  // ── State ───────────────────────────────────────────────────
  message = MINIGAME_MSG.MERCHANT.IDLE;
  items: StockMarketItem[] = [];
  readonly increments = MERCHANT_MG.STOCK_MARKET_INCREMENTS;
  manualClears = 0;

  /**
   * Auto-buyer selections: currencyId → enabled.
   * Gold-1 bead: only one entry can be true at a time.
   * Gold-2 bead (good mode): any number can be true simultaneously.
   */
  autoBuySelections: Record<string, boolean> = {};

  /** Persisted auto-buyer selections (set from outside via Input). */
  @Input() set savedAutoBuySelections(v: Record<string, boolean>) {
    if (v) this.autoBuySelections = { ...v };
  }
  @Output() autoBuySelectionsChange = new EventEmitter<Record<string, boolean>>();

  private priceTicker: ReturnType<typeof setInterval> | null = null;
  private autoBuyTimer: ReturnType<typeof setInterval> | null = null;

  // ── Lifecycle ───────────────────────────────────────────────

  ngOnInit(): void {
    this.initItems();
    this.rollPrices();
    this.startPriceTicker();
    this.startAutoBuyTimer();

    this.sub.add(
      this.wallet.state$.subscribe(() => this.cdr.markForCheck()),
    );
    this.sub.add(
      this.upgrades.changed$.subscribe(() => this.cdr.markForCheck()),
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
    if (this.priceTicker) clearInterval(this.priceTicker);
    if (this.autoBuyTimer) clearInterval(this.autoBuyTimer);
  }

  // ── Initialization ─────────────────────────────────────────

  private initItems(): void {
    this.items = MERCHANT_MG.STOCK_MARKET_TABLE.map(entry => {
      const flavor = (CURRENCY_FLAVOR as Record<string, { name: string; symbol: string; color: string }>)[entry.currencyId]
        ?? { name: entry.currencyId, symbol: '?', color: '#ccc' };
      const tier = (MERCHANT_MG.PORTFOLIO_TIER_MAP as Record<string, number>)[entry.currencyId] ?? 99;
      return {
        currencyId: entry.currencyId,
        name: flavor.name,
        symbol: flavor.symbol,
        color: flavor.color,
        basePrice: entry.basePrice,
        minPrice: entry.minPrice,
        maxPrice: entry.maxPrice,
        currentPrice: entry.basePrice,
        tier,
      };
    });
  }

  private rollPrices(): void {
    const stableLevel = this.upgrades.level('STABLE_MARKET');
    const stableReduction = 1 - stableLevel * MERCHANT_MG.STABLE_MARKET_REDUCTION_PER_LEVEL;
    const riggedLevel = this.upgrades.level('RIGGED_GAME');
    const discount = 1 - riggedLevel * MERCHANT_MG.RIGGED_GAME_DISCOUNT_PER_LEVEL;

    for (const item of this.items) {
      // Stable Market reduces the max price
      const effectiveMaxPrice = Math.max(item.minPrice, Math.floor(item.maxPrice * stableReduction));
      item.currentPrice = randInt(item.minPrice, effectiveMaxPrice);
      // Rigged Game reduces the effective price
      item.currentPrice = Math.max(1, Math.floor(item.currentPrice * discount));
    }
    this.emitAutoBuyerState();
    this.cdr.markForCheck();
  }

  private startPriceTicker(): void {
    this.priceTicker = setInterval(() => {
      this.rollPrices();
    }, MERCHANT_MG.STOCK_MARKET_TICK_MS);
  }

  private startAutoBuyTimer(): void {
    this.autoBuyTimer = setInterval(() => {
      this.tickAutoBuyers();
    }, MERCHANT_MG.AUTO_BUY_INTERVAL_MS);
  }

  // ── Public API ──────────────────────────────────────────────

  get goldBalance(): number {
    return Math.floor(this.wallet.get('gold'));
  }

  /**
   * Total gold drained per second by all active auto-buyers.
   * Each buyer fires once per AUTO_BUY_INTERVAL_MS (1 s), spending
   * currentPrice × AUTO_BUY_AMOUNT gold per tick.
   */
  get goldSpendPerSec(): number {
    const ticksPerSec = 1000 / MERCHANT_MG.AUTO_BUY_INTERVAL_MS;
    let total = 0;
    for (const [currencyId, enabled] of Object.entries(this.autoBuySelections)) {
      if (!enabled) continue;
      const item = this.items.find(it => it.currencyId === currencyId);
      if (!item) continue;
      total += item.currentPrice * MERCHANT_MG.AUTO_BUY_AMOUNT * ticksPerSec;
    }
    return total;
  }

  /** Items visible based on Diversified Portfolio level. */
  get visibleItems(): StockMarketItem[] {
    const portfolioLevel = this.upgrades.level('DIVERSIFIED_PORTFOLIO');
    return this.items.filter(item => item.tier <= portfolioLevel);
  }

  /** How many auto-buyers are available based on gold beads. */
  get maxAutoBuyers(): number {
    if (this.autoSolveGoodMode) return Infinity;
    if (this.autoSolveUnlocked) return 1;
    return 0;
  }

  /** Whether unlimited auto-buyers are active (both gold beads). */
  get unlimitedAutoBuyers(): boolean {
    return this.autoSolveGoodMode;
  }

  /** Count of currently active auto-buyers. */
  get activeAutoBuyerCount(): number {
    return Object.values(this.autoBuySelections).filter(Boolean).length;
  }

  buy(item: StockMarketItem, qty: number): void {
    const totalCost = item.currentPrice * qty;
    if (!this.wallet.canAfford('gold', totalCost)) {
      this.message = `Not enough gold! Need ${totalCost}g.`;
      this.cdr.markForCheck();
      return;
    }

    this.wallet.remove('gold', totalCost);
    this.wallet.add(item.currencyId, qty);
    this.stats.trackCurrencyGain(item.currencyId, qty);

    this.checkRareUnlock(item.currencyId);

    this.message = `Bought ${qty}× ${item.name} for ${totalCost}g`;
    this.manualClears++;

    // Gold-2: track purchase sequence
    if (!this.gold2BeadFoundState) {
      this.trackGold2Purchase(item.currencyId, qty);
    }

    // Gold bead chance
    if (this.manualClears >= BEADS.GOLD_BEAD_MIN_MANUAL_CLEARS) {
      if (Math.random() < BEADS.MINIGAME_GOLD_BEAD_CHANCE) {
        this.goldBeadFound.emit();
      }
    }

    this.cdr.markForCheck();
  }

  canAfford(item: StockMarketItem, qty: number): boolean {
    return this.wallet.canAfford('gold', item.currentPrice * qty);
  }

  /** Returns price color — green if below midpoint, red if above. */
  priceColor(item: StockMarketItem): string {
    const mid = (item.minPrice + item.maxPrice) / 2;
    if (item.currentPrice < mid * 0.8) return '#4caf50';
    if (item.currentPrice < mid) return '#7cb342';
    if (item.currentPrice > mid * 1.2) return '#f44336';
    if (item.currentPrice > mid) return '#ff9800';
    return '#e0d8c8';
  }

  // ── Auto-buyers ────────────────────────────────────────────

  /** Whether a given item is being auto-bought. */
  isAutoBuyTarget(currencyId: string): boolean {
    return !!this.autoBuySelections[currencyId];
  }

  /** Toggle auto-buy for an item. In single-buyer mode, selecting one deselects all others. */
  toggleAutoBuy(currencyId: string): void {
    if (this.maxAutoBuyers <= 0) return;

    if (this.unlimitedAutoBuyers) {
      // Unlimited mode: toggle independently
      this.autoBuySelections = {
        ...this.autoBuySelections,
        [currencyId]: !this.autoBuySelections[currencyId],
      };
    } else {
      // Single-buyer mode: radio behavior
      if (this.autoBuySelections[currencyId]) {
        // Uncheck — disable
        this.autoBuySelections = { ...this.autoBuySelections, [currencyId]: false };
      } else {
        // Check — disable all others, enable this one
        const newSelections: Record<string, boolean> = {};
        for (const key of Object.keys(this.autoBuySelections)) {
          newSelections[key] = false;
        }
        newSelections[currencyId] = true;
        this.autoBuySelections = newSelections;
      }
    }
    this.autoBuySelectionsChange.emit({ ...this.autoBuySelections });
    this.emitAutoBuyerState();
    this.cdr.markForCheck();
  }


  private tickAutoBuyers(): void {
    const qty = MERCHANT_MG.AUTO_BUY_AMOUNT;
    for (const [currencyId, enabled] of Object.entries(this.autoBuySelections)) {
      if (!enabled) continue;

      const item = this.items.find(it => it.currencyId === currencyId);
      if (!item) continue;

      const totalCost = item.currentPrice * qty;
      if (!this.wallet.canAfford('gold', totalCost)) continue;

      this.wallet.remove('gold', totalCost);
      this.wallet.add(item.currencyId, qty);
      this.stats.trackCurrencyGain(item.currencyId, qty);
      this.checkRareUnlock(item.currencyId);
    }
    this.cdr.markForCheck();
  }

  /** Emit the current auto-buyer info for per-second calculation. */
  private emitAutoBuyerState(): void {
    const infos: AutoBuyerInfo[] = [];
    const qty = MERCHANT_MG.AUTO_BUY_AMOUNT;
    for (const [currencyId, enabled] of Object.entries(this.autoBuySelections)) {
      if (!enabled) continue;
      const item = this.items.find(it => it.currencyId === currencyId);
      if (!item) continue;
      infos.push({
        currencyId,
        goldCostPerTick: item.currentPrice * qty,
        qtyPerTick: qty,
      });
    }
    this.autoBuyerStateChange.emit(infos);
  }

  // ── Gold-2 purchase sequence tracking ──────────────────────

  private trackGold2Purchase(currencyId: string, qty: number): void {
    const seq = GOLD2_CONDITIONS.MERCHANT_PURCHASE_SEQUENCE;
    const progress = (this.gold2Progress as { step?: number }) ?? {};
    let step = progress.step ?? 0;

    if (step >= seq.length) return; // already completed

    const expected = seq[step];
    if (currencyId === expected.currencyId && qty === expected.qty) {
      // Correct step
      step++;
      if (step >= seq.length) {
        // Sequence complete — award the bead!
        this.gold2BeadFound.emit('merchant');
        this.gold2ProgressChange.emit({ charId: 'merchant', progress: { step: 0 } });
      } else {
        if (this.gemHunterLevel >= 1 && !this.gold2BeadFoundState) {
          const msgs = GOLD2_STEP_MESSAGES['merchant'];
          this.log.log(msgs[(step - 1) % msgs.length], 'rare');
        }
        this.gold2ProgressChange.emit({ charId: 'merchant', progress: { step } });
      }
    } else {
      // Wrong purchase — reset sequence
      if (step > 0) {
        this.gold2ProgressChange.emit({ charId: 'merchant', progress: { step: 0 } });
      }
    }
  }

  // ── Helpers ────────────────────────────────────────────────

  private checkRareUnlock(currencyId: string): void {
    if (currencyId === 'monster-trophy' && !this.wallet.isCurrencyUnlocked('monster-trophy')) {
      this.wallet.unlockCurrency('monster-trophy');
      this.log.log(LOG_MSG.MG_MERCHANT.TROPHY_UNLOCKED, 'rare');
    }
    if (currencyId === 'forbidden-tome' && !this.wallet.isCurrencyUnlocked('forbidden-tome')) {
      this.wallet.unlockCurrency('forbidden-tome');
      this.log.log(LOG_MSG.MG_MERCHANT.TOME_UNLOCKED, 'rare');
    }
    if (currencyId === 'magical-implement' && !this.wallet.isCurrencyUnlocked('magical-implement')) {
      this.wallet.unlockCurrency('magical-implement');
      this.log.log(LOG_MSG.MG_MERCHANT.IMPLEMENT_UNLOCKED, 'rare');
    }
    // Kobold parts: unlock on first purchase via merchant if not already unlocked
    const koboldParts = ['kobold-ear', 'kobold-tongue', 'kobold-hair', 'kobold-fang', 'kobold-brain', 'kobold-feather', 'kobold-pebble', 'kobold-heart'];
    if (koboldParts.includes(currencyId) && !this.wallet.isCurrencyUnlocked(currencyId)) {
      this.wallet.unlockCurrency(currencyId);
    }
  }

  getCurrencyName(id: string): string {
    return (CURRENCY_FLAVOR as Record<string, { name: string }>)[id]?.name ?? id;
  }

  get goodsBalance(): number {
    return Math.floor(this.wallet.get('illicit-goods'));
  }
}
