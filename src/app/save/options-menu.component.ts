import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { SaveService } from './save.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { CharacterService } from '../character/character.service';

type StatusType = 'success' | 'error' | 'idle';

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
  statusMsg        = '';
  statusType: StatusType = 'idle';
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
      this.clearStatus();
      this.showClearConfirm = false;
    }
  }

  saveToCache(): void {
    this.saveService.saveToLocalStorage();
    this.setStatus('Game saved to browser cache.', 'success');
    this.log.log('Game saved to browser cache.', 'success');
  }

  async copyToClipboard(): Promise<void> {
    try {
      await this.saveService.copyToClipboard();
      this.setStatus('Save data copied to clipboard.', 'success');
      this.log.log('Save data copied to clipboard.', 'success');
    } catch {
      this.setStatus('Failed to copy — check browser permissions.', 'error');
    }
  }

  exportFile(): void {
    this.saveService.exportFile();
    this.setStatus('Save file downloaded.', 'success');
    this.log.log('Save file exported.', 'success');
  }

  importSave(): void {
    const trimmed = this.importString.trim();
    if (!trimmed) {
      this.setStatus('Paste a save string first.', 'error');
      return;
    }
    const ok = this.saveService.importFromBase64(trimmed);
    if (ok) {
      this.importString = '';
      this.setStatus('Save loaded successfully!', 'success');
      this.log.log('Save data imported and applied.', 'success');
    } else {
      this.setStatus('Invalid save data.', 'error');
    }
  }

  requestClearSave(): void {
    this.showClearConfirm = true;
  }

  confirmClearSave(): void {
    this.showClearConfirm = false;
    this.saveService.deleteSave();
    this.log.log('[SAVE] Browser save data erased. Reloading…', 'warn');
    setTimeout(() => window.location.reload(), 800);
  }

  cancelClear(): void {
    this.showClearConfirm = false;
  }

  private setStatus(msg: string, type: StatusType): void {
    this.statusMsg  = msg;
    this.statusType = type;
    setTimeout(() => this.clearStatus(), 4000);
  }

  private clearStatus(): void {
    this.statusMsg  = '';
    this.statusType = 'idle';
  }
}
