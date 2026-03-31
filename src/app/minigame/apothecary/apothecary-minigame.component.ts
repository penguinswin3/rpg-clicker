import { Component, Input, OnInit, OnDestroy, NgZone, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { WalletService } from '../../wallet/wallet.service';
import { ActivityLogService } from '../../activity-log/activity-log.service';
import { APOTH_MG } from '../../game-config';
import { CURRENCY_FLAVOR } from '../../flavor-text';
import { toPct } from '../../utils/mathUtils';

@Component({
  selector: 'app-apothecary-minigame',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './apothecary-minigame.component.html',
  styleUrls: ['./apothecary-minigame.component.scss'],
})
export class ApothecaryMinigameComponent implements OnInit, OnDestroy {
  private wallet = inject(WalletService);
  private log    = inject(ActivityLogService);
  private zone   = inject(NgZone);
  private sub    = new Subscription();
  private animFrame?: number;
  private lastTime?: number;

  /** Set to true when the Bubbling Brew upgrade has been purchased. */
  @Input() bubblingBrewUnlocked = false;

  // ── Wallet-synced ─────────────────────────
  herbs   = 0;
  potions = 0;

  // ── Potion state ──────────────────────────
  potionActive      = false;
  quality           = 0;
  readonly maxQuality     = APOTH_MG.MAX_QUALITY;
  readonly herbCost       = APOTH_MG.HERB_COST;
  readonly potionCost     = APOTH_MG.POTION_COST;
  readonly currencyFlavor = CURRENCY_FLAVOR;

  // ── Beat bar ──────────────────────────────
  /** Cursor position: 0 – 100 */
  barPos = 0;
  /** Movement direction: 1 = right, -1 = left */
  barDir = 1;
  readonly barSpeed     = APOTH_MG.BAR_SPEED;
  readonly zoneMin      = APOTH_MG.ZONE_MIN;
  readonly zoneMax      = APOTH_MG.ZONE_MAX;
  readonly innerZoneMin = APOTH_MG.INNER_ZONE_MIN;
  readonly innerZoneMax = APOTH_MG.INNER_ZONE_MAX;

  // ── Messages ──────────────────────────────
  lastMsg  = '';
  msgClass = 'msg-neutral';

  // ── Computed ──────────────────────────────

  get qualityBar(): string {
    return '█'.repeat(this.quality) + '░'.repeat(this.maxQuality - this.quality);
  }

  get qualityPct(): number {
    return toPct(this.quality, this.maxQuality);
  }

  get isInZone(): boolean {
    return this.barPos >= this.zoneMin && this.barPos <= this.zoneMax;
  }

  get isInInnerZone(): boolean {
    return this.bubblingBrewUnlocked &&
      this.barPos >= this.innerZoneMin && this.barPos <= this.innerZoneMax;
  }

  get canStart(): boolean {
    return !this.potionActive && this.herbs >= this.herbCost && this.potions >= this.potionCost;
  }

  // ── Lifecycle ─────────────────────────────

  ngOnInit(): void {
    this.sub.add(
      this.wallet.state$.subscribe(s => {
        this.herbs   = Math.floor(s['herb']?.amount   ?? 0);
        this.potions = Math.floor(s['potion']?.amount ?? 0);
      })
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
    this.stopAnimation();
  }

  // ── Actions ───────────────────────────────

  startPotion(): void {
    if (!this.canStart) return;
    this.wallet.remove('herb',   this.herbCost);
    this.wallet.remove('potion', this.potionCost);
    this.potionActive = true;
    this.quality      = 0;
    this.barPos       = 0;
    this.barDir       = 1;
    this.lastTime     = undefined;
    this.lastMsg      = 'Click on beat to raise quality!';
    this.msgClass     = 'msg-neutral';
    this.log.log(`Apothecary begins brewing. (−${this.herbCost} herbs, −${this.potionCost} potion base)`);
    this.startAnimation();
  }

  brew(): void {
    if (!this.potionActive) return;

    if (this.isInInnerZone) {
      this.quality  = Math.min(this.maxQuality, this.quality + 2);
      this.lastMsg  = `Bubbling hit! +2 quality (${this.quality}/${this.maxQuality})`;
      this.msgClass = 'msg-double';
      if (this.quality >= this.maxQuality) this.onPerfectPotion();
    } else if (this.isInZone) {
      this.quality  = Math.min(this.maxQuality, this.quality + 1);
      this.lastMsg  = `On beat! +1 quality (${this.quality}/${this.maxQuality})`;
      this.msgClass = 'msg-good';
      if (this.quality >= this.maxQuality) this.onPerfectPotion();
    } else {
      this.quality  = Math.max(0, this.quality - 1);
      this.lastMsg  = `Off beat! −1 quality (${this.quality}/${this.maxQuality})`;
      this.msgClass = 'msg-bad';
    }
  }

  // ── Private ───────────────────────────────

  private startAnimation(): void {
    // Run rAF outside Angular to avoid triggering CD every frame.
    // barPos is written here; we use markForCheck manually if we ever need it —
    // but the brew button click & startPotion already trigger CD at the moments
    // that matter.  The [style.left.%] binding updates via the next CD cycle
    // (triggered by the click event itself).  For a smooth visual cursor we
    // intentionally re-enter the zone each frame so Angular re-renders the bar.
    const loop = (timestamp: number) => {
      if (!this.potionActive) return;

      if (this.lastTime !== undefined) {
        const dt = timestamp - this.lastTime;
        this.barPos += this.barDir * this.barSpeed * dt;

        if (this.barPos >= 100) { this.barPos = 100; this.barDir = -1; }
        else if (this.barPos <= 0) { this.barPos = 0; this.barDir = 1; }
      }
      this.lastTime = timestamp;

      this.zone.run(() => {});           // tick Angular CD so [style.left.%] updates
      this.animFrame = requestAnimationFrame(loop);
    };

    this.zone.runOutsideAngular(() => {
      this.animFrame = requestAnimationFrame(loop);
    });
  }

  private stopAnimation(): void {
    if (this.animFrame !== undefined) {
      cancelAnimationFrame(this.animFrame);
      this.animFrame = undefined;
    }
  }

  private onPerfectPotion(): void {
    this.stopAnimation();
    this.potionActive = false;
    this.wallet.add('concentrated-potion', 1);

    if (!this.wallet.isCurrencyUnlocked('concentrated-potion')) {
      this.wallet.unlockCurrency('concentrated-potion');
      this.log.log('A Concentrated Potion has been crafted! New currency unlocked!', 'rare');
    } else {
      this.log.log('A Concentrated Potion has been crafted!', 'success');
    }

    this.lastMsg  = '** PERFECT POTION COMPLETE **';
    this.msgClass = 'msg-good';
  }
}

