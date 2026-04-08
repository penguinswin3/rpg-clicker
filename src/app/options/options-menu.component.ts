import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { SaveService } from './save.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { CharacterService } from '../character/character.service';
import { UPGRADE_DEFS, VERSION } from '../game-config';
import { LOG_MSG } from '../flavor-text';

/** px width of the character sidebar in each state (must match character-sidebar.component.scss) */
const SIDEBAR_EXPANDED  = 220;
const SIDEBAR_COLLAPSED =  46;
/** Extra gap between options panel right edge and sidebar left edge */
const SIDEBAR_GAP = 4;
/** px height of the activity log in each state (must match activity-log.component.scss) */
const LOG_EXPANDED  = 210;
const LOG_MINIMIZED =  36;


@Component({
  selector: 'app-options-menu',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './options-menu.component.html',
  styleUrls: ['./options-menu.component.scss'],
})
export class OptionsMenuComponent implements OnInit, OnDestroy {
  private saveService = inject(SaveService);
  private log         = inject(ActivityLogService);
  private charService = inject(CharacterService);
  private sub         = new Subscription();
  public version = VERSION;

  isOpen           = false;
  importString     = '';
  showClearConfirm = false;

  /** Bound to [style.right] on the anchor — follows the sidebar width. */
  rightOffset  = `${SIDEBAR_EXPANDED + SIDEBAR_GAP}px`;
  /** Bound to [style.bottom] on the anchor — follows the activity log height. */
  bottomOffset = `${LOG_EXPANDED}px`;

  ngOnInit(): void {
    this.sub.add(
      this.charService.sidebarCollapsed$.subscribe(collapsed => {
        this.rightOffset = collapsed
          ? `${SIDEBAR_COLLAPSED + SIDEBAR_GAP}px`
          : `${SIDEBAR_EXPANDED  + SIDEBAR_GAP}px`;
      })
    );
    this.sub.add(
      this.log.minimized$.subscribe(minimized => {
        this.bottomOffset = minimized ? `${LOG_MINIMIZED}px` : `${LOG_EXPANDED}px`;
      })
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  toggle(): void {
    this.isOpen = !this.isOpen;
    if (!this.isOpen) {
      this.importString = '';
      this.showClearConfirm = false;
    }
  }

  saveToCache(): void {
    this.saveService.saveToLocalStorage();
    this.log.log(LOG_MSG.SAVE.MANUAL_SAVED, 'success');
  }

  async copyToClipboard(): Promise<void> {
    try {
      await this.saveService.copyToClipboard();
      this.log.log(LOG_MSG.SAVE.COPIED, 'success');
    } catch {
      this.log.log(LOG_MSG.SAVE.COPY_FAILED, 'error');
    }
  }

  exportFile(): void {
    this.saveService.exportFile();
    this.log.log(LOG_MSG.SAVE.EXPORTED, 'success');
  }

  importSave(): void {
    const trimmed = this.importString.trim();
    if (!trimmed) {
      this.log.log(LOG_MSG.SAVE.IMPORT_EMPTY, 'error');
      return;
    }
    // this.saveService.suppressNextSave();
    this.saveService.deleteSave();
    const ok = this.saveService.importFromBase64(trimmed);
    if (ok) {
      this.importString = '';
      this.log.log(LOG_MSG.SAVE.IMPORTED, 'success');
    } else {
      this.log.log(LOG_MSG.SAVE.IMPORT_INVALID, 'error');
    }
  }

  get hideMaxedUpgrades():    boolean { return this.saveService.hideMaxedUpgrades; }
  get hideMinigameUpgrades(): boolean { return this.saveService.hideMinigameUpgrades; }
  get blandMode():            boolean { return this.saveService.blandMode; }
  get enableDevTools():       boolean { return this.saveService.enableDevTools; }

  toggleHideMaxed():    void { this.saveService.setHideMaxedUpgrades(!this.saveService.hideMaxedUpgrades); }
  toggleHideMinigame(): void { this.saveService.setHideMinigameUpgrades(!this.saveService.hideMinigameUpgrades); }
  toggleBlandMode():    void { this.saveService.setBlandMode(!this.saveService.blandMode); }
  toggleEnableDevTools(): void { this.saveService.setEnableDevTools(!this.saveService.enableDevTools); }

  requestClearSave(): void {
    this.showClearConfirm = true;
  }

  confirmClearSave(): void {
    this.showClearConfirm = false;
    this.saveService.suppressNextSave();
    this.saveService.deleteSave();
    document.body.classList.add('screen-shake');
    this.log.log(LOG_MSG.SAVE.CLEARED, 'warn');
    setTimeout(() => window.location.reload(), 800);
  }

  cancelClear(): void {
    this.showClearConfirm = false;
  }
}
