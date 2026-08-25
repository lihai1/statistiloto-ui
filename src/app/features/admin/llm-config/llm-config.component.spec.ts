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
      'activateLlmConfig',
      'deleteLlmConfig',
      'testLlmConfig',
      'generateSessionId',
    ]);
    mockAgentService.getLlmConfig.and.returnValue(of({ provider: 'ollama', model: 'llama3.1:8b' } as LlmConfig));
    mockAgentService.updateLlmConfig.and.returnValue(
      of({ provider: 'ollama', model: 'llama3.1:8b', status: 'ok', note: 'Saved' } as LlmConfigUpdateResponse),
    );
    mockAgentService.listLlmConfigs.and.returnValue(of({ configs: [] }));
    mockAgentService.listLlmModels.and.returnValue(of({ provider: 'ollama', models: ['llama3.1:8b'] }));
    mockAgentService.createLlmConfig.and.returnValue(of({ status: 'created', id: 1, name: 'Test' }));
    mockAgentService.testLlmConfig.and.returnValue(of({ status: 'ok', id: 1, response: 'pong' }));
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
});
