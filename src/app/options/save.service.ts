import { Injectable, inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { WalletService } from '../wallet/wallet.service';
import { CharacterService } from '../character/character.service';
import { ActivityLogService, LogFilterType } from '../activity-log/activity-log.service';
import { UPGRADE_DEFS, VERSION } from '../game-config';
import { UpgradesSnapshot } from '../upgrade/upgrade.service';
import { scaledCost } from '../utils/mathUtils';

/** Persistent snapshot of the Fighter's in-progress combat. */
export interface FighterCombatState {
  fighterHp: number;
  enemyHp: number;
  defeated: boolean;
  restCountdown: number;
  /** Absolute wall-clock timestamp (ms) when the long rest ends. Used so the
   *  countdown ticks correctly even while the Fighter tab is not active.
   *  Optional for backward compatibility with older saves. */
  restEndsAt?: number;
}

/** All upgrade / progression state managed by AppComponent. */
export interface UpgradeState {
  /** Generic per-upgrade data: { upgradeId → { level, costs } }.
   *  Adding new upgrades never requires changing this interface. */
  upgradeLevels: UpgradesSnapshot;
  selectedKoboldLevel?: number;
  minigameUnlocked?: boolean;
  jacksOwned?: number;
  jacksAllocations?: Record<string, number>;
  fighterCombatState?: FighterCombatState;
  /** Persisted UI toggle states — optional for backward compat. */
  shortRestEnabled?: boolean;
  wholesaleSpicesEnabled?: boolean;
  dilutionEnabled?: boolean;
}

// ── Legacy save migration ─────────────────────────────────────

/** @deprecated Flat upgrade state from v1 saves — kept only for backward-compatible migration. */
interface LegacyUpgradeState {
  goldPerClick?: number;
  clickUpgradeCost?: number;
  clickUpgradeLevel?: number;
  autoUpgradeCost?: number;
  autoUpgradeLevel?: number;
  potionChuggingLevel?: number;
  potionChuggingCost?: number;
  insightfulContractsLevel?: number;
  insightfulContractsCost?: number;
  sharperSwordsLevel?: number;
  sharperSwordsCost?: number;
  strongerKoboldsLevel?: number;
  strongerKoboldsEarsCost?: number;
  strongerKoboldsMeatCost?: number;
  selectedKoboldLevel?: number;
  herbsPerFind?: number;
  moreHerbsCost?: number;
  moreHerbsLevel?: number;
  betterTrackingLevel?: number;
  betterTrackingCost?: number;
  bountifulLandsLevel?: number;
  bountifulLandsCost?: number;
  abundantLandsLevel?: number;
  abundantLandsCost?: number;
  potionCatsEyeLevel?: number;
  potionCatsEyeConcCost?: number;
  potionCatsEyePixieCost?: number;
  biggerGameLevel?: number;
  biggerGameCost?: number;
  herbSaveChance?: number;
  potionTitrationCost?: number;
  potionTitrationLevel?: number;
  potionMarketingCost?: number;
  potionMarketingLevel?: number;
  minigameUnlocked?: boolean;
  jacksOwned?: number;
  jacksAllocations?: Record<string, number>;
  fighterCombatState?: FighterCombatState;
}

/** Returns true if the raw upgrades object is in the legacy v1 flat format. */
function isLegacyFormat(obj: any): obj is LegacyUpgradeState {
  return obj && !('upgradeLevels' in obj) && ('clickUpgradeLevel' in obj || 'moreHerbsLevel' in obj);
}

/**
 * Compute the correct next-purchase costs for an upgrade at a given level.
 * Always derived from the live config — never from the save — so stale or
 * renamed currencies are never carried forward.
 * Formula: floor(base × scale^level)
 */
function scaledCostsFor(id: string, level: number): Record<string, number> {
  const def = UPGRADE_DEFS.find(d => d.id === id);
  if (!def) return {};
  return Object.fromEntries(
    def.costs.map(c => [c.currency, scaledCost(c.base, c.scale, level)])
  );
}

/** Convert a legacy v1 flat save into the current generic format. */
function migrateLegacy(s: LegacyUpgradeState): UpgradeState {
  const lvl = (n: number | undefined) => n ?? 0;
  const upgradeLevels: UpgradesSnapshot = {
    BETTER_BOUNTIES:      { level: lvl(s.clickUpgradeLevel),        costs: scaledCostsFor('BETTER_BOUNTIES',      lvl(s.clickUpgradeLevel))        },
    CONTRACTED_HIRELINGS: { level: lvl(s.autoUpgradeLevel),         costs: scaledCostsFor('CONTRACTED_HIRELINGS', lvl(s.autoUpgradeLevel))         },
    INSIGHTFUL_CONTRACTS: { level: lvl(s.insightfulContractsLevel), costs: scaledCostsFor('INSIGHTFUL_CONTRACTS', lvl(s.insightfulContractsLevel)) },
    POTION_CHUGGING:      { level: lvl(s.potionChuggingLevel),      costs: scaledCostsFor('POTION_CHUGGING',      lvl(s.potionChuggingLevel))      },
    SHARPER_SWORDS:       { level: lvl(s.sharperSwordsLevel),       costs: scaledCostsFor('SHARPER_SWORDS',       lvl(s.sharperSwordsLevel))       },
    STRONGER_KOBOLDS:     { level: lvl(s.strongerKoboldsLevel),     costs: scaledCostsFor('STRONGER_KOBOLDS',     lvl(s.strongerKoboldsLevel))     },
    MORE_HERBS:           { level: lvl(s.moreHerbsLevel),           costs: scaledCostsFor('MORE_HERBS',           lvl(s.moreHerbsLevel))           },
    BETTER_TRACKING:      { level: lvl(s.betterTrackingLevel),      costs: scaledCostsFor('BETTER_TRACKING',      lvl(s.betterTrackingLevel))      },
    BIGGER_GAME:          { level: lvl(s.biggerGameLevel),          costs: scaledCostsFor('BIGGER_GAME',          lvl(s.biggerGameLevel))          },
    BOUNTIFUL_LANDS:      { level: lvl(s.bountifulLandsLevel),      costs: scaledCostsFor('BOUNTIFUL_LANDS',      lvl(s.bountifulLandsLevel))      },
    ABUNDANT_LANDS:       { level: lvl(s.abundantLandsLevel),       costs: scaledCostsFor('ABUNDANT_LANDS',       lvl(s.abundantLandsLevel))       },
    POTION_CATS_EYE:      { level: lvl(s.potionCatsEyeLevel),       costs: scaledCostsFor('POTION_CATS_EYE',      lvl(s.potionCatsEyeLevel))       },
    POTION_TITRATION:     { level: lvl(s.potionTitrationLevel),     costs: scaledCostsFor('POTION_TITRATION',     lvl(s.potionTitrationLevel))     },
    POTION_MARKETING:     { level: lvl(s.potionMarketingLevel),     costs: scaledCostsFor('POTION_MARKETING',     lvl(s.potionMarketingLevel))     },
  };

  return {
    upgradeLevels,
    selectedKoboldLevel: s.selectedKoboldLevel,
    minigameUnlocked:    s.minigameUnlocked,
    jacksOwned:          s.jacksOwned,
    jacksAllocations:    s.jacksAllocations,
    fighterCombatState:  s.fighterCombatState,
  };
}

/** Persisted UI window and filter preferences. */
export interface UiPrefs {
  walletCollapsed: boolean;
  walletCharacterFilters: string[];
  activityLogMinimized: boolean;
  activityLogFilters: LogFilterType[];
  characterSidebarCollapsed: boolean;
  /** Optional — absent in older saves, defaults to false. */
  hideMaxedUpgrades?: boolean;
  hideMinigameUpgrades?: boolean;
  blandMode?: boolean;
  enableDevTools?: boolean;
}

export interface SaveSnapshot {
  /** Game version string (e.g. "Alpha 1.0.0"). */
  version: string;
  /**
   * Wall-clock ms timestamp (as a string) of when this save file was first created.
   * Written exactly once — never overwritten on subsequent saves.
   * For saves ported from a legacy format that had no timestamp, the value is
   * the ms timestamp of the migration moment with "-legacy" appended.
   */
  startTimestamp?: string;
  timestamp: number;
  /**
   * All-time peak XP ever reached by this save.  Persisted separately from the
   * wallet so XP-gated unlocks survive any decrease in current XP.
   * Optional for backward-compat with older saves (falls back to current XP).
   */
  highestXpEver?: number;
  /** Only currency amounts are persisted. perSecond rates are re-derived from upgrade levels on load. */
  wallet: Record<string, { amount: number }>;
  characters: { id: string; unlocked: boolean }[];
  activeCharacterId: string;
  manualUnlocks: string[];
  upgrades: UpgradeState;
  /** UI window/filter preferences — optional for backward compat with older saves. */
  uiPrefs?: UiPrefs;
}

const SAVE_KEY = 'rpg-clicker-save';
/** Auto-save interval: every 5 minutes of play time. */
const AUTO_SAVE_MS = 5 * 60 * 1000;

@Injectable({ providedIn: 'root' })
export class SaveService {
  private wallet      = inject(WalletService);
  private charService = inject(CharacterService);
  private log         = inject(ActivityLogService);

  // Callbacks registered by AppComponent so we can capture / restore upgrade state.
  private upgradeGetter: (() => UpgradeState) | null = null;
  private upgradeSetter: ((s: UpgradeState) => void) | null = null;

  private autoSaveTimer?: ReturnType<typeof setInterval>;

  // ── Upgrade display preferences ───────────────────────────────
  private hideMaxedSource        = new BehaviorSubject<boolean>(false);
  private hideMinigameSource     = new BehaviorSubject<boolean>(false);
  private blandModeSource        = new BehaviorSubject<boolean>(false);
  private enableDevToolsSource   = new BehaviorSubject<boolean>(false);

  readonly hideMaxedUpgrades$    = this.hideMaxedSource.asObservable();
  readonly hideMinigameUpgrades$ = this.hideMinigameSource.asObservable();
  readonly blandMode$            = this.blandModeSource.asObservable();
  readonly enableDevTools$       = this.enableDevToolsSource.asObservable();

  get hideMaxedUpgrades():    boolean { return this.hideMaxedSource.getValue(); }
  get hideMinigameUpgrades(): boolean { return this.hideMinigameSource.getValue(); }
  get blandMode():            boolean { return this.blandModeSource.getValue(); }
  get enableDevTools():       boolean { return this.enableDevToolsSource.getValue(); }

  setHideMaxedUpgrades(v: boolean):    void { this.hideMaxedSource.next(v); }
  setHideMinigameUpgrades(v: boolean): void { this.hideMinigameSource.next(v); }
  setBlandMode(v: boolean):            void { this.blandModeSource.next(v); }
  setEnableDevTools(v: boolean):       void { this.enableDevToolsSource.next(v); }

  /** When true the next beforeunload save is skipped (used by dev clear-save). */
  private _skipNextSave = false;

  /**
   * The start timestamp for this save file. Set once and never overwritten.
   * null means the game has not been saved yet (new session, no localStorage).
   */
  private _startTimestamp: string | null = null;

  /** Tell the service to skip the very next beforeunload save. */
  suppressNextSave(): void { this._skipNextSave = true; }

  /** Returns true if the next save should be suppressed (resets the flag). */
  consumeSuppression(): boolean {
    const suppress = this._skipNextSave;
    this._skipNextSave = false;
    return suppress;
  }

  /** Called once by AppComponent to plug in upgrade-state access. */
  registerUpgradeHandlers(
    getter: () => UpgradeState,
    setter: (s: UpgradeState) => void,
  ): void {
    this.upgradeGetter = getter;
    this.upgradeSetter = setter;
  }

  // ── Auto-save ─────────────────────────────────────────────────

  /**
   * Start the 5-minute auto-save interval.
   * Safe to call multiple times — clears any existing timer first.
   */
  startAutoSave(): void {
    this.stopAutoSave();
    this.autoSaveTimer = setInterval(() => {
      this.saveToLocalStorage();
      this.log.log('[ AUTO-SAVE ] Game state saved to browser cache.', 'success');
    }, AUTO_SAVE_MS);
  }

  /** Stop the auto-save interval. */
  stopAutoSave(): void {
    if (this.autoSaveTimer !== undefined) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = undefined;
    }
  }

  // ── Snapshot building ─────────────────────────────────────────

  buildSnapshot(): SaveSnapshot {
    const rawState = this.wallet['stateSource'].getValue() as
      Record<string, { amount: number; perSecond: number }>;
    // Only persist amounts — perSecond rates are derived from upgrade levels on load.
    const walletAmounts: Record<string, { amount: number }> = {};
    for (const [id, entry] of Object.entries(rawState)) {
      walletAmounts[id] = { amount: entry.amount };
    }
    const manualUnlocks = Array.from(
      this.wallet['manualUnlocksSource'].getValue() as Set<string>
    );
    const characters = this.charService
      .getCharacters()
      .map(c => ({ id: c.id, unlocked: c.unlocked }));
    const activeCharacterId = this.charService.activeId;
    const upgrades = this.upgradeGetter ? this.upgradeGetter() : ({} as UpgradeState);

    const uiPrefs: UiPrefs = {
      walletCollapsed: this.wallet.collapsed,
      walletCharacterFilters: Array.from(this.wallet.characterFilters),
      activityLogMinimized: this.log.minimized,
      activityLogFilters: Array.from(this.log.activeFilters),
      characterSidebarCollapsed: this.charService.sidebarCollapsed,
      hideMaxedUpgrades:    this.hideMaxedUpgrades,
      hideMinigameUpgrades: this.hideMinigameUpgrades,
      blandMode:            this.blandMode,
      enableDevTools:       this.enableDevTools,
    };

    return {
      version: VERSION,
      startTimestamp: this._startTimestamp ?? (this._startTimestamp = Date.now().toString()),
      timestamp: Date.now(),
      highestXpEver: this.wallet.highestXpEver,
      wallet: walletAmounts,
      characters,
      activeCharacterId,
      manualUnlocks,
      upgrades,
      uiPrefs,
    };
  }

  applySnapshot(snap: SaveSnapshot): void {
    // 0 — Restore start timestamp (write-once: once set, never overwrite with a newer value).
    if (!this._startTimestamp) {
      this._startTimestamp = snap.startTimestamp ?? `${Date.now()}-legacy`;
    }

    // 1 — Wallet amounts only; perSecond rates are re-derived from upgrade levels below.
    for (const [id, entry] of Object.entries(snap.wallet)) {
      this.wallet.set(id, entry.amount);
    }

    // 1b — Restore all-time peak XP (falls back to current XP for older saves without the field).
    const savedHighestXp = snap.highestXpEver ?? Math.floor(snap.wallet['xp']?.amount ?? 0);
    this.wallet.setHighestXpEver(savedHighestXp);

    // 2 — Manual unlocks (clear existing ones first, then apply the loaded ones)
    this.wallet.clearManualUnlocks();
    for (const id of snap.manualUnlocks) {
      this.wallet.unlockCurrency(id);
    }

    // 3 — Characters
    for (const c of snap.characters) {
      if (c.unlocked) {
        this.charService.unlock(c.id);
      }
    }

    // 4 — Active character
    this.charService.setActive(snap.activeCharacterId);

    // 5 — Upgrade state (with legacy migration)
    if (snap.upgrades && this.upgradeSetter) {
      const state = isLegacyFormat(snap.upgrades)
        ? migrateLegacy(snap.upgrades)
        : snap.upgrades as UpgradeState;
      this.upgradeSetter(state);
    }

    // 6 — UI preferences (optional — absent in older saves)
    if (snap.uiPrefs) {
      const p = snap.uiPrefs;
      this.wallet.setCollapsed(p.walletCollapsed ?? false);
      this.wallet.setCharacterFilters(new Set(p.walletCharacterFilters ?? []));
      this.log.setMinimized(p.activityLogMinimized ?? false);
      this.log.setActiveFilters(new Set(p.activityLogFilters ?? []));
      this.charService.setSidebarCollapsed(p.characterSidebarCollapsed ?? false);
      this.setHideMaxedUpgrades(p.hideMaxedUpgrades       ?? false);
      this.setHideMinigameUpgrades(p.hideMinigameUpgrades ?? false);
      this.setBlandMode(p.blandMode                       ?? false);
      this.setEnableDevTools(p.enableDevTools             ?? false);
    }
  }

  // ── Encoding helpers ─────────────────────────────────────────

  snapshotToBase64(snap: SaveSnapshot): string {
    const json = JSON.stringify(snap);
    return btoa(unescape(encodeURIComponent(json)));
  }

  base64ToSnapshot(encoded: string): SaveSnapshot | null {
    try {
      const json = decodeURIComponent(escape(atob(encoded.trim())));
      const snap = JSON.parse(json) as SaveSnapshot;
      if (!snap || typeof snap.version !== 'string') return null;
      return snap;
    } catch {
      return null;
    }
  }

  // ── Persistence ───────────────────────────────────────────────

  /** Save game to browser localStorage. Returns the base64 string. */
  saveToLocalStorage(): string {
    const encoded = this.snapshotToBase64(this.buildSnapshot());
    localStorage.setItem(SAVE_KEY, encoded);
    return encoded;
  }

  /** Load game from localStorage. Returns true on success. */
  loadFromLocalStorage(): boolean {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const snap = this.base64ToSnapshot(raw);
    if (!snap) return false;
    this.applySnapshot(snap);
    return true;
  }

  /** Returns true if there is a save present in localStorage. */
  hasSave(): boolean {
    return !!localStorage.getItem(SAVE_KEY);
  }

  /** Delete the localStorage save. */
  deleteSave(): void {
    localStorage.removeItem(SAVE_KEY);
  }

  // ── Export / Import ───────────────────────────────────────────

  /** Returns the current save as a base64 string (does NOT persist). */
  exportBase64(): string {
    return this.snapshotToBase64(this.buildSnapshot());
  }

  /** Copy the current save to the clipboard. */
  async copyToClipboard(): Promise<void> {
    const encoded = this.exportBase64();
    await navigator.clipboard.writeText(encoded);
  }

  /** Trigger a browser download of the save as a .txt file. */
  exportFile(): void {
    const encoded = this.exportBase64();
    const blob = new Blob([encoded], { type: 'text/plain' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `rpg-clicker-save-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Import game state from a base64 string.
   * Returns `true` on success, `false` if the string is invalid.
   */
  importFromBase64(encoded: string): boolean {
    const snap = this.base64ToSnapshot(encoded);
    if (!snap) return false;
    this.applySnapshot(snap);
    this.saveToLocalStorage();   // persist after a successful import
    return true;
  }
}

