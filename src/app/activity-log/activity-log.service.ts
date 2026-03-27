import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface LogMessage {
  id: number;
  timestamp: string;
  text: string;
  type?: 'default' | 'success' | 'warn' | 'error' | 'rare';
}

const MAX_MESSAGES = 100;

@Injectable({ providedIn: 'root' })
export class ActivityLogService {
  private counter = 0;
  private messagesSource = new BehaviorSubject<LogMessage[]>([]);

  /** Observable stream of all log messages. */
  readonly messages$ = this.messagesSource.asObservable();

  /** Add a message to the activity log. */
  log(text: string, type: LogMessage['type'] = 'default'): void {
    const now = new Date();
    const timestamp = now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    const msg: LogMessage = { id: this.counter++, timestamp, text, type };
    const current = this.messagesSource.getValue();
    const updated = [...current, msg];

    if (updated.length > MAX_MESSAGES) {
      updated.splice(0, updated.length - MAX_MESSAGES);
    }

    this.messagesSource.next(updated);
  }
}

