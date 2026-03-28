import {
  Component,
  OnInit,
  OnDestroy,
  AfterViewChecked,
  ViewChild,
  ElementRef,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { ActivityLogService, LogMessage } from './activity-log.service';

type FilterType = 'default' | 'success' | 'warn' | 'error' | 'rare';

interface FilterOption {
  value: FilterType;
  label: string;
}

@Component({
  selector: 'app-activity-log',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './activity-log.component.html',
  styleUrl: './activity-log.component.scss',
})
export class ActivityLogComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('logBody') logBody?: ElementRef<HTMLDivElement>;

  private logService = inject(ActivityLogService);
  private sub!: Subscription;

  messages: LogMessage[] = [];
  minimized = false;
  private shouldScroll = false;

  readonly filters: FilterOption[] = [
    { value: 'default', label: 'INFO'    },
    { value: 'success', label: 'SUCCESS' },
    { value: 'warn',    label: 'WARN'    },
    { value: 'error',   label: 'ERROR'   },
    { value: 'rare',    label: 'RARE'    },
  ];

  /** Types currently shown. Empty set = show all. */
  activeFilters = new Set<FilterType>();

  get allActive(): boolean {
    return this.activeFilters.size === 0;
  }

  isActive(f: FilterType): boolean {
    return this.allActive || this.activeFilters.has(f);
  }

  get filteredMessages(): LogMessage[] {
    if (this.allActive) return this.messages;
    return this.messages.filter(m => this.activeFilters.has((m.type ?? 'default') as FilterType));
  }

  toggleFilter(f: FilterType): void {
    if (this.activeFilters.has(f)) {
      this.activeFilters.delete(f);
    } else {
      this.activeFilters.add(f);
    }
    // Rebuild the Set reference so Angular detects the change
    this.activeFilters = new Set(this.activeFilters);
    this.shouldScroll = true;
  }

  clearFilters(): void {
    this.activeFilters = new Set();
    this.shouldScroll = true;
  }

  ngOnInit(): void {
    this.sub = this.logService.messages$.subscribe((msgs) => {
      this.messages = msgs;
      if (!this.minimized) {
        this.shouldScroll = true;
      }
    });
  }

  ngAfterViewChecked(): void {
    if (this.shouldScroll && this.logBody?.nativeElement) {
      const el = this.logBody.nativeElement;
      el.scrollTop = el.scrollHeight;
      this.shouldScroll = false;
    }
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  toggle(): void {
    this.minimized = !this.minimized;
    if (!this.minimized) {
      this.shouldScroll = true;
    }
  }

  trackById(_: number, msg: LogMessage): number {
    return msg.id;
  }
}
