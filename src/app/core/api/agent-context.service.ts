import { Injectable, signal } from '@angular/core';
import { AgentChatContext } from './agent.service';

/**
 * Shared service for contextual AI triggers.
 * Feature components call ask() to request the AI widget
 * to open with a pre-filled message and structured context.
 */
@Injectable({ providedIn: 'root' })
export class AgentContextService {
  readonly pendingMessage = signal<string | null>(null);
  readonly pendingContext = signal<AgentChatContext | null>(null);
  readonly openWidget = signal(false);

  /** Open the AI widget with a pre-filled contextual message. */
  ask(message: string, context?: AgentChatContext): void {
    this.pendingMessage.set(message);
    this.pendingContext.set(context ?? null);
    this.openWidget.set(true);
  }

  /** Called by the widget when it has consumed the pending message. */
  consume(): void {
    this.pendingMessage.set(null);
    this.pendingContext.set(null);
  }
}
