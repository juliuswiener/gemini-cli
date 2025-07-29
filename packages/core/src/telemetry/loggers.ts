/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { logs, LogRecord, LogAttributes } from '@opentelemetry/api-logs';
import { SemanticAttributes } from '@opentelemetry/semantic-conventions';
import { Config } from '../config/config.js';
import {
  EVENT_API_ERROR,
  EVENT_API_REQUEST,
  EVENT_API_RESPONSE,
  EVENT_CLI_CONFIG,
  EVENT_TOOL_CALL,
  EVENT_USER_PROMPT,
  EVENT_FLASH_FALLBACK,
  EVENT_FLASH_DECIDED_TO_CONTINUE,
  SERVICE_NAME,
} from './constants.js';
import {
  ApiErrorEvent,
  ApiRequestEvent,
  ApiResponseEvent,
  StartSessionEvent,
  ToolCallEvent,
  UserPromptEvent,
  FlashFallbackEvent,
  FlashDecidedToContinueEvent,
  LoopDetectedEvent,
  ConcurrentSyntaxDetectedEvent,
  ParallelExecutionStartedEvent,
  ParallelExecutionCompletedEvent,
  ConcurrentCallCompletedEvent,
  FileLockAcquiredEvent,
  FileLockReleasedEvent,
  RetryAttemptEvent,
} from './types.js';
import {
  recordApiErrorMetrics,
  recordTokenUsageMetrics,
  recordApiResponseMetrics,
  recordToolCallMetrics,
} from './metrics.js';
import { isTelemetrySdkInitialized } from './sdk.js';
import { uiTelemetryService, UiEvent } from './uiTelemetry.js';
import { ClearcutLogger } from './clearcut-logger/clearcut-logger.js';
import { safeJsonStringify } from '../utils/safeJsonStringify.js';

const shouldLogUserPrompts = (config: Config): boolean =>
  config.getTelemetryLogPromptsEnabled();

function getCommonAttributes(config: Config): LogAttributes {
  return {
    'session.id': config.getSessionId(),
  };
}

export function logCliConfiguration(
  config: Config,
  event: StartSessionEvent,
): void {
  ClearcutLogger.getInstance(config)?.logStartSessionEvent(event);
  if (!isTelemetrySdkInitialized()) return;

  const attributes: LogAttributes = {
    ...getCommonAttributes(config),
    'event.name': EVENT_CLI_CONFIG,
    'event.timestamp': new Date().toISOString(),
    model: event.model,
    embedding_model: event.embedding_model,
    sandbox_enabled: event.sandbox_enabled,
    core_tools_enabled: event.core_tools_enabled,
    approval_mode: event.approval_mode,
    api_key_enabled: event.api_key_enabled,
    vertex_ai_enabled: event.vertex_ai_enabled,
    log_user_prompts_enabled: event.telemetry_log_user_prompts_enabled,
    file_filtering_respect_git_ignore: event.file_filtering_respect_git_ignore,
    debug_mode: event.debug_enabled,
    mcp_servers: event.mcp_servers,
  };

  const logger = logs.getLogger(SERVICE_NAME);
  const logRecord: LogRecord = {
    body: 'CLI configuration loaded.',
    attributes,
  };
  logger.emit(logRecord);
}

export function logUserPrompt(config: Config, event: UserPromptEvent): void {
  ClearcutLogger.getInstance(config)?.logNewPromptEvent(event);
  if (!isTelemetrySdkInitialized()) return;

  const attributes: LogAttributes = {
    ...getCommonAttributes(config),
    'event.name': EVENT_USER_PROMPT,
    'event.timestamp': new Date().toISOString(),
    prompt_length: event.prompt_length,
  };

  if (shouldLogUserPrompts(config)) {
    attributes.prompt = event.prompt;
  }

  const logger = logs.getLogger(SERVICE_NAME);
  const logRecord: LogRecord = {
    body: `User prompt. Length: ${event.prompt_length}.`,
    attributes,
  };
  logger.emit(logRecord);
}

export function logToolCall(config: Config, event: ToolCallEvent): void {
  const uiEvent = {
    ...event,
    'event.name': EVENT_TOOL_CALL,
    'event.timestamp': new Date().toISOString(),
  } as UiEvent;
  uiTelemetryService.addEvent(uiEvent);
  ClearcutLogger.getInstance(config)?.logToolCallEvent(event);
  if (!isTelemetrySdkInitialized()) return;

  const attributes: LogAttributes = {
    ...getCommonAttributes(config),
    ...event,
    'event.name': EVENT_TOOL_CALL,
    'event.timestamp': new Date().toISOString(),
    function_args: safeJsonStringify(event.function_args, 2),
  };
  if (event.error) {
    attributes['error.message'] = event.error;
    if (event.error_type) {
      attributes['error.type'] = event.error_type;
    }
  }

  const logger = logs.getLogger(SERVICE_NAME);
  const logRecord: LogRecord = {
    body: `Tool call: ${event.function_name}${event.decision ? `. Decision: ${event.decision}` : ''}. Success: ${event.success}. Duration: ${event.duration_ms}ms.`,
    attributes,
  };
  logger.emit(logRecord);
  recordToolCallMetrics(
    config,
    event.function_name,
    event.duration_ms,
    event.success,
    event.decision,
  );
}

export function logApiRequest(config: Config, event: ApiRequestEvent): void {
  ClearcutLogger.getInstance(config)?.logApiRequestEvent(event);
  if (!isTelemetrySdkInitialized()) return;

  const attributes: LogAttributes = {
    ...getCommonAttributes(config),
    ...event,
    'event.name': EVENT_API_REQUEST,
    'event.timestamp': new Date().toISOString(),
  };

  const logger = logs.getLogger(SERVICE_NAME);
  const logRecord: LogRecord = {
    body: `API request to ${event.model}.`,
    attributes,
  };
  logger.emit(logRecord);
}

export function logFlashFallback(
  config: Config,
  event: FlashFallbackEvent,
): void {
  ClearcutLogger.getInstance(config)?.logFlashFallbackEvent(event);
  if (!isTelemetrySdkInitialized()) return;

  const attributes: LogAttributes = {
    ...getCommonAttributes(config),
    ...event,
    'event.name': EVENT_FLASH_FALLBACK,
    'event.timestamp': new Date().toISOString(),
  };

  const logger = logs.getLogger(SERVICE_NAME);
  const logRecord: LogRecord = {
    body: `Switching to flash as Fallback.`,
    attributes,
  };
  logger.emit(logRecord);
}

export function logParallelExecutionStarted(
  config: Config,
  event: ParallelExecutionStartedEvent,
): void {
  // TODO: Implement ClearcutLogger integration
  if (!isTelemetrySdkInitialized()) return;

  const attributes: LogAttributes = {
    ...getCommonAttributes(config),
    'event.name': 'parallel_execution_started',
    'event.timestamp': event['event.timestamp'],
    prompt_id: event.prompt_id,
    execution_id: event.execution_id,
    call_count: event.call_count,
    max_concurrent_calls: event.max_concurrent_calls,
    retry_enabled: event.retry_enabled,
  };

  const logger = logs.getLogger(SERVICE_NAME);
  const logRecord: LogRecord = {
    body: `Parallel execution started. Call count: ${event.call_count}. Max concurrent calls: ${event.max_concurrent_calls}.`,
    attributes,
  };
  logger.emit(logRecord);
}

export function logParallelExecutionCompleted(
  config: Config,
  event: ParallelExecutionCompletedEvent,
): void {
  // TODO: Implement ClearcutLogger integration
  if (!isTelemetrySdkInitialized()) return;

  const attributes: LogAttributes = {
    ...getCommonAttributes(config),
    'event.name': 'parallel_execution_completed',
    'event.timestamp': event['event.timestamp'],
    prompt_id: event.prompt_id,
    execution_id: event.execution_id,
    call_count: event.call_count,
    success_count: event.success_count,
    error_count: event.error_count,
    retry_count: event.retry_count,
    total_duration_ms: event.total_duration_ms,
  };

  const logger = logs.getLogger(SERVICE_NAME);
  const logRecord: LogRecord = {
    body: `Parallel execution completed. Success: ${event.success_count}/${event.call_count}. Errors: ${event.error_count}. Retries: ${event.retry_count}. Duration: ${event.total_duration_ms}ms.`,
    attributes,
  };
  logger.emit(logRecord);
}

export function logConcurrentCallCompleted(
  config: Config,
  event: ConcurrentCallCompletedEvent,
): void {
  // TODO: Implement ClearcutLogger integration
  if (!isTelemetrySdkInitialized()) return;

  const attributes: LogAttributes = {
    ...getCommonAttributes(config),
    'event.name': 'concurrent_call_completed',
    'event.timestamp': event['event.timestamp'],
    prompt_id: event.prompt_id,
    execution_id: event.execution_id,
    call_id: event.call_id,
    success: event.success,
    duration_ms: event.duration_ms,
    retry_count: event.retry_count,
  };

  if (event.error_message) {
    attributes['error.message'] = event.error_message;
  }

  const logger = logs.getLogger(SERVICE_NAME);
  const logRecord: LogRecord = {
    body: `Concurrent call ${event.call_id} completed. Success: ${event.success}. Duration: ${event.duration_ms}ms. Retries: ${event.retry_count}.`,
    attributes,
  };
  logger.emit(logRecord);
}

export function logFileLockAcquired(
  config: Config,
  event: FileLockAcquiredEvent,
): void {
  // TODO: Implement ClearcutLogger integration
  if (!isTelemetrySdkInitialized()) return;

  const attributes: LogAttributes = {
    ...getCommonAttributes(config),
    'event.name': 'file_lock_acquired',
    'event.timestamp': event['event.timestamp'],
    call_id: event.call_id,
    file_path: event.file_path,
    lock_id: event.lock_id,
  };

  const logger = logs.getLogger(SERVICE_NAME);
  const logRecord: LogRecord = {
    body: `File lock acquired for ${event.file_path} by call ${event.call_id}.`,
    attributes,
  };
  logger.emit(logRecord);
}

export function logFileLockReleased(
  config: Config,
  event: FileLockReleasedEvent,
): void {
  // TODO: Implement ClearcutLogger integration
  if (!isTelemetrySdkInitialized()) return;

  const attributes: LogAttributes = {
    ...getCommonAttributes(config),
    'event.name': 'file_lock_released',
    'event.timestamp': event['event.timestamp'],
    call_id: event.call_id,
    file_path: event.file_path,
    lock_id: event.lock_id,
    duration_ms: event.duration_ms,
  };

  const logger = logs.getLogger(SERVICE_NAME);
  const logRecord: LogRecord = {
    body: `File lock released for ${event.file_path} by call ${event.call_id}. Duration: ${event.duration_ms}ms.`,
    attributes,
  };
  logger.emit(logRecord);
}

export function logRetryAttempt(
  config: Config,
  event: RetryAttemptEvent,
): void {
  // TODO: Implement ClearcutLogger integration
  if (!isTelemetrySdkInitialized()) return;

  const attributes: LogAttributes = {
    ...getCommonAttributes(config),
    'event.name': 'retry_attempt',
    'event.timestamp': event['event.timestamp'],
    call_id: event.call_id,
    attempt_number: event.attempt_number,
    error_message: event.error_message,
    next_retry_ms: event.next_retry_ms,
  };

  const logger = logs.getLogger(SERVICE_NAME);
  const logRecord: LogRecord = {
    body: `Retry attempt ${event.attempt_number} for call ${event.call_id}. Next retry in ${event.next_retry_ms}ms. Error: ${event.error_message}`,
    attributes,
  };
  logger.emit(logRecord);
}

export function logApiError(config: Config, event: ApiErrorEvent): void {
  const uiEvent = {
    ...event,
    'event.name': EVENT_API_ERROR,
    'event.timestamp': new Date().toISOString(),
  } as UiEvent;
  uiTelemetryService.addEvent(uiEvent);
  ClearcutLogger.getInstance(config)?.logApiErrorEvent(event);
  if (!isTelemetrySdkInitialized()) return;

  const attributes: LogAttributes = {
    ...getCommonAttributes(config),
    ...event,
    'event.name': EVENT_API_ERROR,
    'event.timestamp': new Date().toISOString(),
    ['error.message']: event.error,
    model_name: event.model,
    duration: event.duration_ms,
  };

  if (event.error_type) {
    attributes['error.type'] = event.error_type;
  }
  if (typeof event.status_code === 'number') {
    attributes[SemanticAttributes.HTTP_STATUS_CODE] = event.status_code;
  }

  const logger = logs.getLogger(SERVICE_NAME);
  const logRecord: LogRecord = {
    body: `API error for ${event.model}. Error: ${event.error}. Duration: ${event.duration_ms}ms.`,
    attributes,
  };
  logger.emit(logRecord);
  recordApiErrorMetrics(
    config,
    event.model,
    event.duration_ms,
    event.status_code,
    event.error_type,
  );
}

export function logApiResponse(config: Config, event: ApiResponseEvent): void {
  const uiEvent = {
    ...event,
    'event.name': EVENT_API_RESPONSE,
    'event.timestamp': new Date().toISOString(),
  } as UiEvent;
  uiTelemetryService.addEvent(uiEvent);
  ClearcutLogger.getInstance(config)?.logApiResponseEvent(event);
  if (!isTelemetrySdkInitialized()) return;
  const attributes: LogAttributes = {
    ...getCommonAttributes(config),
    ...event,
    'event.name': EVENT_API_RESPONSE,
    'event.timestamp': new Date().toISOString(),
  };
  if (event.response_text) {
    attributes.response_text = event.response_text;
  }
  if (event.error) {
    attributes['error.message'] = event.error;
  } else if (event.status_code) {
    if (typeof event.status_code === 'number') {
      attributes[SemanticAttributes.HTTP_STATUS_CODE] = event.status_code;
    }
  }

  const logger = logs.getLogger(SERVICE_NAME);
  const logRecord: LogRecord = {
    body: `API response from ${event.model}. Status: ${event.status_code || 'N/A'}. Duration: ${event.duration_ms}ms.`,
    attributes,
  };
  logger.emit(logRecord);
  recordApiResponseMetrics(
    config,
    event.model,
    event.duration_ms,
    event.status_code,
    event.error,
  );
  recordTokenUsageMetrics(
    config,
    event.model,
    event.input_token_count,
    'input',
  );
  recordTokenUsageMetrics(
    config,
    event.model,
    event.output_token_count,
    'output',
  );
  recordTokenUsageMetrics(
    config,
    event.model,
    event.cached_content_token_count,
    'cache',
  );
  recordTokenUsageMetrics(
    config,
    event.model,
    event.thoughts_token_count,
    'thought',
  );
  recordTokenUsageMetrics(config, event.model, event.tool_token_count, 'tool');
}

export function logLoopDetected(
  config: Config,
  event: LoopDetectedEvent,
): void {
  ClearcutLogger.getInstance(config)?.logLoopDetectedEvent(event);
  if (!isTelemetrySdkInitialized()) return;

  const attributes: LogAttributes = {
    ...getCommonAttributes(config),
    ...event,
  };

  const logger = logs.getLogger(SERVICE_NAME);
  const logRecord: LogRecord = {
    body: `Loop detected. Type: ${event.loop_type}.`,
    attributes,
  };
  logger.emit(logRecord);
}

export function logFlashDecidedToContinue(
  config: Config,
  event: FlashDecidedToContinueEvent,
): void {
  ClearcutLogger.getInstance(config)?.logFlashDecidedToContinueEvent(event);
  if (!isTelemetrySdkInitialized()) return;

  const attributes: LogAttributes = {
    ...getCommonAttributes(config),
    ...event,
    'event.name': EVENT_FLASH_DECIDED_TO_CONTINUE,
  };

  const logger = logs.getLogger(SERVICE_NAME);
  const logRecord: LogRecord = {
    body: `Flash decided to continue.`,
    attributes,
  };
  logger.emit(logRecord);
}

export function logConcurrentSyntaxDetected(
  config: Config,
  event: ConcurrentSyntaxDetectedEvent,
): void {
  ClearcutLogger.getInstance(config)?.logConcurrentSyntaxDetectedEvent(event);
  if (!isTelemetrySdkInitialized()) return;

  const attributes: LogAttributes = {
    ...getCommonAttributes(config),
    'event.name': 'concurrent_syntax_detected',
    'event.timestamp': event['event.timestamp'],
    prompt_id: event.prompt_id,
    call_count: event.call_count,
  };

  const logger = logs.getLogger(SERVICE_NAME);
  const logRecord: LogRecord = {
    body: `Concurrent syntax detected. Call count: ${event.call_count}.`,
    attributes,
  };
  logger.emit(logRecord);
}
