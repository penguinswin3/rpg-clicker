import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'RPG Clicker';

  gold = 0;
  goldPerClick = 1;
  clickUpgradeCost = 10;
  clickUpgradeLevel = 0;

  autoGoldPerSecond = 0;
  autoUpgradeCost = 25;
  autoUpgradeLevel = 0;

  constructor() {
    setInterval(() => {
      this.gold += this.autoGoldPerSecond;
    }, 1000);
  }

  clickHero(): void {
    this.gold += this.goldPerClick;
  }

  buyClickUpgrade(): void {
    if (this.gold >= this.clickUpgradeCost) {
      this.gold -= this.clickUpgradeCost;
      this.clickUpgradeLevel++;
      this.goldPerClick++;
      this.clickUpgradeCost = Math.floor(this.clickUpgradeCost * 1.5);
    }
  }

  buyAutoUpgrade(): void {
    if (this.gold >= this.autoUpgradeCost) {
      this.gold -= this.autoUpgradeCost;
      this.autoUpgradeLevel++;
      this.autoGoldPerSecond++;
      this.autoUpgradeCost = Math.floor(this.autoUpgradeCost * 1.5);
    }
  }
}
