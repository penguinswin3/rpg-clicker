import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { SaveService } from './save.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { CharacterService } from '../character/character.service';

/** px width of the character sidebar in each state (must match character-sidebar.component.scss) */
const SIDEBAR_EXPANDED  = 220;
const SIDEBAR_COLLAPSED =  46;
/** Extra gap between options panel right edge and sidebar left edge */
const SIDEBAR_GAP = 4;

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

  isOpen           = false;
  importString     = '';
  showClearConfirm = false;

  /** Bound to [style.right] on the anchor — follows the sidebar width. */
  rightOffset = `${SIDEBAR_EXPANDED + SIDEBAR_GAP}px`;

  ngOnInit(): void {
    this.sub.add(
      this.charService.sidebarCollapsed$.subscribe(collapsed => {
        this.rightOffset = collapsed
          ? `${SIDEBAR_COLLAPSED + SIDEBAR_GAP}px`
          : `${SIDEBAR_EXPANDED  + SIDEBAR_GAP}px`;
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
    this.log.log('Game saved to browser cache.', 'success');
  }

  async copyToClipboard(): Promise<void> {
    try {
      await this.saveService.copyToClipboard();
      this.log.log('Save data copied to clipboard.', 'success');
    } catch {
      this.log.log('Failed to copy save data — check browser permissions.', 'error');
    }
  }

  exportFile(): void {
    this.saveService.exportFile();
    this.log.log('Save file exported.', 'success');
  }

  importSave(): void {
    const trimmed = this.importString.trim();
    if (!trimmed) {
      this.log.log('Paste a save string into the import box first.', 'error');
      return;
    }
    const ok = this.saveService.importFromBase64(trimmed);
    if (ok) {
      this.importString = '';
      this.log.log('Save data imported and applied.', 'success');
    } else {
      this.log.log('Invalid save data — could not import.', 'error');
    }
  }

  requestClearSave(): void {
    this.showClearConfirm = true;
  }

  confirmClearSave(): void {
    this.showClearConfirm = false;
    this.saveService.suppressNextSave();
    this.saveService.deleteSave();
    document.body.classList.add('screen-shake');
    this.log.log('[SAVE] Browser save data erased. Reloading…', 'warn');
    setTimeout(() => window.location.reload(), 800);
  }

  cancelClear(): void {
    this.showClearConfirm = false;
  }
}
