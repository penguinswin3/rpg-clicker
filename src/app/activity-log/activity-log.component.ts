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

