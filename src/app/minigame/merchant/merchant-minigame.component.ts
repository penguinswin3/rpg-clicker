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
import { MERCHANT_MG, BEADS } from '../../game-config';
import { CURRENCY_FLAVOR, MINIGAME_MSG, cur, LOG_MSG } from '../../flavor-text';
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
}

export interface AutoBuyer {
  enabled: boolean;
  targetCurrencyId: string | null;
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

  // ── State ───────────────────────────────────────────────────
  message = MINIGAME_MSG.MERCHANT.IDLE;
  items: StockMarketItem[] = [];
  readonly increments = MERCHANT_MG.STOCK_MARKET_INCREMENTS;
  manualClears = 0;

  /** Auto-buyers: index 0 = gold-1 bead, index 1 = gold-2 bead. */
  autoBuyers: AutoBuyer[] = [
    { enabled: false, targetCurrencyId: null },
    { enabled: false, targetCurrencyId: null },
  ];

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
      return {
        currencyId: entry.currencyId,
        name: flavor.name,
        symbol: flavor.symbol,
        color: flavor.color,
        basePrice: entry.basePrice,
        minPrice: entry.minPrice,
        maxPrice: entry.maxPrice,
        currentPrice: entry.basePrice,
      };
    });
  }

  private rollPrices(): void {
    for (const item of this.items) {
      item.currentPrice = randInt(item.minPrice, item.maxPrice);
    }
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

  /** How many auto-buyers are available based on gold beads. */
  get maxAutoBuyers(): number {
    if (this.autoSolveGoodMode) return 2;
    if (this.autoSolveUnlocked) return 1;
    return 0;
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

  /** Whether a given auto-buyer is targeting a specific currency. */
  isAutoBuyTarget(buyerIndex: number, currencyId: string): boolean {
    const ab = this.autoBuyers[buyerIndex];
    return ab ? ab.enabled && ab.targetCurrencyId === currencyId : false;
  }

  /** Toggle an auto-buyer on/off for a specific item (radio behavior per buyer). */
  toggleAutoBuyItem(buyerIndex: number, currencyId: string): void {
    if (buyerIndex >= this.maxAutoBuyers) return;
    const ab = this.autoBuyers[buyerIndex];
    if (ab.enabled && ab.targetCurrencyId === currencyId) {
      // Uncheck — disable this buyer
      ab.enabled = false;
      ab.targetCurrencyId = null;
    } else {
      // Check — assign this buyer to this item
      ab.enabled = true;
      ab.targetCurrencyId = currencyId;
    }
    this.cdr.markForCheck();
  }


  private tickAutoBuyers(): void {
    for (let i = 0; i < this.maxAutoBuyers; i++) {
      const ab = this.autoBuyers[i];
      if (!ab.enabled || !ab.targetCurrencyId) continue;

      const item = this.items.find(it => it.currencyId === ab.targetCurrencyId);
      if (!item) continue;

      const qty = MERCHANT_MG.AUTO_BUY_AMOUNT;
      const totalCost = item.currentPrice * qty;
      if (!this.wallet.canAfford('gold', totalCost)) continue;

      this.wallet.remove('gold', totalCost);
      this.wallet.add(item.currencyId, qty);
      this.stats.trackCurrencyGain(item.currencyId, qty);
      this.checkRareUnlock(item.currencyId);
    }
    this.cdr.markForCheck();
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
  }

  getCurrencyName(id: string): string {
    return (CURRENCY_FLAVOR as Record<string, { name: string }>)[id]?.name ?? id;
  }

  get goodsBalance(): number {
    return Math.floor(this.wallet.get('illicit-goods'));
  }
}
