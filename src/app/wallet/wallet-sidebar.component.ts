import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { WalletService, Currency, CurrencyEntry, WalletState } from './wallet.service';

@Component({
  selector: 'app-wallet-sidebar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './wallet-sidebar.component.html',
  styleUrl: './wallet-sidebar.component.scss',
})
export class WalletSidebarComponent implements OnInit, OnDestroy {
  private walletService = inject(WalletService);
  private sub!: Subscription;

  currencies: Currency[] = [];
  state: WalletState = {};
  collapsed = false;

  private static readonly EMPTY: CurrencyEntry = { amount: 0, perSecond: 0 };

  ngOnInit(): void {
    this.currencies = this.walletService.currencies;
    this.sub = this.walletService.state$.subscribe(s => (this.state = s));
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  toggle(): void {
    this.collapsed = !this.collapsed;
  }

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
}


