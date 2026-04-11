import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { StatisticsService, StatisticsSnapshot } from './statistics.service';
import { CharacterService } from '../character/character.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { WalletService } from '../wallet/wallet.service';
import { CURRENCY_FLAVOR, CHARACTER_FLAVOR } from '../flavor-text';
import { fmtNumber } from '../utils/mathUtils';

/** px width of the character sidebar in each state */
const SIDEBAR_EXPANDED  = 220;
const SIDEBAR_COLLAPSED =  46;
const SIDEBAR_GAP = 4;
/** Options button approximate width + gap buffer */
const OPTIONS_BTN_WIDTH = 135;

const LOG_EXPANDED  = 210;
const LOG_MINIMIZED =  36;

@Component({
  selector: 'app-statistics',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './statistics.component.html',
  styleUrls: ['./statistics.component.scss'],
})
export class StatisticsComponent implements OnInit, OnDestroy {
  private stats       = inject(StatisticsService);
  private charService = inject(CharacterService);
  private logService  = inject(ActivityLogService);
  private wallet      = inject(WalletService);
  private sub         = new Subscription();

  isOpen = false;
  snap: StatisticsSnapshot = this.stats.current;

  /** Trigger button positioning (fixed, next to options) */
  rightOffset  = `${SIDEBAR_EXPANDED + SIDEBAR_GAP + OPTIONS_BTN_WIDTH}px`;
  bottomOffset = `${LOG_EXPANDED}px`;

  readonly currencyFlavor  = CURRENCY_FLAVOR;
  readonly characterFlavor = CHARACTER_FLAVOR;

  /** Currency IDs in the same order as the wallet panel. */
  readonly currencyIds: string[] = this.wallet.currencies.map(c => c.id);

  readonly characterIds = ['fighter', 'ranger', 'apothecary', 'culinarian', 'thief', 'artisan', 'necromancer', 'merchant', 'artificer', 'chimeramancer'];
  readonly characterNames: Record<string, string> = {
    fighter: CHARACTER_FLAVOR.FIGHTER.name,
    ranger: CHARACTER_FLAVOR.RANGER.name,
    apothecary: CHARACTER_FLAVOR.APOTHECARY.name,
    culinarian: CHARACTER_FLAVOR.CULINARIAN.name,
    thief: CHARACTER_FLAVOR.THIEF.name,
    artisan: CHARACTER_FLAVOR.ARTISAN.name,
    necromancer: CHARACTER_FLAVOR.NECROMANCER.name,
    merchant: CHARACTER_FLAVOR.MERCHANT.name,
    artificer: CHARACTER_FLAVOR.ARTIFICER.name,
    chimeramancer: CHARACTER_FLAVOR.CHIMERAMANCER.name,
  };

  ngOnInit(): void {
    this.sub.add(
      this.stats.stats$.subscribe(s => this.snap = s)
    );
    this.sub.add(
      this.charService.sidebarCollapsed$.subscribe(collapsed => {
        const sidebarWidth = collapsed ? SIDEBAR_COLLAPSED : SIDEBAR_EXPANDED;
        this.rightOffset = `${sidebarWidth + SIDEBAR_GAP + OPTIONS_BTN_WIDTH}px`;
      })
    );
    this.sub.add(
      this.logService.minimized$.subscribe(minimized => {
        this.bottomOffset = minimized ? `${LOG_MINIMIZED}px` : `${LOG_EXPANDED}px`;
      })
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  open(): void  { this.isOpen = true; }
  close(): void { this.isOpen = false; }

  /** Close when clicking the backdrop (not the modal body). */
  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('stats-backdrop')) {
      this.close();
    }
  }

  fmt(n: number): string { return fmtNumber(n); }

  // ── Lifetime currency helpers ──────────────

  lifetimeAmount(id: string): number {
    return this.snap.lifetimeCurrency[id] ?? 0;
  }

  currencyName(id: string): string {
    return (CURRENCY_FLAVOR as any)[id]?.name ?? id;
  }

  currencySymbol(id: string): string {
    return (CURRENCY_FLAVOR as any)[id]?.symbol ?? '?';
  }

  currencyColor(id: string): string {
    return (CURRENCY_FLAVOR as any)[id]?.color ?? '#ccc';
  }

  get activeCurrencies(): string[] {
    return this.currencyIds.filter(id => (this.snap.lifetimeCurrency[id] ?? 0) > 0);
  }

  // ── Milestones ─────────────────────────────

  get milestoneEntries(): { key: string; label: string; time: string }[] {
    const entries: { key: string; label: string; time: string }[] = [];
    for (const [key, m] of Object.entries(this.snap.milestones)) {
      if (m.timestamp != null) {
        entries.push({ key, label: m.label, time: this.formatTimestamp(m.timestamp) });
      }
    }
    entries.sort((a, b) => {
      const ta = this.snap.milestones[a.key]?.timestamp ?? 0;
      const tb = this.snap.milestones[b.key]?.timestamp ?? 0;
      return ta - tb;
    });
    return entries;
  }

  private formatTimestamp(ms: number): string {
    const d = new Date(ms);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  // ── Hero presses (split manual / jack) ─────

  get activeHeroPressChars(): { charId: string; name: string; manual: number; jack: number }[] {
    return this.characterIds
      .filter(id => {
        const m = this.snap.manualHeroPresses[id] ?? 0;
        const j = this.snap.jackHeroPresses[id] ?? 0;
        return (m + j) > 0;
      })
      .map(id => ({
        charId: id,
        name: this.characterNames[id] ?? id,
        manual: this.snap.manualHeroPresses[id] ?? 0,
        jack:   this.snap.jackHeroPresses[id] ?? 0,
      }));
  }

  get totalManualPresses(): number {
    return Object.values(this.snap.manualHeroPresses).reduce((s, n) => s + n, 0);
  }

  get totalJackPresses(): number {
    return Object.values(this.snap.jackHeroPresses).reduce((s, n) => s + n, 0);
  }

  get hasAnyPresses(): boolean {
    return (this.totalManualPresses + this.totalJackPresses) > 0;
  }

  // ── Fighter minigame ───────────────────────

  get koboldKillEntries(): { name: string; count: number }[] {
    return Object.entries(this.snap.fighterMinigame.killsByType)
      .filter(([, c]) => c > 0)
      .map(([name, count]) => ({ name, count }));
  }

  // ── Culinarian guess distribution ──────────

  get guessDist(): { guess: number; count: number }[] {
    return this.snap.culinarianMinigame.guessDist
      .map((count, i) => ({ guess: i + 1, count }))
      .filter(e => e.count > 0);
  }

  // ── Minigame visibility helpers ────────────

  get hasAnyMinigameStats(): boolean {
    return this.snap.fighterMinigame.totalKills > 0
      || this.snap.fighterMinigame.potionsDrank > 0
      || this.snap.fighterMinigame.timesDefeated > 0
      || (this.snap.rangerMinigame.successful + this.snap.rangerMinigame.unsuccessful) > 0
      || this.snap.apothecaryMinigame.minigamesComplete > 0
      || (this.snap.apothecaryMinigame.potionHits + this.snap.apothecaryMinigame.potionMisses) > 0
      || (this.snap.apothecaryMinigame.dilutionSuccesses + this.snap.apothecaryMinigame.dilutionFailures) > 0
      || (this.snap.culinarianMinigame.wins + this.snap.culinarianMinigame.losses) > 0
      || (this.snap.thiefMinigame.successfulHeists + this.snap.thiefMinigame.failedHeists) > 0
      || this.snap.artisanMinigame.appraisalsCompleted > 0
      || this.snap.necromancerMinigame.ritualsCompleted > 0
      || (this.snap.merchantMinigame?.itemsPurchased ?? 0) > 0;
  }

  // ── Playtime ──────────────────────────────

  get playtimeFormatted(): string {
    const total = this.snap.playtimeSeconds ?? 0;
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }

  get hasNoStats(): boolean {
    return this.activeCurrencies.length === 0
      && this.milestoneEntries.length === 0
      && !this.hasAnyPresses
      && !this.hasAnyMinigameStats
      && (this.snap.playtimeSeconds ?? 0) === 0;
  }
}
