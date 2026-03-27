import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { ActivityLogComponent } from './activity-log/activity-log.component';
import { ActivityLogService } from './activity-log/activity-log.service';
import { WalletSidebarComponent } from './wallet/wallet-sidebar.component';
import { WalletService } from './wallet/wallet.service';
import { CharacterSidebarComponent } from './character/character-sidebar.component';
import { CharacterUnlockComponent } from './character/character-unlock.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    ActivityLogComponent,
    WalletSidebarComponent,
    CharacterSidebarComponent,
    CharacterUnlockComponent,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'RPG Clicker';

  // Synced from wallet state
  gold = 0;

  // Game-mechanic fields (not wallet state)
  goldPerClick = 1;
  clickUpgradeCost = 10;
  clickUpgradeLevel = 0;

  autoGoldPerSecond = 0;
  autoUpgradeCost = 25;
  autoUpgradeLevel = 0;

  private log = inject(ActivityLogService);
  private wallet = inject(WalletService);

  constructor() {
    // Keep local gold in sync with wallet for template bindings
    this.wallet.state$.subscribe(state => {
      this.gold = Math.floor(state['gold']?.amount ?? 0);
    });

    setInterval(() => {
      if (this.autoGoldPerSecond > 0) {
        this.wallet.add('gold', this.autoGoldPerSecond);
      }
    }, 1000);
  }

  clickHero(): void {
    this.wallet.add('gold', this.goldPerClick);
    this.wallet.add('xp', 1);
    this.log.log(`You ventured forth and found ${this.goldPerClick} gold.`);
  }

  buyClickUpgrade(): void {
    if (this.wallet.canAfford('gold', this.clickUpgradeCost)) {
      this.wallet.remove('gold', this.clickUpgradeCost);
      this.clickUpgradeLevel++;
      this.goldPerClick++;
      this.clickUpgradeCost = Math.floor(this.clickUpgradeCost * 1.5);
      this.log.log(
        `Sharper Sword upgraded to Lv.${this.clickUpgradeLevel}. Now earning ${this.goldPerClick}g per click.`,
        'success'
      );
    } else {
      this.log.log(
        `Not enough gold for Sharper Sword. Need ${this.clickUpgradeCost}g, have ${this.gold}g.`,
        'warn'
      );
    }
  }

  buyAutoUpgrade(): void {
    if (this.wallet.canAfford('gold', this.autoUpgradeCost)) {
      this.wallet.remove('gold', this.autoUpgradeCost);
      this.autoUpgradeLevel++;
      this.autoGoldPerSecond++;
      this.autoUpgradeCost = Math.floor(this.autoUpgradeCost * 1.5);
      this.wallet.setPerSecond('gold', this.autoGoldPerSecond);
      this.log.log(
        `Gold Mine upgraded to Lv.${this.autoUpgradeLevel}. Now earning ${this.autoGoldPerSecond}g/sec.`,
        'success'
      );
    } else {
      this.log.log(
        `Not enough gold for Gold Mine. Need ${this.autoUpgradeCost}g, have ${this.gold}g.`,
        'warn'
      );
    }
  }
}
