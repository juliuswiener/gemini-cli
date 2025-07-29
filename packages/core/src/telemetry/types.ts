/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GenerateContentResponseUsageMetadata } from '@google/genai';
import { Config } from '../config/config.js';
import { CompletedToolCall } from '../core/coreToolScheduler.js';
import { ToolConfirmationOutcome } from '../tools/tools.js';
import { AuthType } from '../core/contentGenerator.js';

export enum ToolCallDecision {
  ACCEPT = 'accept',
  REJECT = 'reject',
  MODIFY = 'modify',
}

export function getDecisionFromOutcome(
  outcome: ToolConfirmationOutcome,
): ToolCallDecision {
  switch (outcome) {
    case ToolConfirmationOutcome.ProceedOnce:
    case ToolConfirmationOutcome.ProceedAlways:
    case ToolConfirmationOutcome.ProceedAlwaysServer:
    case ToolConfirmationOutcome.ProceedAlwaysTool:
      return ToolCallDecision.ACCEPT;
    case ToolConfirmationOutcome.ModifyWithEditor:
      return ToolCallDecision.MODIFY;
    case ToolConfirmationOutcome.Cancel:
    default:
      return ToolCallDecision.REJECT;
  }
}

export class StartSessionEvent {
  'event.name': 'cli_config';
  'event.timestamp': string; // ISO 8601
  model: string;
  embedding_model: string;
  sandbox_enabled: boolean;
  core_tools_enabled: string;
  approval_mode: string;
  api_key_enabled: boolean;
  vertex_ai_enabled: boolean;
  debug_enabled: boolean;
  mcp_servers: string;
  telemetry_enabled: boolean;
  telemetry_log_user_prompts_enabled: boolean;
  file_filtering_respect_git_ignore: boolean;

  constructor(config: Config) {
    const generatorConfig = config.getContentGeneratorConfig();
    const mcpServers = config.getMcpServers();

    let useGemini = false;
    let useVertex = false;
    if (generatorConfig && generatorConfig.authType) {
      useGemini = generatorConfig.authType === AuthType.USE_GEMINI;
      useVertex = generatorConfig.authType === AuthType.USE_VERTEX_AI;
    }

    this['event.name'] = 'cli_config';
    this.model = config.getModel();
    this.embedding_model = config.getEmbeddingModel();
    this.sandbox_enabled =
      typeof config.getSandbox() === 'string' || !!config.getSandbox();
    this.core_tools_enabled = (config.getCoreTools() ?? []).join(',');
    this.approval_mode = config.getApprovalMode();
    this.api_key_enabled = useGemini || useVertex;
    this.vertex_ai_enabled = useVertex;
    this.debug_enabled = config.getDebugMode();
    this.mcp_servers = mcpServers ? Object.keys(mcpServers).join(',') : '';
    this.telemetry_enabled = config.getTelemetryEnabled();
    this.telemetry_log_user_prompts_enabled =
      config.getTelemetryLogPromptsEnabled();
    this.file_filtering_respect_git_ignore =
      config.getFileFilteringRespectGitIgnore();
  }
}

export class EndSessionEvent {
  'event.name': 'end_session';
  'event.timestamp': string; // ISO 8601
  session_id?: string;

  constructor(config?: Config) {
    this['event.name'] = 'end_session';
    this['event.timestamp'] = new Date().toISOString();
    this.session_id = config?.getSessionId();
  }
}

export class UserPromptEvent {
  'event.name': 'user_prompt';
  'event.timestamp': string; // ISO 8601
  prompt_length: number;
  prompt_id: string;
  auth_type?: string;
  prompt?: string;

  constructor(
    prompt_length: number,
    prompt_Id: string,
    auth_type?: string,
    prompt?: string,
  ) {
    this['event.name'] = 'user_prompt';
    this['event.timestamp'] = new Date().toISOString();
    this.prompt_length = prompt_length;
    this.prompt_id = prompt_Id;
    this.auth_type = auth_type;
    this.prompt = prompt;
  }
}

export class ToolCallEvent {
  'event.name': 'tool_call';
  'event.timestamp': string; // ISO 8601
  function_name: string;
  function_args: Record<string, unknown>;
  duration_ms: number;
  success: boolean;
  decision?: ToolCallDecision;
  error?: string;
  error_type?: string;
  prompt_id: string;

  constructor(call: CompletedToolCall) {
    this['event.name'] = 'tool_call';
    this['event.timestamp'] = new Date().toISOString();
    this.function_name = call.request.name;
    this.function_args = call.request.args;
    this.duration_ms = call.durationMs ?? 0;
    this.success = call.status === 'success';
    this.decision = call.outcome
      ? getDecisionFromOutcome(call.outcome)
      : undefined;
    this.error = call.response.error?.message;
    this.error_type = call.response.error?.name;
    this.prompt_id = call.request.prompt_id;
  }
}

export class ApiRequestEvent {
  'event.name': 'api_request';
  'event.timestamp': string; // ISO 8601
  model: string;
  prompt_id: string;
  request_text?: string;

  constructor(model: string, prompt_id: string, request_text?: string) {
    this['event.name'] = 'api_request';
    this['event.timestamp'] = new Date().toISOString();
    this.model = model;
    this.prompt_id = prompt_id;
    this.request_text = request_text;
  }
  }
  
  export class ParallelExecutionStartedEvent {
    'event.name': 'parallel_execution_started';
    'event.timestamp': string; // ISO 8601
    prompt_id: string;
    execution_id: string;
    call_count: number;
    max_concurrent_calls: number;
    retry_enabled: boolean;
  
    constructor(
      prompt_id: string,
      execution_id: string,
      call_count: number,
      max_concurrent_calls: number,
      retry_enabled: boolean,
    ) {
      this['event.name'] = 'parallel_execution_started';
      this['event.timestamp'] = new Date().toISOString();
      this.prompt_id = prompt_id;
      this.execution_id = execution_id;
      this.call_count = call_count;
      this.max_concurrent_calls = max_concurrent_calls;
      this.retry_enabled = retry_enabled;
    }
  }
  
  export class ParallelExecutionCompletedEvent {
    'event.name': 'parallel_execution_completed';
    'event.timestamp': string; // ISO 8601
    prompt_id: string;
    execution_id: string;
    call_count: number;
    success_count: number;
    error_count: number;
    retry_count: number;
    total_duration_ms: number;
  
    constructor(
      prompt_id: string,
      execution_id: string,
      call_count: number,
      success_count: number,
      error_count: number,
      retry_count: number,
      total_duration_ms: number,
    ) {
      this['event.name'] = 'parallel_execution_completed';
      this['event.timestamp'] = new Date().toISOString();
      this.prompt_id = prompt_id;
      this.execution_id = execution_id;
      this.call_count = call_count;
      this.success_count = success_count;
      this.error_count = error_count;
      this.retry_count = retry_count;
      this.total_duration_ms = total_duration_ms;
    }
  }
  
  export class ConcurrentCallCompletedEvent {
    'event.name': 'concurrent_call_completed';
    'event.timestamp': string; // ISO 8601
    prompt_id: string;
    execution_id: string;
    call_id: string;
    success: boolean;
    duration_ms: number;
    retry_count: number;
    error_message?: string;
  
    constructor(
      prompt_id: string,
      execution_id: string,
      call_id: string,
      success: boolean,
      duration_ms: number,
      retry_count: number,
      error_message?: string,
    ) {
      this['event.name'] = 'concurrent_call_completed';
      this['event.timestamp'] = new Date().toISOString();
      this.prompt_id = prompt_id;
      this.execution_id = execution_id;
      this.call_id = call_id;
      this.success = success;
      this.duration_ms = duration_ms;
      this.retry_count = retry_count;
      this.error_message = error_message;
    }
  }
  
  export class FileLockAcquiredEvent {
    'event.name': 'file_lock_acquired';
    'event.timestamp': string; // ISO 8601
    call_id: string;
    file_path: string;
    lock_id: string;
  
    constructor(call_id: string, file_path: string, lock_id: string) {
      this['event.name'] = 'file_lock_acquired';
      this['event.timestamp'] = new Date().toISOString();
      this.call_id = call_id;
      this.file_path = file_path;
      this.lock_id = lock_id;
    }
  }
  
  export class FileLockReleasedEvent {
    'event.name': 'file_lock_released';
    'event.timestamp': string; // ISO 8601
    call_id: string;
    file_path: string;
    lock_id: string;
    duration_ms: number;
  
    constructor(
      call_id: string,
      file_path: string,
      lock_id: string,
      duration_ms: number,
    ) {
      this['event.name'] = 'file_lock_released';
      this['event.timestamp'] = new Date().toISOString();
      this.call_id = call_id;
      this.file_path = file_path;
      this.lock_id = lock_id;
      this.duration_ms = duration_ms;
    }
  }
  
  export class RetryAttemptEvent {
    'event.name': 'retry_attempt';
    'event.timestamp': string; // ISO 8601
    call_id: string;
    attempt_number: number;
    error_message: string;
    next_retry_ms: number;
  
    constructor(
      call_id: string,
      attempt_number: number,
      error_message: string,
      next_retry_ms: number,
    ) {
      this['event.name'] = 'retry_attempt';
      this['event.timestamp'] = new Date().toISOString();
      this.call_id = call_id;
      this.attempt_number = attempt_number;
      this.error_message = error_message;
      this.next_retry_ms = next_retry_ms;
    }
  }
  
  export class ApiErrorEvent {
  'event.name': 'api_error';
  'event.timestamp': string; // ISO 8601
  model: string;
  error: string;
  error_type?: string;
  status_code?: number | string;
  duration_ms: number;
  prompt_id: string;
  auth_type?: string;

  constructor(
    model: string,
    error: string,
    duration_ms: number,
    prompt_id: string,
    auth_type?: string,
    error_type?: string,
    status_code?: number | string,
  ) {
    this['event.name'] = 'api_error';
    this['event.timestamp'] = new Date().toISOString();
    this.model = model;
    this.error = error;
    this.error_type = error_type;
    this.status_code = status_code;
    this.duration_ms = duration_ms;
    this.prompt_id = prompt_id;
    this.auth_type = auth_type;
  }
}

export class ApiResponseEvent {
  'event.name': 'api_response';
  'event.timestamp': string; // ISO 8601
  model: string;
  status_code?: number | string;
  duration_ms: number;
  error?: string;
  input_token_count: number;
  output_token_count: number;
  cached_content_token_count: number;
  thoughts_token_count: number;
  tool_token_count: number;
  total_token_count: number;
  response_text?: string;
  prompt_id: string;
  auth_type?: string;

  constructor(
    model: string,
    duration_ms: number,
    prompt_id: string,
    auth_type?: string,
    usage_data?: GenerateContentResponseUsageMetadata,
    response_text?: string,
    error?: string,
  ) {
    this['event.name'] = 'api_response';
    this['event.timestamp'] = new Date().toISOString();
    this.model = model;
    this.duration_ms = duration_ms;
    this.status_code = 200;
    this.input_token_count = usage_data?.promptTokenCount ?? 0;
    this.output_token_count = usage_data?.candidatesTokenCount ?? 0;
    this.cached_content_token_count = usage_data?.cachedContentTokenCount ?? 0;
    this.thoughts_token_count = usage_data?.thoughtsTokenCount ?? 0;
    this.tool_token_count = usage_data?.toolUsePromptTokenCount ?? 0;
    this.total_token_count = usage_data?.totalTokenCount ?? 0;
    this.response_text = response_text;
    this.error = error;
    this.prompt_id = prompt_id;
    this.auth_type = auth_type;
  }
}

export class FlashFallbackEvent {
  'event.name': 'flash_fallback';
  'event.timestamp': string; // ISO 8601
  auth_type: string;

  constructor(auth_type: string) {
    this['event.name'] = 'flash_fallback';
    this['event.timestamp'] = new Date().toISOString();
    this.auth_type = auth_type;
  }
}

export enum LoopType {
  CONSECUTIVE_IDENTICAL_TOOL_CALLS = 'consecutive_identical_tool_calls',
  CHANTING_IDENTICAL_SENTENCES = 'chanting_identical_sentences',
  LLM_DETECTED_LOOP = 'llm_detected_loop',
}

export class LoopDetectedEvent {
  'event.name': 'loop_detected';
  'event.timestamp': string; // ISO 8601
  loop_type: LoopType;
  prompt_id: string;

  constructor(loop_type: LoopType, prompt_id: string) {
    this['event.name'] = 'loop_detected';
    this['event.timestamp'] = new Date().toISOString();
    this.loop_type = loop_type;
    this.prompt_id = prompt_id;
  }
}

export class FlashDecidedToContinueEvent {
  'event.name': 'flash_decided_to_continue';
  'event.timestamp': string; // ISO 8601
  prompt_id: string;

  constructor(prompt_id: string) {
    this['event.name'] = 'flash_decided_to_continue';
    this['event.timestamp'] = new Date().toISOString();
    this.prompt_id = prompt_id;
  }
}

export class ConcurrentSyntaxDetectedEvent {
  'event.name': 'concurrent_syntax_detected';
  'event.timestamp': string; // ISO 8601
  prompt_id: string;
  call_count: number;
  calls: Array<{
    id: string;
    prompt: string;
  }>;

  constructor(prompt_id: string, calls: Array<{ id: string; prompt: string }>) {
    this['event.name'] = 'concurrent_syntax_detected';
    this['event.timestamp'] = new Date().toISOString();
    this.prompt_id = prompt_id;
    this.call_count = calls.length;
    this.calls = calls;
  }
}

export type TelemetryEvent =
  | StartSessionEvent
  | EndSessionEvent
  | UserPromptEvent
  | ToolCallEvent
  | ApiRequestEvent
  | ApiErrorEvent
  | ApiResponseEvent
  | FlashFallbackEvent
  | LoopDetectedEvent
  | FlashDecidedToContinueEvent
  | ConcurrentSyntaxDetectedEvent
  | ParallelExecutionStartedEvent
  | ParallelExecutionCompletedEvent
  | ConcurrentCallCompletedEvent
  | FileLockAcquiredEvent
  | FileLockReleasedEvent
  | RetryAttemptEvent;
