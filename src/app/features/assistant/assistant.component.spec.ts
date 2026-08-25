import { TestBed, ComponentFixture } from '@angular/core/testing';
import { of } from 'rxjs';
import { AssistantComponent } from './assistant.component';
import { AgentService } from '../../core/api/agent.service';

describe('AssistantComponent', () => {
  let fixture: ComponentFixture<AssistantComponent>;
  let component: AssistantComponent;
  let mockAgentService: jasmine.SpyObj<AgentService>;

  beforeEach(async () => {
    mockAgentService = jasmine.createSpyObj<AgentService>('AgentService', [
      'chat',
      'approve',
      'generateSessionId',
      'listSessions',
      'getSessionMessages',
      'deleteSession',
      'deleteAllSessions',
    ]);
    mockAgentService.generateSessionId.and.returnValue('session-assistant-1');
    mockAgentService.chat.and.returnValue(of({ response: 'ok', paused: false }));
    mockAgentService.approve.and.returnValue(of({ response: 'ok', paused: false }));
    mockAgentService.listSessions.and.returnValue(of({ sessions: [], limit: 1, tier: 'free' }));
    mockAgentService.deleteSession.and.returnValue(of({ status: 'deleted', session_id: 'x' }));
    mockAgentService.deleteAllSessions.and.returnValue(of({ status: 'deleted', count: 0 }));

    await TestBed.configureTestingModule({
      imports: [AssistantComponent],
      providers: [{ provide: AgentService, useValue: mockAgentService }],
    }).compileComponents();

    fixture = TestBed.createComponent(AssistantComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with a session ID from AgentService', () => {
    expect(component.activeSessionId()).toBeTruthy();
    expect(mockAgentService.generateSessionId).toHaveBeenCalled();
  });

  it('should load sessions on init', () => {
    expect(mockAgentService.listSessions).toHaveBeenCalledTimes(1);
    expect(component.sessions().length).toBe(0);
    expect(component.sessionLimit()).toBe(1);
  });

  it('newChat() should generate a new session ID', () => {
    const firstId = component.activeSessionId();
    mockAgentService.generateSessionId.and.returnValue('session-assistant-2');

    component.newChat();

    expect(component.activeSessionId()).toBe('session-assistant-2');
    expect(component.activeSessionId()).not.toBe(firstId);
  });
});
