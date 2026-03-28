import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SaveService } from './save.service';
import { ActivityLogService } from '../activity-log/activity-log.service';

type StatusType = 'success' | 'error' | 'idle';

@Component({
  selector: 'app-options-menu',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './options-menu.component.html',
  styleUrls: ['./options-menu.component.scss'],
})
export class OptionsMenuComponent {
  private saveService = inject(SaveService);
  private log         = inject(ActivityLogService);

  isOpen            = false;
  importString      = '';
  statusMsg         = '';
  statusType: StatusType = 'idle';

  /** Controls whether the clear-save confirmation overlay is visible. */
  showClearConfirm  = false;

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

  /** Step 1 — show the confirmation overlay. */
  requestClearSave(): void {
    this.showClearConfirm = true;
  }

  /** Step 2 — user confirmed: wipe localStorage and reload. */
  confirmClearSave(): void {
    this.showClearConfirm = false;
    this.saveService.deleteSave();
    this.log.log('[SAVE] Browser save data erased. Reloading…', 'warn');
    // Short delay so the log message is visible before the page reloads.
    setTimeout(() => window.location.reload(), 800);
  }

  /** Step 2 (cancel) — dismiss the overlay with no action. */
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

