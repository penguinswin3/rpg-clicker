/**
 * ════════════════════════════════════════════════════════════
 *   STATISTICS SERVICE
 *   Central tracking for all lifetime stats.
 *   All stats persist across saves and are never reset
 *   (except on save-clear / import).
 * ════════════════════════════════════════════════════════════
 */

import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

// ── Snapshot interfaces ────────────────────────────────────

export interface MilestoneEntry {
  /** Human-readable label (e.g. "Ranger Unlocked"). */
  label: string;
  /** Wall-clock timestamp (ms) when the milestone was first reached. null = not yet. */
  timestamp: number | null;
}

export interface FighterMinigameStats {
  /** Total kobolds killed across all types. */
  totalKills: number;
  /** Kills keyed by kobold variant name (e.g. "Kobold", "Snake Kobold"). */
  killsByType: Record<string, number>;
}

export interface RangerMinigameStats {
  /** Rounds where at least one prize was found. */
  successful: number;
  /** Rounds where nothing was found. */
  unsuccessful: number;
}

export interface ApothecaryMinigameStats {
  /** Total concentrated potions produced (before dilution doubling). */
  concentratedPotionsMade: number;
  /** Dilution rolls that succeeded (produced concentrated potion). */
  dilutionSuccesses: number;
  /** Dilution rolls that failed (downgraded to potion base). */
  dilutionFailures: number;
}

export interface CulinarianMinigameStats {
  wins: number;
  losses: number;
  /** Distribution of winning guess counts: index 0 = won on guess 1, index 1 = guess 2, etc. */
  guessDist: number[];
}

export interface ThiefMinigameStats {
  successfulHeists: number;
  failedHeists: number;
}

export interface StatisticsSnapshot {
  /** Lifetime totals of currency gained (only additions, never subtractions). */
  lifetimeCurrency: Record<string, number>;
  /** Milestone timestamps keyed by internal ID. */
  milestones: Record<string, MilestoneEntry>;
  /** Manual hero button presses per character. */
  manualHeroPresses: Record<string, number>;
  /** Jack auto-click presses per character. */
  jackHeroPresses: Record<string, number>;
  /** @deprecated Kept for backward-compatible save loading. */
  heroButtonPresses?: Record<string, number>;
  /** Fighter minigame kill stats. */
  fighterMinigame: FighterMinigameStats;
  /** Ranger minigame hunt stats. */
  rangerMinigame: RangerMinigameStats;
  /** Apothecary minigame brew stats. */
  apothecaryMinigame: ApothecaryMinigameStats;
  /** Culinarian minigame cook stats. */
  culinarianMinigame: CulinarianMinigameStats;
  /** Thief minigame heist stats. */
  thiefMinigame: ThiefMinigameStats;
}

function defaultSnapshot(): StatisticsSnapshot {
  return {
    lifetimeCurrency:   {},
    milestones:         {},
    manualHeroPresses:  {},
    jackHeroPresses:    {},
    fighterMinigame:    { totalKills: 0, killsByType: {} },
    rangerMinigame:     { successful: 0, unsuccessful: 0 },
    apothecaryMinigame: { concentratedPotionsMade: 0, dilutionSuccesses: 0, dilutionFailures: 0 },
    culinarianMinigame: { wins: 0, losses: 0, guessDist: [] },
    thiefMinigame:      { successfulHeists: 0, failedHeists: 0 },
  };
}

@Injectable({ providedIn: 'root' })
export class StatisticsService {
  private readonly source = new BehaviorSubject<StatisticsSnapshot>(defaultSnapshot());
  readonly stats$ = this.source.asObservable();

  /** Direct access to current snapshot (no copy — read only!). */
  get current(): StatisticsSnapshot { return this.source.getValue(); }

  // ── Currency tracking ──────────────────────────────────────

  /** Record currency gained. Call alongside every wallet.add(). */
  trackCurrencyGain(currencyId: string, amount: number): void {
    if (amount <= 0) return;
    const snap = this.source.getValue();
    snap.lifetimeCurrency[currencyId] = (snap.lifetimeCurrency[currencyId] ?? 0) + amount;
    this.source.next(snap);
  }

  // ── Milestones ─────────────────────────────────────────────

  /**
   * Record a milestone. Only records the first occurrence —
   * subsequent calls with the same key are ignored.
   * @param key  Internal milestone ID (e.g. "xp_RANGER_UNLOCK", "char_ranger").
   * @param label Human-readable label for display.
   */
  recordMilestone(key: string, label: string): void {
    const snap = this.source.getValue();
    if (snap.milestones[key]?.timestamp != null) return; // already recorded
    snap.milestones[key] = { label, timestamp: Date.now() };
    this.source.next(snap);
  }

  // ── Hero button presses ────────────────────────────────────

  trackManualHeroPress(charId: string): void {
    const snap = this.source.getValue();
    snap.manualHeroPresses[charId] = (snap.manualHeroPresses[charId] ?? 0) + 1;
    this.source.next(snap);
  }

  trackJackHeroPress(charId: string): void {
    const snap = this.source.getValue();
    snap.jackHeroPresses[charId] = (snap.jackHeroPresses[charId] ?? 0) + 1;
    this.source.next(snap);
  }

  // ── Fighter minigame ───────────────────────────────────────

  trackKoboldKill(variantName: string): void {
    const snap = this.source.getValue();
    snap.fighterMinigame.totalKills++;
    snap.fighterMinigame.killsByType[variantName] =
      (snap.fighterMinigame.killsByType[variantName] ?? 0) + 1;
    this.source.next(snap);
  }

  // ── Ranger minigame ────────────────────────────────────────

  trackRangerHunt(successful: boolean): void {
    const snap = this.source.getValue();
    if (successful) snap.rangerMinigame.successful++;
    else            snap.rangerMinigame.unsuccessful++;
    this.source.next(snap);
  }

  // ── Apothecary minigame ────────────────────────────────────

  trackConcentratedPotionMade(count: number): void {
    const snap = this.source.getValue();
    snap.apothecaryMinigame.concentratedPotionsMade += count;
    this.source.next(snap);
  }

  trackDilution(succeeded: boolean): void {
    const snap = this.source.getValue();
    if (succeeded) snap.apothecaryMinigame.dilutionSuccesses++;
    else           snap.apothecaryMinigame.dilutionFailures++;
    this.source.next(snap);
  }

  // ── Culinarian minigame ────────────────────────────────────

  trackCulinarianResult(won: boolean, guessesUsed: number): void {
    const snap = this.source.getValue();
    if (won) {
      snap.culinarianMinigame.wins++;
      // Expand guessDist if needed (0-indexed: index 0 = won on guess 1)
      const idx = guessesUsed - 1;
      while (snap.culinarianMinigame.guessDist.length <= idx) {
        snap.culinarianMinigame.guessDist.push(0);
      }
      snap.culinarianMinigame.guessDist[idx]++;
    } else {
      snap.culinarianMinigame.losses++;
    }
    this.source.next(snap);
  }

  // ── Thief minigame ─────────────────────────────────────────

  trackThiefHeist(successful: boolean): void {
    const snap = this.source.getValue();
    if (successful) snap.thiefMinigame.successfulHeists++;
    else            snap.thiefMinigame.failedHeists++;
    this.source.next(snap);
  }

  // ── Persistence ────────────────────────────────────────────

  buildSnapshot(): StatisticsSnapshot {
    // Deep clone to avoid mutation issues in save serialization
    return JSON.parse(JSON.stringify(this.source.getValue()));
  }

  applySnapshot(snap: StatisticsSnapshot | undefined | null): void {
    if (!snap) {
      this.source.next(defaultSnapshot());
      return;
    }
    // Backward compat: old saves have heroButtonPresses but no split fields
    const manualPresses = snap.manualHeroPresses ?? snap.heroButtonPresses ?? {};
    const jackPresses   = snap.jackHeroPresses   ?? {};

    // Merge with defaults so new fields added in future versions are present
    const merged: StatisticsSnapshot = {
      ...defaultSnapshot(),
      ...snap,
      manualHeroPresses:  { ...manualPresses },
      jackHeroPresses:    { ...jackPresses },
      fighterMinigame:    { ...defaultSnapshot().fighterMinigame,    ...snap.fighterMinigame },
      rangerMinigame:     { ...defaultSnapshot().rangerMinigame,     ...snap.rangerMinigame },
      apothecaryMinigame: { ...defaultSnapshot().apothecaryMinigame, ...snap.apothecaryMinigame },
      culinarianMinigame: { ...defaultSnapshot().culinarianMinigame, ...snap.culinarianMinigame },
      thiefMinigame:      { ...defaultSnapshot().thiefMinigame,      ...snap.thiefMinigame },
    };
    // Remove deprecated field from live snapshot
    delete merged.heroButtonPresses;
    this.source.next(merged);
  }

  /** Reset all stats to defaults. */
  reset(): void {
    this.source.next(defaultSnapshot());
  }
}

