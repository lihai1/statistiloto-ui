import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AgentChatComponent } from '../../shared/components/agent-chat/agent-chat.component';
import { AgentService, ChatSession } from '../../core/api/agent.service';
import { LanguageService } from '../../core/i18n/language.service';
import { ToastService } from '../../shared/components/toast/toast.service';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-assistant',
  standalone: true,
  imports: [AgentChatComponent, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="assistant-page">
      <div class="assistant-header">
        <h2>{{ 'assistant.title' | translate }}</h2>
        <button class="new-chat-btn" (click)="newChat()">
          <i class="pi pi-plus"></i> {{ 'assistant.newChat' | translate }}
        </button>
      </div>

      <div class="assistant-body">
        <!-- Session history sidebar -->
        <aside class="session-sidebar">
          <div class="session-sidebar-header">
            <span class="sidebar-label">{{ 'assistant.history' | translate }}</span>
            @if (sessionLimit() !== null) {
              <span class="session-quota">
                {{ 'assistant.sessionLimit' | translate:{ limit: sessionLimit()! } }}
              </span>
            } @else {
              <span class="session-quota">{{ 'assistant.unlimited' | translate }}</span>
            }
          </div>

          <div class="session-list">
            @if (sessions().length === 0) {
              <p class="empty-history">{{ 'assistant.historyEmpty' | translate }}</p>
            } @else {
              @for (s of sessions(); track s.session_id) {
                <button
                  class="session-item"
                  [class.active]="s.session_id === activeSessionId()"
                  (click)="loadSession(s)"
                >
                  <span class="session-title">{{ s.title || s.last_message || s.session_id }}</span>
                  <span class="session-meta">{{ s.message_count }} {{ 'assistant.messages' | translate }}</span>
                  <span class="session-delete" (click)="deleteSession(s, $event)" aria-label="delete">
                    <i class="pi pi-trash"></i>
                  </span>
                </button>
              }
            }
          </div>

          @if (sessions().length > 0) {
            <button class="delete-all-btn" (click)="deleteAllSessions()">
              <i class="pi pi-trash"></i> {{ 'assistant.deleteAll' | translate }}
            </button>
          }
        </aside>

        <!-- Chat area -->
        <div class="assistant-chat-container">
          <app-agent-chat
            [sessionId]="activeSessionId()"
            [preloadedMessages]="preloadedMessages()"
            (messageSent)="onMessageSent()"
          />
        </div>
      </div>
    </section>
  `,
  styles: [`
    .assistant-page {
      display: flex;
      flex-direction: column;
      height: calc(100vh - 140px);
    }
    .assistant-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }
    .assistant-header h2 {
      margin: 0;
      font-size: 22px;
      color: var(--primary);
    }
    .new-chat-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      background: transparent;
      border: 1px solid var(--border);
      color: var(--text);
      padding: 8px 14px;
      border-radius: 6px;
      font-size: 14px;
      cursor: pointer;
    }
    .new-chat-btn:hover { border-color: var(--primary); color: var(--primary); }

    .assistant-body {
      flex: 1;
      display: flex;
      gap: 12px;
      min-height: 0;
    }

    .session-sidebar {
      width: 240px;
      flex-shrink: 0;
      background: var(--card-bg);
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .session-sidebar-header {
      padding: 12px;
      border-bottom: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .sidebar-label {
      font-size: 13px;
      font-weight: 600;
      color: var(--text);
    }
    .session-quota {
      font-size: 11px;
      color: var(--text-secondary);
    }
    .session-list {
      flex: 1;
      overflow-y: auto;
      padding: 4px;
    }
    .empty-history {
      padding: 16px 12px;
      font-size: 13px;
      color: var(--text-secondary);
      text-align: center;
    }
    .session-item {
      display: flex;
      flex-direction: column;
      gap: 2px;
      width: 100%;
      padding: 10px 12px;
      background: transparent;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      text-align: start;
      position: relative;
      transition: background 0.15s;
    }
    .session-item:hover { background: var(--bg); }
    .session-item.active {
      background: rgba(25, 118, 210, 0.08);
    }
    .session-title {
      font-size: 13px;
      color: var(--text);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      padding-left: 4px;
    }
    [dir="rtl"] .session-title { padding-left: 0; padding-right: 4px; }
    .session-meta {
      font-size: 11px;
      color: var(--text-secondary);
      padding-left: 4px;
    }
    [dir="rtl"] .session-meta { padding-left: 0; padding-right: 4px; }
    .session-delete {
      position: absolute;
      top: 8px;
      inset-inline-end: 8px;
      color: var(--text-secondary);
      font-size: 12px;
      cursor: pointer;
      padding: 2px 4px;
      border-radius: 4px;
      opacity: 0;
      transition: opacity 0.15s, color 0.15s;
    }
    .session-item:hover .session-delete { opacity: 1; }
    .session-delete:hover { color: var(--danger); }
    .delete-all-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 10px 12px;
      background: transparent;
      border: none;
      border-top: 1px solid var(--border);
      color: var(--danger);
      font-size: 13px;
      cursor: pointer;
    }
    .delete-all-btn:hover { background: rgba(211, 47, 47, 0.05); }

    .assistant-chat-container {
      flex: 1;
      background: var(--card-bg);
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08);
      overflow: hidden;
      min-width: 0;
    }

    @media (max-width: 768px) {
      .assistant-body { flex-direction: column; }
      .session-sidebar {
        width: 100%;
        max-height: 200px;
      }
    }
  `],
})
export class AssistantComponent implements OnInit {
  private agentService = inject(AgentService);
  private toast = inject(ToastService);
  protected lang = inject(LanguageService);
  private destroyRef = inject(DestroyRef);

  activeSessionId = signal(this.agentService.generateSessionId());
  sessions = signal<ChatSession[]>([]);
  sessionLimit = signal<number | null>(null);
  preloadedMessages = signal<{ role: 'user' | 'assistant'; content: string; timestamp: number }[] | null>(null);

  ngOnInit(): void {
    this.loadSessionList();
  }

  private loadSessionList(): void {
    this.agentService.listSessions().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        this.sessions.set(res.sessions);
        this.sessionLimit.set(res.limit);
      },
      error: () => {
        // Silently ignore — history may not be available yet.
      },
    });
  }

  newChat(): void {
    this.activeSessionId.set(this.agentService.generateSessionId());
    this.preloadedMessages.set(null);
  }

  loadSession(session: ChatSession): void {
    if (session.session_id === this.activeSessionId() && this.preloadedMessages() !== null) return;
    this.activeSessionId.set(session.session_id);
    this.preloadedMessages.set(null); // clear until loaded
    this.agentService.getSessionMessages(session.session_id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        const msgs = res.messages.map((m) => ({
          role: (m.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
          content: m.content,
          timestamp: m.timestamp,
        }));
        this.preloadedMessages.set(msgs);
      },
      error: (err) => {
        this.toast.error(err.message ?? this.lang.t('common.connectionError'));
      },
    });
  }

  deleteSession(session: ChatSession, event: Event): void {
    event.stopPropagation();
    if (!confirm(this.lang.t('assistant.deleteConfirm'))) return;
    this.agentService.deleteSession(session.session_id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.sessions.update((list) => list.filter((s) => s.session_id !== session.session_id));
        if (session.session_id === this.activeSessionId()) this.newChat();
        this.toast.success(this.lang.t('assistant.deleteSession'));
      },
      error: (err) => this.toast.error(err.message ?? this.lang.t('common.error')),
    });
  }

  deleteAllSessions(): void {
    if (!confirm(this.lang.t('assistant.deleteAllConfirm'))) return;
    this.agentService.deleteAllSessions().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.sessions.set([]);
        this.newChat();
        this.toast.success(this.lang.t('assistant.deleteAll'));
      },
      error: (err) => this.toast.error(err.message ?? this.lang.t('common.error')),
    });
  }

  /** Called when a message is sent in the chat — refresh the session list. */
  onMessageSent(): void {
    this.loadSessionList();
  }
}
