import { TestBed, ComponentFixture } from '@angular/core/testing';
import { of } from 'rxjs';
import { LlmConfigComponent } from './llm-config.component';
import { AgentService, LlmConfig, LlmConfigUpdateResponse } from '../../../core/api/agent.service';

describe('LlmConfigComponent', () => {
  let fixture: ComponentFixture<LlmConfigComponent>;
  let component: LlmConfigComponent;
  let mockAgentService: jasmine.SpyObj<AgentService>;

  beforeEach(async () => {
    mockAgentService = jasmine.createSpyObj<AgentService>('AgentService', [
      'getLlmConfig',
      'updateLlmConfig',
      'listLlmConfigs',
      'listLlmModels',
      'createLlmConfig',
      'updateStoredLlmConfig',
      'activateLlmConfig',
      'deleteLlmConfig',
      'testLlmConfig',
      'getFreeLlmToggle',
      'setFreeLlmToggle',
      'generateSessionId',
    ]);
    mockAgentService.getLlmConfig.and.returnValue(of({ provider: 'ollama', model: 'llama3.1:8b' } as LlmConfig));
    mockAgentService.updateLlmConfig.and.returnValue(
      of({ provider: 'ollama', model: 'llama3.1:8b', status: 'ok', note: 'Saved' } as LlmConfigUpdateResponse),
    );
    mockAgentService.listLlmConfigs.and.returnValue(of({ configs: [] }));
    mockAgentService.listLlmModels.and.returnValue(of({
      provider: 'ollama',
      models: [
        { name: 'llama3.1:8b', size: 4661214619, capabilities: ['completion', 'tools'] },
        { name: 'nomic-embed-text', size: 273268736, capabilities: ['embedding'] },
      ],
    }));
    mockAgentService.createLlmConfig.and.returnValue(of({ status: 'created', id: 1, name: 'Test' }));
    mockAgentService.updateStoredLlmConfig.and.returnValue(of({ status: 'updated', id: 1, name: 'Test' }));
    mockAgentService.testLlmConfig.and.returnValue(of({ status: 'ok', id: 1, response: 'pong' }));
    mockAgentService.getFreeLlmToggle.and.returnValue(of({ enabled: false }));
    mockAgentService.setFreeLlmToggle.and.returnValue(of({ enabled: true, updated_by: 'admin-1' }));
    mockAgentService.generateSessionId.and.returnValue('session-llm-1');

    await TestBed.configureTestingModule({
      imports: [LlmConfigComponent],
      providers: [{ provide: AgentService, useValue: mockAgentService }],
    }).compileComponents();

    fixture = TestBed.createComponent(LlmConfigComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load the LLM config on init', () => {
    expect(mockAgentService.getLlmConfig).toHaveBeenCalledTimes(1);
    expect(component.config.provider).toBe('ollama');
    expect(component.config.model).toBe('llama3.1:8b');
  });

  it('should have 4 providers (ollama, gemini, openai, anthropic)', () => {
    expect(component.providers.length).toBe(4);
    expect(component.providers.map(p => p.value)).toEqual(['ollama', 'gemini', 'openai', 'anthropic']);
  });

  it('ollama should show base URL but not API key', () => {
    const meta = component.providers.find(p => p.value === 'ollama');
    expect(meta?.showsBaseUrl).toBe(true);
    expect(meta?.needsApiKey).toBe(false);
  });

  it('gemini should need API key but not show base URL', () => {
    const meta = component.providers.find(p => p.value === 'gemini');
    expect(meta?.showsBaseUrl).toBe(false);
    expect(meta?.needsApiKey).toBe(true);
    expect(meta?.defaultBaseUrl).toBe('https://generativelanguage.googleapis.com');
  });

  it('openai should need API key with known base URL', () => {
    const meta = component.providers.find(p => p.value === 'openai');
    expect(meta?.needsApiKey).toBe(true);
    expect(meta?.defaultBaseUrl).toBe('https://api.openai.com/v1');
  });

  it('anthropic should need API key with known base URL', () => {
    const meta = component.providers.find(p => p.value === 'anthropic');
    expect(meta?.needsApiKey).toBe(true);
    expect(meta?.defaultBaseUrl).toBe('https://api.anthropic.com');
  });

  it('fetchModels should pass base_url for Ollama provider', () => {
    component.config.provider = 'ollama';
    component.config.baseUrl = 'http://my-ollama:11434';
    mockAgentService.listLlmModels.calls.reset();
    component.fetchModels();
    expect(mockAgentService.listLlmModels.calls.mostRecent().args[0]).toBe('ollama');
    expect(mockAgentService.listLlmModels.calls.mostRecent().args[1]).toBe('http://my-ollama:11434');
  });

  it('fetchModels should not pass base_url for non-Ollama providers', () => {
    component.config.provider = 'gemini';
    component.config.baseUrl = 'https://generativelanguage.googleapis.com';
    mockAgentService.listLlmModels.calls.reset();
    component.fetchModels();
    expect(mockAgentService.listLlmModels.calls.mostRecent().args[0]).toBe('gemini');
    expect(mockAgentService.listLlmModels.calls.mostRecent().args[1]).toBeUndefined();
  });

  it('onProviderChange should reset baseUrl to provider default', () => {
    // Start with Gemini's base URL
    component.config.provider = 'gemini';
    component.config.baseUrl = 'https://generativelanguage.googleapis.com';
    // Switch to Ollama
    component.config.provider = 'ollama';
    component.onProviderChange();
    expect(component.config.baseUrl).toBe('http://ollama:11434');
  });

  it('saveAndActivate() should call AgentService.updateLlmConfig()', () => {
    component.saveAndActivate();

    expect(mockAgentService.updateLlmConfig).toHaveBeenCalledTimes(1);
    const arg = mockAgentService.updateLlmConfig.calls.mostRecent().args[0];
    expect(arg.provider).toBe(component.config.provider);
    expect(arg.model).toBe(component.config.model);
  });

  it('saveAndActivate() should set saving to false after success', () => {
    component.saveAndActivate();
    expect(component.saving()).toBe(false);
  });

  it('saveAndActivate() should set the status note from the response', () => {
    component.saveAndActivate();
    expect(component.statusNote()).toBe('Saved');
  });

  it('toggleExpand should toggle expandedId', () => {
    expect(component.expandedId()).toBeNull();
    component.toggleExpand(5);
    expect(component.expandedId()).toBe(5);
    component.toggleExpand(5);
    expect(component.expandedId()).toBeNull();
  });

  it('maskApiKey should mask keys', () => {
    expect(component.maskApiKey('')).toBe('—');
    expect(component.maskApiKey('short')).toBe('••••');
    expect(component.maskApiKey('sk-abcdefgh12345678')).toContain('••••');
    expect(component.maskApiKey('sk-abcdefgh12345678')).toContain('sk-a');
    expect(component.maskApiKey('sk-abcdefgh12345678')).toContain('5678');
  });

  it('availableModels should hold model options with size and capabilities after fetch', () => {
    expect(component.availableModels().length).toBe(2);
    expect(component.availableModels()[0]).toEqual({ name: 'llama3.1:8b', size: 4661214619, capabilities: ['completion', 'tools'] });
  });

  it('capabilityTags should return supported capabilities in canonical order', () => {
    expect(component.capabilityTags(['completion', 'tools'])).toEqual(['tools']);
    expect(component.capabilityTags(['thinking', 'vision', 'tools', 'embedding'])).toEqual(['embedding', 'vision', 'tools', 'thinking']);
    // case-insensitive
    expect(component.capabilityTags(['VISION'])).toEqual(['vision']);
  });

  it('capabilityTags should ignore unsupported capabilities', () => {
    expect(component.capabilityTags(['completion', 'insert'])).toEqual([]);
  });

  it('capabilityTags should handle undefined / empty', () => {
    expect(component.capabilityTags(undefined)).toEqual([]);
    expect(component.capabilityTags([])).toEqual([]);
  });

  it('tagLabel should return the i18n key for a capability', () => {
    expect(component.tagLabel('embedding')).toBe('admin.llmConfig.cap.embedding');
    expect(component.tagLabel('vision')).toBe('admin.llmConfig.cap.vision');
    expect(component.tagLabel('tools')).toBe('admin.llmConfig.cap.tools');
    expect(component.tagLabel('thinking')).toBe('admin.llmConfig.cap.thinking');
  });

  it('formatSize should format bytes human-readably', () => {
    expect(component.formatSize(0)).toBe('');
    expect(component.formatSize(undefined)).toBe('');
    expect(component.formatSize(500)).toBe('500 B');
    expect(component.formatSize(273268736)).toBe('261 MB');
    expect(component.formatSize(4661214619)).toBe('4.3 GB');
  });

  it('editConfig should load config into form and set editingId', () => {
    const row = {
      id: 42, name: 'My Ollama', provider: 'ollama', model: 'qwen3:8b',
      base_url: 'http://ollama:11434', api_key: '', request_timeout_seconds: 120,
      is_active: false, updated_at: 1700000000,
    } as any;
    component.editConfig(row);
    expect(component.editingId()).toBe(42);
    expect(component.config.provider).toBe('ollama');
    expect(component.config.model).toBe('qwen3:8b');
    expect(component.config.name).toBe('My Ollama');
    expect(component.config.baseUrl).toBe('http://ollama:11434');
    expect(component.config.requestTimeoutSeconds).toBe(120);
  });

  it('cancelEdit should reset editingId and form', () => {
    component.editingId.set(42);
    component.config.provider = 'gemini';
    component.cancelEdit();
    expect(component.editingId()).toBeNull();
    expect(component.config.provider).toBe('ollama');
    expect(component.config.model).toBe('');
  });

  it('updateConfig should call updateStoredLlmConfig and clear editingId on success', () => {
    component.editingId.set(5);
    component.config.model = 'qwen3:8b';
    component.updateConfig();
    expect(mockAgentService.updateStoredLlmConfig).toHaveBeenCalledTimes(1);
    expect(mockAgentService.updateStoredLlmConfig.calls.mostRecent().args[0]).toBe(5);
    expect(component.editingId()).toBeNull();
    expect(component.saving()).toBe(false);
  });

  it('updateConfig should not call service when not editing', () => {
    component.editingId.set(null);
    component.updateConfig();
    expect(mockAgentService.updateStoredLlmConfig).not.toHaveBeenCalled();
  });

  it('updateConfig should show error toast when model is empty', () => {
    component.editingId.set(5);
    component.config.model = '';
    component.updateConfig();
    expect(mockAgentService.updateStoredLlmConfig).not.toHaveBeenCalled();
  });

  // ── Free-tier LLM toggle ─────────────────────────────────────────────

  it('should load the free-tier LLM toggle on init', () => {
    expect(mockAgentService.getFreeLlmToggle).toHaveBeenCalledTimes(1);
    expect(component.freeLlmEnabled).toBe(false);
    expect(component.freeLlmLoading()).toBe(false);
  });

  it('onFreeLlmToggle should call setFreeLlmToggle with the new value', () => {
    component.freeLlmEnabled = true;
    component.onFreeLlmToggle();
    expect(mockAgentService.setFreeLlmToggle).toHaveBeenCalledTimes(1);
    expect(mockAgentService.setFreeLlmToggle.calls.mostRecent().args[0]).toBe(true);
  });

  it('onFreeLlmToggle should update freeLlmEnabled from the response', () => {
    component.freeLlmEnabled = true;
    component.onFreeLlmToggle();
    expect(component.freeLlmEnabled).toBe(true);
    expect(component.freeLlmSaving()).toBe(false);
  });

  it('onFreeLlmToggle should set saving to false after success', () => {
    component.freeLlmEnabled = false;
    component.onFreeLlmToggle();
    expect(component.freeLlmSaving()).toBe(false);
  });
});
