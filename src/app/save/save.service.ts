import { Injectable, inject } from '@angular/core';
import { WalletService } from '../wallet/wallet.service';
import { CharacterService } from '../character/character.service';
import { ActivityLogService, LogFilterType } from '../activity-log/activity-log.service';

/** All upgrade / progression state managed by AppComponent. */
export interface UpgradeState {
  // Fighter
  goldPerClick: number;
  clickUpgradeCost: number;
  clickUpgradeLevel: number;
  // autoGoldPerSecond is derived: autoUpgradeLevel × 1g/s — not saved
  autoUpgradeCost: number;
  autoUpgradeLevel: number;
  potionChuggingLevel: number;
  potionChuggingCost: number;
  /** Sharper Swords minigame upgrade — optional for old-save compat */
  sharperSwordsLevel?: number;
  sharperSwordsCost?: number;
  // Ranger
  /** @deprecated herbsPerFind is now derived via the doubling formula; kept optional for old-save compat */
  herbsPerFind?: number;
  moreHerbsCost: number;
  moreHerbsLevel: number;
  betterTrackingLevel: number;
  betterTrackingCost: number;
  /** Bountiful Lands minigame upgrade — optional for old-save compat */
  bountifulLandsLevel?: number;
  bountifulLandsCost?: number;
  // Apothecary
  herbSaveChance: number;
  potionTitrationCost: number;
  potionTitrationLevel: number;
  // potionAutoGoldPerSecond is derived: potionMarketingLevel × 1g/s — not saved
  potionMarketingCost: number;
  potionMarketingLevel: number;
  /** Whether the minigame system has been purchased. Optional for old-save compat. */
  minigameUnlocked?: boolean;
}

/** Persisted UI window and filter preferences. */
export interface UiPrefs {
  walletCollapsed: boolean;
  walletCharacterFilters: string[];
  activityLogMinimized: boolean;
  activityLogFilters: LogFilterType[];
  characterSidebarCollapsed: boolean;
}

export interface SaveSnapshot {
  /** Bump this if the schema ever changes incompatibly. */
  version: number;
  timestamp: number;
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
const CURRENT_VERSION = 1;
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

  /** When true the next beforeunload save is skipped (used by dev clear-save). */
  private _skipNextSave = false;

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
    };

    return {
      version: CURRENT_VERSION,
      timestamp: Date.now(),
      wallet: walletAmounts,
      characters,
      activeCharacterId,
      manualUnlocks,
      upgrades,
      uiPrefs,
    };
  }

  applySnapshot(snap: SaveSnapshot): void {
    // 1 — Wallet amounts only; perSecond is re-derived from upgrade levels below.
    for (const [id, entry] of Object.entries(snap.wallet)) {
      this.wallet.set(id, entry.amount);
    }

    // 2 — Manual unlocks
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

    // 5 — Upgrade state
    if (snap.upgrades && this.upgradeSetter) {
      this.upgradeSetter(snap.upgrades);
    }

    // 6 — UI preferences (optional — absent in older saves)
    if (snap.uiPrefs) {
      const p = snap.uiPrefs;
      this.wallet.setCollapsed(p.walletCollapsed ?? false);
      this.wallet.setCharacterFilters(new Set(p.walletCharacterFilters ?? []));
      this.log.setMinimized(p.activityLogMinimized ?? false);
      this.log.setActiveFilters(new Set(p.activityLogFilters ?? []));
      this.charService.setSidebarCollapsed(p.characterSidebarCollapsed ?? false);
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
      if (!snap || typeof snap.version !== 'number') return null;
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

