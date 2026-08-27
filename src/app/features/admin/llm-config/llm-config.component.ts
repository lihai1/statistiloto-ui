import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal, OnInit, ChangeDetectorRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { CardModule } from 'primeng/card';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { AgentService, LlmConfigUpdate, LlmConfigRow, LlmConfigTestResponse, LlmModelOption } from '../../../core/api/agent.service';
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
  imports: [FormsModule, ButtonModule, InputTextModule, SelectModule, CardModule, ToggleSwitchModule, TranslatePipe, DatePipe],
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
                    <!-- Edit button moved inside the expanded card -->
                    <div class="detail-actions" (click)="$event.stopPropagation()">
                      <button class="secondary small" (click)="editConfig(c)">
                        <i class="pi pi-pencil"></i>
                        {{ 'admin.llmConfig.edit' | translate }}
                      </button>
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

      <!-- Free-tier LLM toggle -->
      <div class="free-tier-section">
        <h4 class="section-title">{{ 'admin.llmConfig.freeTierLlm' | translate }}</h4>
        <div class="toggle-row">
          @if (freeLlmLoading()) {
            <i class="pi pi-spinner pi-spin"></i>
          } @else {
            <p-toggleswitch
              [(ngModel)]="freeLlmEnabled"
              (onChange)="onFreeLlmToggle()"
              [disabled]="freeLlmSaving()"
            ></p-toggleswitch>
            <span class="toggle-status">
              @if (freeLlmEnabled) {
                {{ 'admin.llmConfig.freeTierLlmEnabled' | translate }}
              } @else {
                {{ 'admin.llmConfig.freeTierLlmDisabled' | translate }}
              }
            </span>
          }
        </div>
        <p class="toggle-hint">{{ 'admin.llmConfig.freeTierLlmHint' | translate }}</p>
      </div>

      <hr class="divider" />

      <!-- Create / edit form -->
      <h4 class="section-title">
        @if (editingId()) {
          {{ 'admin.llmConfig.editConfig' | translate }}
        } @else {
          {{ 'admin.llmConfig.createNew' | translate }}
        }
      </h4>
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
              optionLabel="name"
              optionValue="name"
              [(ngModel)]="config.model"
              [filter]="true"
              [filterBy]="'name'"
              [placeholder]="'admin.llmConfig.selectModel' | translate"
            >
              <!-- Dropdown item: model name + size + capability tags -->
              <ng-template #item let-option>
                <div class="model-option">
                  <span class="model-option-name">{{ option.name }}</span>
                  @if (formatSize(option.size)) {
                    <span class="model-option-size">{{ formatSize(option.size) }}</span>
                  }
                  @for (tag of capabilityTags(option.capabilities); track tag) {
                    <span class="cap-tag" [class]="'cap-tag-' + tag">{{ tagLabel(tag) | translate }}</span>
                  }
                </div>
              </ng-template>
              <!-- Selected value display -->
              <ng-template #selectedItem let-option>
                <div class="model-option">
                  <span class="model-option-name">{{ option.name }}</span>
                  @if (formatSize(option.size)) {
                    <span class="model-option-size">{{ formatSize(option.size) }}</span>
                  }
                  @for (tag of capabilityTags(option.capabilities); track tag) {
                    <span class="cap-tag" [class]="'cap-tag-' + tag">{{ tagLabel(tag) | translate }}</span>
                  }
                </div>
              </ng-template>
            </p-select>
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
          @if (editingId()) {
            <p-button
              [label]="'admin.llmConfig.update' | translate"
              (onClick)="updateConfig()"
              [loading]="saving()"
              styleClass="mr-2"
            ></p-button>
            <p-button
              [label]="'admin.llmConfig.cancel' | translate"
              (onClick)="cancelEdit()"
              severity="secondary"
            ></p-button>
          } @else {
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
          }
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
      gap: 8px;
      padding: 12px;
      cursor: pointer;
      transition: background 0.15s;
    }
    .config-header:hover { background: var(--bg); }
    .config-card.active .config-header { background: rgba(56, 142, 60, 0.05); }
    .config-info { display: flex; flex-direction: column; gap: 2px; flex: 0 1 auto; min-width: 0; overflow: hidden; }
    .config-name { font-weight: 600; font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .config-details { font-size: 12px; color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .active-badge {
      display: inline-block;
      font-size: 10px;
      color: var(--success);
      font-weight: 600;
      margin-top: 2px;
    }
    .config-header-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
    .config-header-right .pi { font-size: 12px; color: var(--text-secondary); }
    .config-actions { display: flex; gap: 4px; align-items: center; flex-wrap: nowrap; }
    .config-actions .small {
      font-size: 12px;
      padding: 4px 8px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      min-height: 38px;
      line-height: 1.2;
      white-space: normal;
      max-width: 80px;
      word-break: keep-all;
      text-align: center;
    }
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
    .detail-actions {
      display: flex;
      justify-content: flex-end;
      gap: 6px;
      margin-top: 12px;
      padding-top: 8px;
      border-top: 1px solid var(--border);
    }
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
    .free-tier-section { margin-bottom: 4px; }
    .toggle-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 0;
    }
    .toggle-status { font-size: 14px; font-weight: 500; color: var(--text); }
    .toggle-hint {
      font-size: 12px;
      color: var(--text-secondary);
      opacity: 0.8;
      margin: 4px 0 0;
      line-height: 1.5;
    }
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
  availableModels = signal<LlmModelOption[]>([]);
  loadingModels = signal(false);
  saving = signal(false);
  statusNote = signal<string | null>(null);
  expandedId = signal<number | null>(null);
  editingId = signal<number | null>(null);
  testingId = signal<number | null>(null);
  testResult = signal<LlmConfigTestResponse | null>(null);

  // Free-tier LLM toggle state.
  freeLlmEnabled = false;
  freeLlmLoading = signal(false);
  freeLlmSaving = signal(false);

  ngOnInit(): void {
    this.loadConfigs();
    this.loadFreeLlmToggle();
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

  private loadFreeLlmToggle(): void {
    this.freeLlmLoading.set(true);
    this.agentService.getFreeLlmToggle().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        this.freeLlmEnabled = res.enabled;
        this.freeLlmLoading.set(false);
        this.cdr.markForCheck();
      },
      error: () => {
        this.freeLlmLoading.set(false);
      },
    });
  }

  onFreeLlmToggle(): void {
    this.freeLlmSaving.set(true);
    this.agentService.setFreeLlmToggle(this.freeLlmEnabled).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        this.freeLlmEnabled = res.enabled;
        this.freeLlmSaving.set(false);
        this.toast.success(
          this.freeLlmEnabled
            ? this.lang.t('admin.llmConfig.freeTierLlmEnabled')
            : this.lang.t('admin.llmConfig.freeTierLlmDisabled')
        );
        this.cdr.markForCheck();
      },
      error: (err) => {
        // Revert the toggle to the last known server state.
        this.freeLlmSaving.set(false);
        this.loadFreeLlmToggle();
        this.toast.error(err.message ?? this.lang.t('common.error'));
      },
    });
  }

  onProviderChange(): void {
    // Clear the model and fetch models for the new provider.
    this.config.model = '';
    this.availableModels.set([]);
    // Reset base URL to the provider's default on provider switch.
    // This ensures switching from Gemini (https://...) to Ollama doesn't
    // leave the Ollama fetch pointing at the wrong server.
    const meta = this.currentProviderMeta();
    if (meta && meta.defaultBaseUrl) {
      this.config.baseUrl = meta.defaultBaseUrl;
    }
    // Clear API key when switching to a provider that doesn't need one.
    if (meta && !meta.needsApiKey) {
      this.config.apiKey = '';
    }
    this.fetchModels();
  }

  fetchModels(): void {
    this.loadingModels.set(true);
    // For Ollama, pass the base URL from the form so the agent queries the
    // correct server even when a non-Ollama config is currently active.
    const meta = this.currentProviderMeta();
    const baseUrl = meta?.showsBaseUrl ? this.config.baseUrl : undefined;
    this.agentService.listLlmModels(this.config.provider, baseUrl).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
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

  editConfig(c: LlmConfigRow): void {
    // Load the config into the form for editing.
    this.editingId.set(c.id);
    this.config.provider = c.provider;
    this.config.model = c.model;
    this.config.name = c.name;
    this.config.baseUrl = c.base_url;
    this.config.apiKey = c.api_key;
    this.config.requestTimeoutSeconds = c.request_timeout_seconds;
    this.statusNote.set(null);
    this.fetchModels();
    this.cdr.markForCheck();
  }

  cancelEdit(): void {
    this.editingId.set(null);
    this.statusNote.set(null);
    // Reset the form to defaults.
    this.config = {
      provider: 'ollama',
      model: '',
      name: '',
      baseUrl: '',
      apiKey: '',
      requestTimeoutSeconds: 300,
    };
    this.availableModels.set([]);
    this.cdr.markForCheck();
  }

  updateConfig(): void {
    const id = this.editingId();
    if (!id) return;
    if (!this.config.model.trim()) {
      this.toast.error(this.lang.t('admin.llmConfig.typeModel'));
      return;
    }
    this.saving.set(true);
    this.agentService.updateStoredLlmConfig(id, this.config).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        this.saving.set(false);
        this.statusNote.set(this.lang.t('admin.llmConfig.updated'));
        this.toast.success(this.lang.t('admin.llmConfig.updated'));
        this.editingId.set(null);
        this.loadConfigs();
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.saving.set(false);
        this.toast.error(err.message ?? this.lang.t('common.error'));
      },
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

  /** Formats a model size in bytes as a human-readable string (e.g. "4.7 GB"). Returns '' for 0/unknown. */
  formatSize(bytes: number | undefined): string {
    if (!bytes || bytes <= 0) return '';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let i = 0;
    let v = bytes;
    while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
    // Drop trailing 0 for GB+ (e.g. "4.7 GB"), keep one decimal.
    return `${v >= 100 ? Math.round(v) : v.toFixed(1)} ${units[i]}`;
  }

  /** Ollama capability keys we surface as tags, in display order. */
  private static readonly CAPABILITY_KEYS = ['embedding', 'vision', 'tools', 'thinking'] as const;
  /** Maps Ollama capability strings to their i18n key suffix. */
  private static readonly CAPABILITY_KEY_MAP: Record<string, string> = {
    embedding: 'embedding',
    vision: 'vision',
    tools: 'tools',
    thinking: 'thinking',
  };

  /** Returns the ordered list of supported capability keys present in `caps`. */
  capabilityTags(caps: string[] | undefined): string[] {
    if (!caps) return [];
    const set = new Set(caps.map(c => c.toLowerCase()));
    return LlmConfigComponent.CAPABILITY_KEYS.filter(k => set.has(k));
  }

  /** Returns the i18n key for a capability tag. */
  tagLabel(tag: string): string {
    const suffix = LlmConfigComponent.CAPABILITY_KEY_MAP[tag] ?? tag;
    return `admin.llmConfig.cap.${suffix}`;
  }
}
