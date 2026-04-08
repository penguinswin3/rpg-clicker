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
  /** Total potions consumed inside the fighter minigame. */
  potionsDrank: number;
  /** Number of times the fighter was defeated. */
  timesDefeated: number;
  /** True once the First Strike upgrade has been purchased. */
  firstStrikeUnlocked: boolean;
  /** Longest consecutive chain of First Strike kill-chain kills. */
  longestKillChain: number;
}

export interface RangerMinigameStats {
  /** Rounds where at least one prize was found. */
  successful: number;
  /** Rounds where nothing was found. */
  unsuccessful: number;
  /** Total treasure chests found across all rounds. */
  treasureChestsFound: number;
}

export interface ApothecaryMinigameStats {
  /** Number of brews completed (standard or dilution). */
  minigamesComplete: number;
  /** Clicks inside any target zone (outer or inner). */
  potionHits: number;
  /** Clicks inside the inner Bubbling Brew zone only. */
  perfectHits: number;
  /** Clicks outside all target zones. */
  potionMisses: number;
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

export interface ArtisanMinigameStats {
  /** Total number of appraisals completed (manual + jack). */
  appraisalsCompleted: number;
  /** Total faceting rounds where the player correctly picked the best gem. */
  facetingSuccesses: number;
  /** Total faceting rounds where the player picked incorrectly. */
  facetingFailures: number;
}

export interface NecromancerMinigameStats {
  /** Total rituals completed. */
  ritualsCompleted: number;
  /** Total perfect-path rituals (100% efficiency). */
  perfectRituals: number;
  /** Sum of all efficiency scores (used to compute average). */
  totalEfficiency: number;
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
  /** Manual (non-auto-solve) sidequest completions per character. */
  manualSidequestClears: Record<string, number>;
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
  /** Artisan minigame appraisal stats. */
  artisanMinigame: ArtisanMinigameStats;
  /** Necromancer minigame ritual stats. */
  necromancerMinigame: NecromancerMinigameStats;
}

function defaultSnapshot(): StatisticsSnapshot {
  return {
    lifetimeCurrency:   {},
    milestones:         {},
    manualHeroPresses:  {},
    jackHeroPresses:    {},
    manualSidequestClears: {},
    fighterMinigame:    { totalKills: 0, killsByType: {}, potionsDrank: 0, timesDefeated: 0, firstStrikeUnlocked: false, longestKillChain: 0 },
    rangerMinigame:     { successful: 0, unsuccessful: 0, treasureChestsFound: 0 },
    apothecaryMinigame: { minigamesComplete: 0, potionHits: 0, perfectHits: 0, potionMisses: 0, dilutionSuccesses: 0, dilutionFailures: 0 },
    culinarianMinigame: { wins: 0, losses: 0, guessDist: [] },
    thiefMinigame:      { successfulHeists: 0, failedHeists: 0 },
    artisanMinigame:    { appraisalsCompleted: 0, facetingSuccesses: 0, facetingFailures: 0 },
    necromancerMinigame:{ ritualsCompleted: 0, perfectRituals: 0, totalEfficiency: 0 },
  };
}

@Injectable({ providedIn: 'root' })
export class StatisticsService {
  private readonly source = new BehaviorSubject<StatisticsSnapshot>(defaultSnapshot());
  readonly stats$ = this.source.asObservable();

  /** Direct access to current snapshot (no copy — read only!). */
  get current(): StatisticsSnapshot { return this.source.getValue(); }

  /** Whether a microtask flush is scheduled. */
  private _flushScheduled = false;
  private _dirty = false;

  /** Schedule a coalesced emission on the next microtask. */
  private _scheduleFlush(): void {
    this._dirty = true;
    if (!this._flushScheduled) {
      this._flushScheduled = true;
      queueMicrotask(() => {
        this._flushScheduled = false;
        if (this._dirty) {
          this._dirty = false;
          this.source.next(this.source.getValue());
        }
      });
    }
  }

  // ── Currency tracking ──────────────────────────────────────

  /** Record currency gained. Call alongside every wallet.add(). */
  trackCurrencyGain(currencyId: string, amount: number): void {
    if (amount <= 0) return;
    const snap = this.source.getValue();
    snap.lifetimeCurrency[currencyId] = (snap.lifetimeCurrency[currencyId] ?? 0) + amount;
    this._scheduleFlush();
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
    this._scheduleFlush();
  }

  // ── Hero button presses ────────────────────────────────────

  trackManualHeroPress(charId: string): void {
    const snap = this.source.getValue();
    snap.manualHeroPresses[charId] = (snap.manualHeroPresses[charId] ?? 0) + 1;
    this._scheduleFlush();
  }

  trackJackHeroPress(charId: string): void {
    const snap = this.source.getValue();
    snap.jackHeroPresses[charId] = (snap.jackHeroPresses[charId] ?? 0) + 1;
    this._scheduleFlush();
  }

  // ── Sidequest completions ────────────────────────────────────

  /** Record a manual (non-auto-solve) sidequest clear for a character. */
  trackManualSidequestClear(charId: string): void {
    const snap = this.source.getValue();
    snap.manualSidequestClears[charId] = (snap.manualSidequestClears[charId] ?? 0) + 1;
    this._scheduleFlush();
  }

  /** Get the number of manual sidequest clears for a character. */
  getManualSidequestClears(charId: string): number {
    return this.source.getValue().manualSidequestClears[charId] ?? 0;
  }

  // ── Fighter minigame ───────────────────────────────────────

  trackKoboldKill(variantName: string): void {
    const snap = this.source.getValue();
    snap.fighterMinigame.totalKills++;
    snap.fighterMinigame.killsByType[variantName] =
      (snap.fighterMinigame.killsByType[variantName] ?? 0) + 1;
    this._scheduleFlush();
  }

  trackFighterPotionDrank(count: number): void {
    if (count <= 0) return;
    const snap = this.source.getValue();
    snap.fighterMinigame.potionsDrank += count;
    this._scheduleFlush();
  }

  trackFighterDefeated(): void {
    const snap = this.source.getValue();
    snap.fighterMinigame.timesDefeated++;
    this._scheduleFlush();
  }

  markFirstStrikeUnlocked(): void {
    const snap = this.source.getValue();
    if (snap.fighterMinigame.firstStrikeUnlocked) return;
    snap.fighterMinigame.firstStrikeUnlocked = true;
    this._scheduleFlush();
  }

  trackFighterKillChain(chainLength: number): void {
    if (chainLength <= 0) return;
    const snap = this.source.getValue();
    if (chainLength > snap.fighterMinigame.longestKillChain) {
      snap.fighterMinigame.longestKillChain = chainLength;
      this._scheduleFlush();
    }
  }

  // ── Ranger minigame ────────────────────────────────────────

  trackRangerHunt(successful: boolean): void {
    const snap = this.source.getValue();
    if (successful) snap.rangerMinigame.successful++;
    else            snap.rangerMinigame.unsuccessful++;
    this._scheduleFlush();
  }

  trackRangerTreasureChest(count: number = 1): void {
    if (count <= 0) return;
    const snap = this.source.getValue();
    snap.rangerMinigame.treasureChestsFound += count;
    this._scheduleFlush();
  }

  // ── Apothecary minigame ────────────────────────────────────

  /** Call once when a brew completes (standard or dilution). */
  trackApothecaryMinigameComplete(): void {
    const snap = this.source.getValue();
    snap.apothecaryMinigame.minigamesComplete++;
    this._scheduleFlush();
  }

  /**
   * Call for every successful click inside a target zone.
   * @param perfect true if the click was also inside the inner Bubbling Brew zone.
   */
  trackPotionHit(perfect: boolean): void {
    const snap = this.source.getValue();
    snap.apothecaryMinigame.potionHits++;
    if (perfect) snap.apothecaryMinigame.perfectHits++;
    this._scheduleFlush();
  }

  /** Call for every click outside all target zones. */
  trackPotionMiss(): void {
    const snap = this.source.getValue();
    snap.apothecaryMinigame.potionMisses++;
    this._scheduleFlush();
  }

  trackDilution(succeeded: boolean): void {
    const snap = this.source.getValue();
    if (succeeded) snap.apothecaryMinigame.dilutionSuccesses++;
    else           snap.apothecaryMinigame.dilutionFailures++;
    this._scheduleFlush();
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
    this._scheduleFlush();
  }

  // ── Thief minigame ─────────────────────────────────────────

  trackThiefHeist(successful: boolean): void {
    const snap = this.source.getValue();
    if (successful) snap.thiefMinigame.successfulHeists++;
    else            snap.thiefMinigame.failedHeists++;
    this._scheduleFlush();
  }

  // ── Artisan minigame ───────────────────────────────────────

  trackArtisanAppraisal(count: number = 1): void {
    if (count <= 0) return;
    const snap = this.source.getValue();
    snap.artisanMinigame.appraisalsCompleted += count;
    this._scheduleFlush();
  }

  /** Track a faceting minigame result. */
  trackArtisanFaceting(success: boolean): void {
    const snap = this.source.getValue();
    if (success) snap.artisanMinigame.facetingSuccesses++;
    else         snap.artisanMinigame.facetingFailures++;
    this._scheduleFlush();
  }

  // ── Necromancer minigame ───────────────────────────────────

  /** Track a completed Well of Souls ritual. */
  trackNecromancerRitual(efficiencyPct: number): void {
    const snap = this.source.getValue();
    snap.necromancerMinigame.ritualsCompleted++;
    snap.necromancerMinigame.totalEfficiency += efficiencyPct;
    if (efficiencyPct >= 100) snap.necromancerMinigame.perfectRituals++;
    this._scheduleFlush();
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
      manualSidequestClears: { ...(snap.manualSidequestClears ?? {}) },
      fighterMinigame:    { ...defaultSnapshot().fighterMinigame,    ...snap.fighterMinigame },
      rangerMinigame:     { ...defaultSnapshot().rangerMinigame,     ...snap.rangerMinigame },
      apothecaryMinigame: { ...defaultSnapshot().apothecaryMinigame, ...snap.apothecaryMinigame },
      culinarianMinigame: { ...defaultSnapshot().culinarianMinigame, ...snap.culinarianMinigame },
      thiefMinigame:      { ...defaultSnapshot().thiefMinigame,      ...snap.thiefMinigame },
      artisanMinigame:    { ...defaultSnapshot().artisanMinigame,    ...snap.artisanMinigame },
      necromancerMinigame:{ ...defaultSnapshot().necromancerMinigame,...snap.necromancerMinigame },
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

