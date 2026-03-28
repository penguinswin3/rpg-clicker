import { Injectable, inject } from '@angular/core';
import { WalletService } from '../wallet/wallet.service';
import { CharacterService } from '../character/character.service';

/** All upgrade / progression state managed by AppComponent. */
export interface UpgradeState {
  // Fighter
  goldPerClick: number;
  clickUpgradeCost: number;
  clickUpgradeLevel: number;
  autoGoldPerSecond: number;
  autoUpgradeCost: number;
  autoUpgradeLevel: number;
  potionChuggingLevel: number;
  potionChuggingCost: number;
  // Ranger
  herbsPerFind: number;
  moreHerbsCost: number;
  moreHerbsLevel: number;
  betterTrackingLevel: number;
  betterTrackingCost: number;
  // Apothecary
  herbSaveChance: number;
  potionTitrationCost: number;
  potionTitrationLevel: number;
  potionAutoGoldPerSecond: number;
  potionMarketingCost: number;
  potionMarketingLevel: number;
}

export interface SaveSnapshot {
  /** Bump this if the schema ever changes incompatibly. */
  version: number;
  timestamp: number;
  wallet: Record<string, { amount: number; perSecond: number }>;
  characters: { id: string; unlocked: boolean }[];
  activeCharacterId: string;
  manualUnlocks: string[];
  upgrades: UpgradeState;
}

const SAVE_KEY = 'rpg-clicker-save';
const CURRENT_VERSION = 1;

@Injectable({ providedIn: 'root' })
export class SaveService {
  private wallet      = inject(WalletService);
  private charService = inject(CharacterService);

  // Callbacks registered by AppComponent so we can capture / restore upgrade state.
  private upgradeGetter: (() => UpgradeState) | null = null;
  private upgradeSetter: ((s: UpgradeState) => void) | null = null;

  /** Called once by AppComponent to plug in upgrade-state access. */
  registerUpgradeHandlers(
    getter: () => UpgradeState,
    setter: (s: UpgradeState) => void,
  ): void {
    this.upgradeGetter = getter;
    this.upgradeSetter = setter;
  }

  // ── Snapshot building ─────────────────────────────────────────

  buildSnapshot(): SaveSnapshot {
    const walletState = this.wallet['stateSource'].getValue() as
      Record<string, { amount: number; perSecond: number }>;
    const manualUnlocks = Array.from(
      this.wallet['manualUnlocksSource'].getValue() as Set<string>
    );
    const characters = this.charService
      .getCharacters()
      .map(c => ({ id: c.id, unlocked: c.unlocked }));
    const activeCharacterId = this.charService.activeId;
    const upgrades = this.upgradeGetter ? this.upgradeGetter() : ({} as UpgradeState);

    return {
      version: CURRENT_VERSION,
      timestamp: Date.now(),
      wallet: walletState,
      characters,
      activeCharacterId,
      manualUnlocks,
      upgrades,
    };
  }

  applySnapshot(snap: SaveSnapshot): void {
    // 1 — Wallet amounts
    for (const [id, entry] of Object.entries(snap.wallet)) {
      this.wallet.set(id, entry.amount);
      this.wallet.setPerSecond(id, entry.perSecond);
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

