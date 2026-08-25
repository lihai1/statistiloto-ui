import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface AgentChatContext {
  page?: string;           // 'statistics' | 'analyze' | 'generate' | 'assistant'
  numbers?: number[];      // selected numbers (analyze page)
  groupSize?: number;      // current group size (statistics page)
  ordering?: 'hot' | 'cold';
  archiveWindow?: { from?: string; to?: string; lastDraws?: number };
}

export interface ReindexResponse {
  status: string;
  indexed: number;
  skipped: number;
  total_chunks: number;
  files: string[];
}

export interface AgentChatRequest {
  sessionId: string;
  message: string;
  intent?: string;
  context?: AgentChatContext;
  configId?: number;
}

export interface AgentApproveRequest {
  sessionId: string;
  approved: boolean;
  edited?: string;
}

export interface AgentChatResponse {
  response?: string;
  thread_id?: string;
  paused?: boolean;
}

export interface LlmConfig {
  provider: string;
  model: string;
  base_url?: string;
  api_key?: string;
  request_timeout_seconds?: number;
}

export interface LlmConfigUpdate {
  provider: string;
  model: string;
  name?: string;
  baseUrl?: string;
  apiKey?: string;
  requestTimeoutSeconds?: number;
}

export interface LlmConfigUpdateResponse {
  provider: string;
  model: string;
  status: string;
  note: string;
}

export interface LlmConfigRow {
  id: number;
  name: string;
  provider: string;
  model: string;
  base_url: string;
  api_key: string;
  request_timeout_seconds: number;
  is_active: boolean;
  updated_at: number;
}

export interface AgentMessage {
  role: 'user' | 'assistant';
  content: string;
  paused?: boolean;
  threadId?: string;
  timestamp: number;
}

export interface TokenUsageRow {
  user_sub: string;
  tier: string;
  provider: string;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  cost_usd: number;
  calls: number;
}

export interface AuditLogRow {
  user_sub: string;
  tier: string;
  action: string;
  details: any;
  ts: number;
}

export interface ChatSession {
  session_id: string;
  thread_id: string;
  title: string;
  last_message: string;
  message_count: number;
  created_at: number;
  updated_at: number;
}

export interface ChatSessionListResponse {
  sessions: ChatSession[];
  limit: number | null;  // null = unlimited (admin)
  tier: string;
}

export interface ChatSessionMessagesResponse {
  session_id: string;
  messages: { role: string; content: string; timestamp: number }[];
}

/** A single model entry returned by GET /llm-models. */
export interface LlmModelOption {
  name: string;
  /** Model size in bytes (Ollama only; 0 when unknown). */
  size: number;
  /** Ollama-reported capabilities (e.g. 'embedding','vision','tools','thinking'). Empty for non-Ollama providers. */
  capabilities: string[];
}

export interface LlmModelsResponse {
  provider: string;
  models: LlmModelOption[];
}

export interface LlmConfigTestResponse {
  status: 'ok' | 'error';
  id: number;
  response?: string;
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class AgentService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl + '/agent';

  chat(req: AgentChatRequest): Observable<AgentChatResponse> {
    return this.http.post<AgentChatResponse>(`${this.base}/chat`, req);
  }

  approve(req: AgentApproveRequest): Observable<AgentChatResponse> {
    return this.http.post<AgentChatResponse>(`${this.base}/approve`, req);
  }

  getLlmConfig(): Observable<LlmConfig> {
    return this.http.get<LlmConfig>(`${this.base}/llm-config`);
  }

  updateLlmConfig(req: LlmConfigUpdate): Observable<LlmConfigUpdateResponse> {
    return this.http.put<LlmConfigUpdateResponse>(`${this.base}/llm-config`, req);
  }

  listLlmConfigs(): Observable<{ configs: LlmConfigRow[] }> {
    return this.http.get<{ configs: LlmConfigRow[] }>(`${this.base}/llm-configs`);
  }

  createLlmConfig(req: LlmConfigUpdate): Observable<{ status: string; id: number; name: string }> {
    return this.http.post<{ status: string; id: number; name: string }>(`${this.base}/llm-configs`, req);
  }

  updateStoredLlmConfig(configId: number, req: LlmConfigUpdate): Observable<{ status: string; id: number; name: string }> {
    return this.http.put<{ status: string; id: number; name: string }>(`${this.base}/llm-configs/${configId}`, req);
  }

  activateLlmConfig(configId: number): Observable<{ status: string; id: number }> {
    return this.http.put<{ status: string; id: number }>(`${this.base}/llm-configs/${configId}/activate`, {});
  }

  deleteLlmConfig(configId: number): Observable<{ status: string; id: number }> {
    return this.http.delete<{ status: string; id: number }>(`${this.base}/llm-configs/${configId}`);
  }

  getHealth(): Observable<{ status: string }> {
    return this.http.get<{ status: string }>(`${this.base}/health`);
  }

  getTokenUsage(): Observable<{ rows: TokenUsageRow[] }> {
    return this.http.get<{ rows: TokenUsageRow[] }>(`${this.base}/token-usage`);
  }

  getAuditLog(limit: number = 50): Observable<{ rows: AuditLogRow[] }> {
    return this.http.get<{ rows: AuditLogRow[] }>(`${this.base}/audit-log?limit=${limit}`);
  }

  reindexDocs(): Observable<ReindexResponse> {
    return this.http.post<ReindexResponse>(`${this.base}/reindex`, {});
  }

  listLlmModels(provider: string, baseUrl?: string): Observable<LlmModelsResponse> {
    let url = `${this.base}/llm-models?provider=${encodeURIComponent(provider)}`;
    if (baseUrl) url += `&base_url=${encodeURIComponent(baseUrl)}`;
    return this.http.get<LlmModelsResponse>(url);
  }

  testLlmConfig(configId: number): Observable<LlmConfigTestResponse> {
    return this.http.post<LlmConfigTestResponse>(`${this.base}/llm-configs/${configId}/test`, {});
  }

  listSessions(): Observable<ChatSessionListResponse> {
    return this.http.get<ChatSessionListResponse>(`${this.base}/sessions`);
  }

  getSessionMessages(sessionId: string): Observable<ChatSessionMessagesResponse> {
    return this.http.get<ChatSessionMessagesResponse>(`${this.base}/sessions/${encodeURIComponent(sessionId)}`);
  }

  deleteSession(sessionId: string): Observable<{ status: string; session_id: string }> {
    return this.http.delete<{ status: string; session_id: string }>(`${this.base}/sessions/${encodeURIComponent(sessionId)}`);
  }

  deleteAllSessions(): Observable<{ status: string; count: number }> {
    return this.http.delete<{ status: string; count: number }>(`${this.base}/sessions`);
  }

  /** Generate a random session ID for a new conversation. */
  generateSessionId(): string {
    return 'session-' + Date.now() + '-' + Math.random().toString(36).substring(2, 8);
  }
}
