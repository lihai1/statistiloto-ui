import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal, OnInit, ChangeDetectorRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { CardModule } from 'primeng/card';
import { AgentService, LlmConfigUpdate, LlmConfigRow, LlmConfigTestResponse } from '../../../core/api/agent.service';
import { LanguageService } from '../../../core/i18n/language.service';
import { ToastService } from '../../../shared/components/toast/toast.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { DatePipe } from '@angular/common';

interface ProviderMeta {
  value: string;
  label: string;
  /** Known/fixed base URL. null = user must supply (e.g. Ollama local). */
  defaultBaseUrl: string | null;
  /** Whether this provider requires an API key. */
  needsApiKey: boolean;
  /** Whether the base URL field should be shown (editable). */
  showsBaseUrl: boolean;
}

@Component({
  selector: 'app-llm-config',
  standalone: true,
  imports: [FormsModule, ButtonModule, InputTextModule, SelectModule, CardModule, TranslatePipe, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-card header="{{ 'admin.llmConfig' | translate }}" styleClass="admin-card">
      <!-- Saved configs list -->
      <div class="configs-section">
        <h4 class="section-title">{{ 'admin.llmConfig.savedConfigs' | translate }}</h4>
        @if (configs().length === 0) {
          <p class="empty">{{ 'admin.llmConfig.noSavedConfigs' | translate }}</p>
        } @else {
          <div class="configs-list">
            @for (c of configs(); track c.id) {
              <div class="config-card" [class.active]="c.is_active">
                <!-- Clickable header row -->
                <div class="config-header" (click)="toggleExpand(c.id)">
                  <div class="config-info">
                    <span class="config-name">{{ c.name || c.provider + '/' + c.model }}</span>
                    <span class="config-details">{{ c.provider }} · {{ c.model }}</span>
                    @if (c.is_active) {
                      <span class="active-badge">{{ 'admin.llmConfig.active' | translate }}</span>
                    }
                  </div>
                  <div class="config-header-right">
                    <div class="config-actions" (click)="$event.stopPropagation()">
                      <button class="secondary small" (click)="testConfig(c)"
                              [disabled]="testingId() === c.id">
                        @if (testingId() === c.id) {
                          <i class="pi pi-spinner pi-spin"></i>
                        } @else {
                          <i class="pi pi-check-circle"></i>
                        }
                        {{ 'admin.llmConfig.test' | translate }}
                      </button>
                      @if (!c.is_active) {
                        <button class="secondary small" (click)="activateConfig(c)">
                          {{ 'admin.llmConfig.activate' | translate }}
                        </button>
                        <button class="danger small" (click)="deleteConfig(c)">
                          <i class="pi pi-trash"></i>
                        </button>
                      }
                    </div>
                    <i class="pi" [class.pi-chevron-down]="expandedId() === c.id" [class.pi-chevron-left]="expandedId() !== c.id"></i>
                  </div>
                </div>

                <!-- Expandable details -->
                @if (expandedId() === c.id) {
                  <div class="config-details-expanded">
                    <div class="detail-row">
                      <span class="detail-label">{{ 'admin.llmConfig.name' | translate }}</span>
                      <span class="detail-value">{{ c.name || '—' }}</span>
                    </div>
                    <div class="detail-row">
                      <span class="detail-label">{{ 'admin.llmConfig.provider' | translate }}</span>
                      <span class="detail-value">{{ c.provider }}</span>
                    </div>
                    <div class="detail-row">
                      <span class="detail-label">{{ 'admin.llmConfig.model' | translate }}</span>
                      <span class="detail-value">{{ c.model }}</span>
                    </div>
                    <div class="detail-row">
                      <span class="detail-label">{{ 'admin.llmConfig.baseUrl' | translate }}</span>
                      <span class="detail-value">{{ c.base_url || '—' }}</span>
                    </div>
                    <div class="detail-row">
                      <span class="detail-label">{{ 'admin.llmConfig.apiKey' | translate }}</span>
                      <span class="detail-value">{{ maskApiKey(c.api_key) }}</span>
                    </div>
                    <div class="detail-row">
                      <span class="detail-label">{{ 'admin.llmConfig.timeout' | translate }}</span>
                      <span class="detail-value">{{ c.request_timeout_seconds }}s</span>
                    </div>
                    <div class="detail-row">
                      <span class="detail-label">{{ 'admin.llmConfig.updatedAt' | translate }}</span>
                      <span class="detail-value">{{ c.updated_at * 1000 | date: 'yyyy-MM-dd' }}</span>
                    </div>
                    @if (testResult() && testResult()!.id === c.id) {
                      <div class="test-result" [class.ok]="testResult()!.status === 'ok'" [class.err]="testResult()!.status === 'error'">
                        @if (testResult()!.status === 'ok') {
                          <i class="pi pi-check-circle"></i>
                          <span>{{ 'admin.llmConfig.testOk' | translate }}</span>
                          @if (testResult()!.response) {
                            <small class="test-response">{{ testResult()!.response }}</small>
                          }
                        } @else {
                          <i class="pi pi-times-circle"></i>
                          <span>{{ 'admin.llmConfig.testFailed' | translate }}</span>
                          @if (testResult()!.error) {
                            <small class="test-response">{{ testResult()!.error }}</small>
                          }
                        }
                      </div>
                    }
                  </div>
                }
              </div>
            }
          </div>
        }
      </div>

      <hr class="divider" />

      <!-- Create / edit form -->
      <h4 class="section-title">{{ 'admin.llmConfig.createNew' | translate }}</h4>
      <div class="config-form">
        <div class="form-row">
          <label for="name">{{ 'admin.llmConfig.name' | translate }}</label>
          <input pInputText id="name" type="text" [(ngModel)]="config.name"
                 placeholder="Ollama Llama3.1" />
        </div>

        <div class="form-row">
          <label for="provider">{{ 'admin.llmConfig.provider' | translate }}</label>
          <p-select
            inputId="provider"
            [options]="providers"
            optionLabel="label"
            optionValue="value"
            [(ngModel)]="config.provider"
            (onChange)="onProviderChange()"
          ></p-select>
        </div>

        <div class="form-row">
          <label for="model">{{ 'admin.llmConfig.model' | translate }}</label>
          @if (availableModels().length > 0) {
            <p-select
              inputId="model"
              [options]="availableModels()"
              [(ngModel)]="config.model"
              [filter]="true"
              [placeholder]="'admin.llmConfig.selectModel' | translate"
            ></p-select>
            <small class="form-hint">{{ 'admin.llmConfig.modelsLoaded' | translate:{ count: availableModels().length } }}</small>
          } @else {
            <input pInputText id="model" type="text" [(ngModel)]="config.model"
                   [placeholder]="'admin.llmConfig.typeModel' | translate" />
            @if (loadingModels()) {
              <small class="form-hint">{{ 'admin.llmConfig.loadingModels' | translate }}</small>
            } @else {
              <button class="link-btn" (click)="fetchModels()">
                {{ 'admin.llmConfig.fetchModels' | translate }}
              </button>
            }
          }
        </div>

        <!-- Base URL: only shown for Ollama (user-editable local address) -->
        @if (currentProviderMeta()?.showsBaseUrl) {
          <div class="form-row">
            <label for="baseUrl">{{ 'admin.llmConfig.baseUrl' | translate }}</label>
            <input pInputText id="baseUrl" type="text" [(ngModel)]="config.baseUrl"
                   [placeholder]="currentProviderMeta()?.defaultBaseUrl || 'http://ollama:11434'" />
            @if (currentProviderMeta()?.defaultBaseUrl) {
              <small class="form-hint">{{ 'admin.llmConfig.defaultUrlHint' | translate:{ url: currentProviderMeta()!.defaultBaseUrl! } }}</small>
            }
          </div>
        }

        <!-- API Key: shown for all providers except Ollama -->
        @if (currentProviderMeta()?.needsApiKey) {
          <div class="form-row">
            <label for="apiKey">{{ 'admin.llmConfig.apiKey' | translate }}</label>
            <input pInputText id="apiKey" type="password" [(ngModel)]="config.apiKey"
                   [placeholder]="'admin.llmConfig.enterApiKey' | translate"
                   autocomplete="off" name="llm-api-key-off" />
          </div>
        }

        <div class="form-row">
          <label for="timeout">{{ 'admin.llmConfig.timeout' | translate }}</label>
          <input pInputText id="timeout" type="number" [(ngModel)]="config.requestTimeoutSeconds" placeholder="300" min="10" max="3600" />
          <small class="form-hint">Seconds (10–3600). Small local models may need 300+.</small>
        </div>

        <div class="form-actions">
          <p-button
            [label]="'admin.llmConfig.saveAndActivate' | translate"
            (onClick)="saveAndActivate()"
            [loading]="saving()"
            styleClass="mr-2"
          ></p-button>
          <p-button
            [label]="'admin.llmConfig.saveOnly' | translate"
            (onClick)="saveOnly()"
            [loading]="saving()"
            severity="secondary"
          ></p-button>
        </div>

        @if (statusNote()) {
          <div class="status-note">
            <i class="pi pi-info-circle"></i>
            {{ statusNote() }}
          </div>
        }
      </div>
    </p-card>
  `,
  styles: [`
    .configs-section { margin-bottom: 16px; }
    .section-title { font-size: 15px; margin: 0 0 12px; color: var(--text); }
    .empty { color: var(--text-secondary); font-size: 13px; }
    .configs-list { display: flex; flex-direction: column; gap: 8px; }
    .config-card {
      border: 1px solid var(--border);
      border-radius: 6px;
      overflow: hidden;
    }
    .config-card.active { border-color: var(--success); }
    .config-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px;
      cursor: pointer;
      transition: background 0.15s;
    }
    .config-header:hover { background: var(--bg); }
    .config-card.active .config-header { background: rgba(56, 142, 60, 0.05); }
    .config-info { display: flex; flex-direction: column; gap: 2px; }
    .config-name { font-weight: 600; font-size: 14px; }
    .config-details { font-size: 12px; color: var(--text-secondary); }
    .active-badge {
      display: inline-block;
      font-size: 10px;
      color: var(--success);
      font-weight: 600;
      margin-top: 2px;
    }
    .config-header-right { display: flex; align-items: center; gap: 8px; }
    .config-header-right .pi { font-size: 12px; color: var(--text-secondary); }
    .config-actions { display: flex; gap: 6px; align-items: center; }
    .config-actions .small { font-size: 12px; padding: 4px 10px; }
    .danger { color: var(--danger); border-color: var(--danger); }
    .danger:hover { background: rgba(211,47,47,0.1); }
    .config-details-expanded {
      padding: 12px 16px;
      border-top: 1px solid var(--border);
      background: var(--bg);
    }
    .detail-row {
      display: flex;
      justify-content: space-between;
      padding: 4px 0;
      font-size: 13px;
    }
    .detail-label { color: var(--text-secondary); font-weight: 500; }
    .detail-value { color: var(--text); text-align: end; word-break: break-all; }
    .test-result {
      display: flex;
      align-items: flex-start;
      gap: 6px;
      padding: 8px 12px;
      margin-top: 8px;
      border-radius: 4px;
      font-size: 13px;
      flex-direction: column;
    }
    .test-result.ok { background: rgba(56, 142, 60, 0.1); color: var(--success); }
    .test-result.err { background: rgba(211, 47, 47, 0.1); color: var(--danger); }
    .test-result .pi { font-size: 14px; }
    .test-response { font-size: 11px; opacity: 0.8; word-break: break-word; }
    .divider { border: none; border-top: 1px solid var(--border); margin: 20px 0; }
    .config-form { display: flex; flex-direction: column; gap: 16px; }
    .form-row { display: flex; flex-direction: column; gap: 4px; }
    .form-row label { font-size: 13px; color: var(--text-secondary); font-weight: 500; }
    .form-hint { font-size: 11px; color: var(--text-secondary); opacity: 0.7; }
    .link-btn {
      background: transparent; border: none; color: var(--primary);
      font-size: 12px; cursor: pointer; padding: 2px 0; text-decoration: underline;
    }
    .form-actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    .status-note {
      display: flex; align-items: center; gap: 8px;
      padding: 12px; background: rgba(25, 118, 210, 0.08);
      border-radius: 6px; font-size: 13px; color: var(--primary); margin-top: 12px;
    }
  `],
})
export class LlmConfigComponent implements OnInit {
  private agentService = inject(AgentService);
  private toast = inject(ToastService);
  protected lang = inject(LanguageService);
  private cdr = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef);

  /** Provider metadata with known base URLs and field visibility. */
  providers: ProviderMeta[] = [
    {
      value: 'ollama',
      label: 'Ollama',
      defaultBaseUrl: 'http://ollama:11434',
      needsApiKey: false,
      showsBaseUrl: true,
    },
    {
      value: 'gemini',
      label: 'Gemini',
      defaultBaseUrl: 'https://generativelanguage.googleapis.com',
      needsApiKey: true,
      showsBaseUrl: false,
    },
    {
      value: 'openai',
      label: 'OpenAI',
      defaultBaseUrl: 'https://api.openai.com/v1',
      needsApiKey: true,
      showsBaseUrl: false,
    },
    {
      value: 'anthropic',
      label: 'Anthropic',
      defaultBaseUrl: 'https://api.anthropic.com',
      needsApiKey: true,
      showsBaseUrl: false,
    },
  ];

  config: LlmConfigUpdate = {
    provider: 'ollama',
    model: 'llama3.1:8b',
    name: '',
    baseUrl: '',
    apiKey: '',
    requestTimeoutSeconds: 300,
  };

  configs = signal<LlmConfigRow[]>([]);
  availableModels = signal<string[]>([]);
  loadingModels = signal(false);
  saving = signal(false);
  statusNote = signal<string | null>(null);
  expandedId = signal<number | null>(null);
  testingId = signal<number | null>(null);
  testResult = signal<LlmConfigTestResponse | null>(null);

  ngOnInit(): void {
    this.loadConfigs();
    this.agentService.getLlmConfig().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (cfg) => {
        this.config.provider = cfg.provider;
        this.config.model = cfg.model;
        if (cfg.base_url) this.config.baseUrl = cfg.base_url;
        if (cfg.api_key) this.config.apiKey = cfg.api_key;
        if (cfg.request_timeout_seconds) this.config.requestTimeoutSeconds = cfg.request_timeout_seconds;
        this.fetchModels();
        this.cdr.markForCheck();
      },
      error: () => {}, // silently ignore — may not be configured yet
    });
  }

  currentProviderMeta(): ProviderMeta | undefined {
    return this.providers.find(p => p.value === this.config.provider);
  }

  private loadConfigs(): void {
    this.agentService.listLlmConfigs().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => this.configs.set(res.configs),
      error: () => {}, // silently ignore
    });
  }

  onProviderChange(): void {
    // Clear the model and fetch models for the new provider.
    this.config.model = '';
    this.availableModels.set([]);
    // Set the known base URL as default for non-Ollama providers.
    const meta = this.currentProviderMeta();
    if (meta && !meta.showsBaseUrl && meta.defaultBaseUrl) {
      this.config.baseUrl = meta.defaultBaseUrl;
    } else if (meta && meta.showsBaseUrl && meta.defaultBaseUrl) {
      // For Ollama, set the default if empty.
      if (!this.config.baseUrl) this.config.baseUrl = meta.defaultBaseUrl;
    }
    // Clear API key when switching to Ollama.
    if (meta && !meta.needsApiKey) {
      this.config.apiKey = '';
    }
    this.fetchModels();
  }

  fetchModels(): void {
    this.loadingModels.set(true);
    this.agentService.listLlmModels(this.config.provider).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        this.availableModels.set(res.models);
        this.loadingModels.set(false);
        this.cdr.markForCheck();
      },
      error: () => {
        this.loadingModels.set(false);
      },
    });
  }

  saveAndActivate(): void {
    if (!this.config.model.trim()) {
      this.toast.error(this.lang.t('admin.llmConfig.typeModel'));
      return;
    }
    this.saving.set(true);
    this.agentService.updateLlmConfig(this.config).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        this.saving.set(false);
        this.statusNote.set(res.note || res.status);
        this.toast.success(this.lang.t('admin.llmConfig.saved'));
        this.loadConfigs();
      },
      error: (err) => {
        this.saving.set(false);
        this.toast.error(err.message ?? this.lang.t('common.error'));
      },
    });
  }

  saveOnly(): void {
    if (!this.config.model.trim()) {
      this.toast.error(this.lang.t('admin.llmConfig.typeModel'));
      return;
    }
    this.saving.set(true);
    this.agentService.createLlmConfig(this.config).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.saving.set(false);
        this.statusNote.set(this.lang.t('admin.llmConfig.savedNotActive'));
        this.toast.success(this.lang.t('admin.llmConfig.saved'));
        this.loadConfigs();
      },
      error: (err) => {
        this.saving.set(false);
        this.toast.error(err.message ?? this.lang.t('common.error'));
      },
    });
  }

  activateConfig(c: LlmConfigRow): void {
    this.agentService.activateLlmConfig(c.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.toast.success(this.lang.t('admin.llmConfig.activated'));
        this.loadConfigs();
        this.config.provider = c.provider;
        this.config.model = c.model;
        this.config.baseUrl = c.base_url;
        this.config.apiKey = c.api_key;
        this.config.requestTimeoutSeconds = c.request_timeout_seconds;
        this.config.name = c.name;
        this.fetchModels();
        this.cdr.markForCheck();
      },
      error: (err) => this.toast.error(err.message ?? this.lang.t('common.error')),
    });
  }

  deleteConfig(c: LlmConfigRow): void {
    if (!confirm(this.lang.t('admin.llmConfig.deleteConfirm'))) return;
    this.agentService.deleteLlmConfig(c.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.toast.success(this.lang.t('admin.llmConfig.deleted'));
        this.loadConfigs();
      },
      error: (err) => this.toast.error(err.message ?? this.lang.t('common.error')),
    });
  }

  testConfig(c: LlmConfigRow): void {
    this.testingId.set(c.id);
    this.testResult.set(null);
    this.agentService.testLlmConfig(c.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        this.testingId.set(null);
        this.testResult.set(res);
        // Auto-expand the card to show the result.
        if (this.expandedId() !== c.id) this.expandedId.set(c.id);
        if (res.status === 'ok') {
          this.toast.success(this.lang.t('admin.llmConfig.testOk'));
        } else {
          this.toast.error(this.lang.t('admin.llmConfig.testFailed'));
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.testingId.set(null);
        this.testResult.set({ status: 'error', id: c.id, error: err.message ?? 'Request failed' });
        if (this.expandedId() !== c.id) this.expandedId.set(c.id);
        this.cdr.markForCheck();
      },
    });
  }

  toggleExpand(id: number): void {
    this.expandedId.update(current => current === id ? null : id);
  }

  maskApiKey(key: string): string {
    if (!key) return '—';
    if (key.length <= 8) return '••••';
    return key.slice(0, 4) + '••••••••' + key.slice(-4);
  }
}
