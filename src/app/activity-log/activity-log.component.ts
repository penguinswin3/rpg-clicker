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
import { ActivityLogService, LogMessage, LogFilterType } from './activity-log.service';

interface FilterOption {
  value: LogFilterType;
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
  private sub = new Subscription();

  messages: LogMessage[] = [];
  minimized = false;
  activeFilters = new Set<LogFilterType>();
  private shouldScroll = false;

  readonly filters: FilterOption[] = [
    { value: 'default', label: 'INFO'    },
    { value: 'success', label: 'SUCCESS' },
    { value: 'warn',    label: 'WARN'    },
    { value: 'error',   label: 'ERROR'   },
    { value: 'rare',    label: 'RARE'    },
  ];

  get allActive(): boolean {
    return this.activeFilters.size === 0;
  }

  isActive(f: LogFilterType): boolean {
    return this.allActive || this.activeFilters.has(f);
  }

  get filteredMessages(): LogMessage[] {
    if (this.allActive) return this.messages;
    return this.messages.filter(m => this.activeFilters.has((m.type ?? 'default') as LogFilterType));
  }

  toggleFilter(f: LogFilterType): void {
    this.logService.toggleFilter(f);
    this.shouldScroll = true;
  }

  clearFilters(): void {
    this.logService.clearFilters();
    this.shouldScroll = true;
  }

  ngOnInit(): void {
    this.sub.add(this.logService.messages$.subscribe(msgs => {
      this.messages = msgs;
      if (!this.minimized) this.shouldScroll = true;
    }));
    this.sub.add(this.logService.minimized$.subscribe(v => (this.minimized = v)));
    this.sub.add(this.logService.activeFilters$.subscribe(f => (this.activeFilters = f)));
  }

  ngAfterViewChecked(): void {
    if (this.shouldScroll && this.logBody?.nativeElement) {
      const el = this.logBody.nativeElement;
      el.scrollTop = el.scrollHeight;
      this.shouldScroll = false;
    }
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  toggle(): void {
    this.logService.toggleMinimized();
    if (!this.minimized) this.shouldScroll = true;
  }

  trackById(_: number, msg: LogMessage): number {
    return msg.id;
  }
}


