# `Increment 2: Parallel API Execution` Implementation Plan

## Overview

Implement parallel execution of multiple prompts parsed from the `callN:` syntax while maintaining seamless integration with the existing streaming architecture. This increment builds upon Increment 1's concurrent syntax parsing to enable actual parallel API calls, stream multiplexing, and result aggregation within the current `Turn`-based system.

**Primary Goals:**

- Execute multiple parsed prompts concurrently using `Promise.all` or similar mechanisms
- Implement interleaved stream multiplexing with event metadata for call traceability
- Enable parallel tool execution with file locking to prevent race conditions
- Implement configurable retry mechanism for failing concurrent calls
- Maintain compatibility with existing tool execution and error handling
- Preserve the single `Turn` return value while internally managing multiple concurrent `Turn` instances
- Add comprehensive telemetry for parallel execution monitoring

## Current Codebase Analysis

### Relevant Files

- **[`packages/core/src/core/client.ts`](packages/core/src/core/client.ts:1)** - Primary integration point containing [`sendMessageStream()`](packages/core/src/core/client.ts:298) and [`parseConcurrentSyntax()`](packages/core/src/core/client.ts:438)
- **[`packages/core/src/core/turn.ts`](packages/core/src/core/turn.ts:1)** - [`Turn`](packages/core/src/core/turn.ts:163) class manages individual prompt execution and streaming
- **[`packages/core/src/core/geminiChat.ts`](packages/core/src/core/geminiChat.ts:1)** - [`GeminiChat`](packages/core/src/core/geminiChat.ts:130) handles API communication and response streaming
- **[`packages/core/src/telemetry/types.ts`](packages/core/src/telemetry/types.ts:1)** - Telemetry event types including [`ConcurrentSyntaxDetectedEvent`](packages/core/src/telemetry/types.ts:281)
- **[`packages/core/src/config/config.ts`](packages/core/src/config/config.ts:1)** - Configuration with [`ConcurrencyConfig`](packages/core/src/config/config.ts:66) and concurrency control methods
- **[`packages/cli/src/nonInteractiveCli.ts`](packages/cli/src/nonInteractiveCli.ts:1)** - Non-interactive CLI that also needs concurrent execution support

### Patterns/Conventions

- **Async Generator Streaming**: [`sendMessageStream()`](packages/core/src/core/client.ts:298) returns `AsyncGenerator<ServerGeminiStreamEvent, Turn>`
- **Turn-based Architecture**: Each conversation turn is managed by a [`Turn`](packages/core/src/core/turn.ts:163) instance with [`run()`](packages/core/src/core/turn.ts:175) method
- **Event-driven Communication**: All interactions use [`ServerGeminiStreamEvent`](packages/core/src/core/turn.ts:149) for streaming data
- **Configuration Pattern**: [`Config`](packages/core/src/config/config.ts:186) class provides centralized settings with getter methods
- **Telemetry Integration**: All significant events are logged using structured event types

### Integration Points

- **Primary Execution Point**: [`GeminiClient.sendMessageStream()`](packages/core/src/core/client.ts:298) around line 371 where concurrent parsing occurs
- **Stream Management**: Need to multiplex multiple [`Turn.run()`](packages/core/src/core/turn.ts:175) async generators
- **Configuration Access**: Use existing [`getConcurrencyEnabled()`](packages/core/src/config/config.ts:649), [`getMaxConcurrentCalls()`](packages/core/src/config/config.ts:653), [`getForcedProcessingMode()`](packages/core/src/config/config.ts:657)
- **Telemetry Logging**: Extend existing telemetry with new parallel execution events

### Potential Conflicts

- **Stream Ordering**: Multiple concurrent streams produce events in interleaved, non-deterministic order (RESOLVED: enriched metadata for traceability)
- **Tool Call Management**: Concurrent prompts requesting overlapping tool executions (RESOLVED: file locking mechanism)
- **Error Propagation**: Need to handle partial failures gracefully with retry mechanisms
- **Resource Management**: Multiple concurrent API calls may impact rate limits and resource usage

## Detailed Implementation Specification

### File Structure

- **Modify**: [`packages/core/src/core/client.ts`](packages/core/src/core/client.ts:1) - Add parallel execution logic and stream multiplexing with metadata enrichment
- **Modify**: [`packages/core/src/telemetry/types.ts`](packages/core/src/telemetry/types.ts:1) - Add new telemetry event types for parallel execution and retry mechanisms
- **Modify**: [`packages/core/src/telemetry/loggers.ts`](packages/core/src/telemetry/loggers.ts:1) - Add logging functions for new events
- **Modify**: [`packages/cli/src/nonInteractiveCli.ts`](packages/cli/src/nonInteractiveCli.ts:1) - Update to handle concurrent execution results
- **Create**: [`packages/core/src/core/streamMultiplexer.ts`](packages/core/src/core/streamMultiplexer.ts:1) - Enhanced utility for merging multiple async generators with event metadata
- **Create**: [`packages/core/src/core/fileLockManager.ts`](packages/core/src/core/fileLockManager.ts:1) - File locking mechanism for parallel tool execution safety
- **Create**: [`packages/core/src/core/retryManager.ts`](packages/core/src/core/retryManager.ts:1) - Configurable retry mechanism for failing concurrent calls
- **Extend**: [`packages/core/src/core/client.test.ts`](packages/core/src/core/client.test.ts:1) - Add comprehensive tests for parallel execution
- **Create**: [`packages/core/src/core/fileLockManager.test.ts`](packages/core/src/core/fileLockManager.test.ts:1) - Tests for file locking mechanism
- **Create**: [`packages/core/src/core/retryManager.test.ts`](packages/core/src/core/retryManager.test.ts:1) - Tests for retry mechanism

### Interfaces and Contracts

**Enhanced Types and Interfaces:**

```typescript
// In packages/core/src/core/client.ts
interface ConcurrentExecution {
  calls: ConcurrentCall[];
  turns: Turn[];
  combinedTurn: Turn;
  metadata: ConcurrentExecutionMetadata;
}

interface ConcurrentExecutionMetadata {
  executionId: string;
  startTime: number;
  callIds: string[];
  retryConfigs: Map<string, RetryConfig>;
}

interface ParallelExecutionResult {
  success: boolean;
  results: Turn[];
  errors: Array<{ callId: string; error: Error; retryCount: number }>;
  metadata: ConcurrentExecutionMetadata;
}

interface EnrichedStreamEvent extends ServerGeminiStreamEvent {
  _metadata: {
    callId: string;
    originalPrompt: string;
    executionId: string;
    timestamp: number;
  };
}

// In packages/core/src/core/retryManager.ts
interface RetryConfig {
  maxRetries: number;
  backoffMs: number;
  exponentialBackoff: boolean;
  retryableErrors: string[];
}

interface RetryContext {
  callId: string;
  attempt: number;
  lastError?: Error;
  nextRetryTime?: number;
}

// In packages/core/src/core/fileLockManager.ts
interface FileLock {
  path: string;
  lockId: string;
  acquiredAt: number;
  callId: string;
}

interface LockRequest {
  path: string;
  callId: string;
  timeout: number;
}

// In packages/core/src/telemetry/types.ts
class ParallelExecutionStartedEvent {
  'event.name': 'parallel_execution_started';
  'event.timestamp': string;
  prompt_id: string;
  execution_id: string;
  call_count: number;
  max_concurrent_calls: number;
  retry_enabled: boolean;
}

class ParallelExecutionCompletedEvent {
  'event.name': 'parallel_execution_completed';
  'event.timestamp': string;
  prompt_id: string;
  execution_id: string;
  call_count: number;
  success_count: number;
  error_count: number;
  retry_count: number;
  total_duration_ms: number;
}

class ConcurrentCallCompletedEvent {
  'event.name': 'concurrent_call_completed';
  'event.timestamp': string;
  prompt_id: string;
  execution_id: string;
  call_id: string;
  success: boolean;
  duration_ms: number;
  retry_count: number;
  error_message?: string;
}

class FileLockAcquiredEvent {
  'event.name': 'file_lock_acquired';
  'event.timestamp': string;
  call_id: string;
  file_path: string;
  lock_id: string;
}

class FileLockReleasedEvent {
  'event.name': 'file_lock_released';
  'event.timestamp': string;
  call_id: string;
  file_path: string;
  lock_id: string;
  duration_ms: number;
}

class RetryAttemptEvent {
  'event.name': 'retry_attempt';
  'event.timestamp': string;
  call_id: string;
  attempt_number: number;
  error_message: string;
  next_retry_ms: number;
}
```

**Core Functions:**

- **`executeParallelPrompts(calls: ConcurrentCall[], signal: AbortSignal, prompt_id: string): AsyncGenerator<EnrichedStreamEvent, Turn>`** - Execute multiple prompts concurrently with metadata enrichment and retry support
- **`createConcurrentTurns(calls: ConcurrentCall[], prompt_id: string, retryConfigs: Map<string, RetryConfig>): Turn[]`** - Create individual Turn instances with retry configuration
- **`multiplexStreamsWithMetadata(turnGenerators: AsyncGenerator<ServerGeminiStreamEvent>[], callMetadata: Map<string, any>, signal: AbortSignal): AsyncGenerator<EnrichedStreamEvent>`** - Merge streams and enrich events with traceability metadata
- **`aggregateResults(turns: Turn[]): Turn`** - Combine multiple Turn results into single coherent Turn

**Enhanced Stream Multiplexer:**

```typescript
// In packages/core/src/core/streamMultiplexer.ts
export class StreamMultiplexer {
  static async *mergeStreamsWithMetadata<T extends ServerGeminiStreamEvent>(
    generators: Array<{
      generator: AsyncGenerator<T>;
      callId: string;
      originalPrompt: string;
      executionId: string;
    }>,
    signal: AbortSignal,
  ): AsyncGenerator<EnrichedStreamEvent> {
    // Enhanced implementation with metadata enrichment
  }

  static async *interleavedMerge<T>(
    generators: AsyncGenerator<T>[],
    signal: AbortSignal,
  ): AsyncGenerator<T> {
    // Non-blocking interleaved merging for optimal performance
  }
}
```

**File Lock Manager:**

```typescript
// In packages/core/src/core/fileLockManager.ts
export class FileLockManager {
  private locks: Map<string, FileLock>;
  private queue: Map<string, LockRequest[]>;

  constructor(private telemetryLogger: TelemetryLogger) {}

  async acquireLock(request: LockRequest): Promise<FileLock>;
  async releaseLock(lockId: string): Promise<void>;
  isLocked(path: string): boolean;
  getLockInfo(path: string): FileLock | undefined;
  private processQueue(path: string): void;
}
```

**Retry Manager:**

```typescript
// In packages/core/src/core/retryManager.ts
export class RetryManager {
  private retryContexts: Map<string, RetryContext>;

  constructor(
    private defaultConfig: RetryConfig,
    private telemetryLogger: TelemetryLogger,
  ) {}

  shouldRetry(callId: string, error: Error): boolean;
  async executeWithRetry<T>(
    callId: string,
    operation: () => Promise<T>,
    config?: RetryConfig,
  ): Promise<T>;
  getRetryContext(callId: string): RetryContext | undefined;
  private calculateBackoff(attempt: number, config: RetryConfig): number;
  private isRetryableError(error: Error, config: RetryConfig): boolean;
}
```

### Integration Requirements

**Existing Code to Modify:**

1. **[`packages/core/src/core/client.ts`](packages/core/src/core/client.ts:298)** - Modify [`sendMessageStream()`](packages/core/src/core/client.ts:298):
   - **Lines 371-379**: Replace current placeholder logging with actual parallel execution using enhanced metadata-enriched streaming
   - **Integration Logic**: When `concurrencyAnalysis.hasConcurrentCalls` is true, call `executeParallelPrompts()` with retry and file locking support
   - **Stream Handling**: Replace single `turn.run()` with multiplexed stream that enriches events with call metadata
   - **Tool Integration**: Integrate `FileLockManager` for coordinated tool execution

2. **[`packages/core/src/telemetry/types.ts`](packages/core/src/telemetry/types.ts:300)** - Extend `TelemetryEvent` union:
   - **Add**: `ParallelExecutionStartedEvent`, `ParallelExecutionCompletedEvent`, `ConcurrentCallCompletedEvent`
   - **Add**: `FileLockAcquiredEvent`, `FileLockReleasedEvent`, `RetryAttemptEvent`
   - **Line 311**: Update union type to include all new telemetry events

3. **[`packages/core/src/core/turn.ts`](packages/core/src/core/turn.ts:175)** - Enhance [`Turn.run()`](packages/core/src/core/turn.ts:175):
   - **Tool Execution**: Integrate file locking before tool calls that modify files
   - **Event Metadata**: Preserve call metadata through the execution chain
   - **Error Context**: Include retry context in error reporting

4. **[`packages/cli/src/nonInteractiveCli.ts`](packages/cli/src/nonInteractiveCli.ts:69-80)** - Concurrent syntax detection:
   - **Enhanced Processing**: Handle metadata-enriched events from parallel execution
   - **Retry Integration**: Support retry configuration through CLI parameters
   - **Telemetry**: Ensure comprehensive logging of parallel execution metrics

**New `imports`/`exports`:**

- **Export**: `StreamMultiplexer`, `FileLockManager`, `RetryManager` classes from respective modules
- **Import**: All new components in [`packages/core/src/core/client.ts`](packages/core/src/core/client.ts:1)
- **Export**: Enhanced telemetry event types from [`packages/core/src/telemetry/types.ts`](packages/core/src/telemetry/types.ts:1)
- **Import**: New telemetry loggers in all modules requiring telemetry
- **Export**: `EnrichedStreamEvent` interface for external consumption
- **Import**: File system utilities in `FileLockManager` for lock file operations

**Configuration Changes:**

- **Extend [`ConcurrencyConfig`](packages/core/src/config/config.ts:66)**: Add retry configuration options
  ```typescript
  interface ConcurrencyConfig {
    enabled: boolean;
    maxConcurrentCalls: number;
    forceProcessing: boolean;
    // NEW ADDITIONS:
    retryConfig: {
      maxRetries: number;
      backoffMs: number;
      exponentialBackoff: boolean;
      retryableErrors: string[];
    };
    fileLocking: {
      enabled: boolean;
      timeoutMs: number;
      lockDirectory: string;
    };
  }
  ```
- **Default Values**: Provide sensible defaults for new configuration options
- **Validation**: Ensure all new configuration options are properly validated
- **Environment Variables**: Support environment variable overrides for new settings

### Unit Testing Requirements

**Test Files:**

- **[`packages/core/src/core/client.test.ts`](packages/core/src/core/client.test.ts:1)** - Enhanced parallel execution test suite with metadata and retry testing
- **[`packages/core/src/core/streamMultiplexer.test.ts`](packages/core/src/core/streamMultiplexer.test.ts:1)** - Comprehensive stream multiplexing tests with metadata enrichment
- **[`packages/core/src/core/fileLockManager.test.ts`](packages/core/src/core/fileLockManager.test.ts:1)** - File locking mechanism comprehensive test suite
- **[`packages/core/src/core/retryManager.test.ts`](packages/core/src/core/retryManager.test.ts:1)** - Retry mechanism test suite with different failure scenarios
- **[`packages/core/src/telemetry/loggers.test.ts`](packages/core/src/telemetry/loggers.test.ts:1)** - Extended telemetry tests for all new events

**Key Test Cases:**

**Parallel Execution & Stream Management:**

- **Successful Parallel Execution**: Multiple prompts execute concurrently with proper metadata enrichment
- **Mixed Success/Failure with Retries**: Some calls succeed, others fail and retry according to configuration
- **Interleaved Stream Events**: Verify proper event ordering and metadata traceability across concurrent streams
- **Event Metadata Integrity**: Ensure all events contain correct call identification and execution context
- **Stream Cancellation**: Verify proper cleanup when AbortSignal is triggered during parallel execution

**File Locking:**

- **Concurrent File Access**: Multiple calls attempting to modify the same file are properly serialized
- **Lock Acquisition/Release**: Verify proper lock lifecycle management and cleanup
- **Lock Timeout Handling**: Test behavior when lock acquisition times out
- **Lock Queue Management**: Verify proper queuing of pending lock requests
- **Lock Conflict Resolution**: Test scenarios with overlapping file access patterns

**Retry Mechanism:**

- **Configurable Retry Logic**: Test different retry configurations (max retries, backoff strategies)
- **Retryable vs Non-retryable Errors**: Verify proper error classification and retry decisions
- **Exponential Backoff**: Test backoff timing calculations and implementation
- **Retry Context Tracking**: Verify proper tracking of retry attempts and context
- **Retry Telemetry**: Ensure proper logging of retry attempts and outcomes

**Integration Testing:**

- **Tool Call Coordination**: Concurrent prompts requesting overlapping tools with file locking
- **Configuration Limits**: `maxConcurrentCalls` with retry and file locking interactions
- **Error Aggregation**: Complex scenarios with multiple failure types and retry outcomes
- **Performance Under Load**: Behavior with maximum concurrent calls and frequent retries

**Mocking:**

- **Enhanced Mock [`GeminiChat.sendMessageStream()`](packages/core/src/core/geminiChat.ts:379)**: Control timing, failures, and retry scenarios
- **Mock [`Turn`](packages/core/src/core/turn.ts:163)**: Simulate tool calls requiring file locking
- **Mock File System**: Control file operations for lock testing without actual file I/O
- **Mock Timer Functions**: Control backoff timing and retry scheduling for deterministic testing
- **Mock Telemetry Logger**: Verify proper event logging throughout parallel execution
- **Mock Configuration**: Test various combinations of concurrency, retry, and lock settings

**Edge Cases:**

**Stream Management:**

- **Single Concurrent Call**: Ensure metadata enrichment works correctly for single calls
- **Empty Calls Array**: Handle graceful degradation to sequential processing
- **Stream Error Recovery**: Handle errors in stream multiplexing without corrupting other streams

**File Locking:**

- **Rapid Lock/Unlock Cycles**: Test performance under high-frequency lock operations
- **Lock File Cleanup**: Verify proper cleanup of lock files on process termination
- **Concurrent Lock Requests**: Test fairness and ordering of multiple pending requests
- **Lock Timeout Edge Cases**: Test behavior at exact timeout boundaries

**Retry Logic:**

- **Maximum Retry Exhaustion**: Verify proper failure reporting when all retries are exhausted
- **Immediate Success After Failure**: Test retry cancellation when operation succeeds
- **Network Intermittency**: Simulate various network failure patterns and recovery
- **Resource Exhaustion**: Test retry behavior under resource-constrained conditions

**Complex Scenarios:**

- **Mixed Tool and Non-tool Calls**: Parallel execution with some calls requiring locks, others not
- **Cascading Failures**: Test behavior when multiple concurrent calls fail simultaneously
- **Long-running Operations**: Handle scenarios where some calls significantly outlast others
- **Memory Pressure**: Test behavior under high memory usage from concurrent operations

### Error Handling Strategy

**Enhanced Error Handling with Retry Support:**

- **Use [`reportError()`](packages/core/src/core/client.ts:31)**: For unexpected parallel execution errors with retry context
- **Graceful Degradation**: If parallel execution initialization fails, fall back to sequential processing
- **Configurable Retry Logic**: Individual call failures trigger retry mechanism based on error type and configuration
- **Partial Failure Isolation**: Continue other concurrent calls while failing calls undergo retry attempts
- **Stream Error Events**: Emit enhanced [`GeminiEventType.Error`](packages/core/src/core/turn.ts:49) events with retry metadata
- **AbortSignal Handling**: Respect cancellation requests throughout parallel execution and retry cycles
- **File Lock Error Recovery**: Handle lock acquisition failures with appropriate fallback strategies

**Retry-Enabled Error Scenarios:**

**API-Related Errors (Retryable):**

- **Rate Limiting (429)**: Exponential backoff retry with longer delays
- **Network Timeouts**: Quick retry with standard backoff
- **Server Errors (5xx)**: Configurable retry with exponential backoff
- **Authentication Refresh**: Single retry after token refresh

**Tool Execution Errors (Context-Dependent):**

- **File Lock Timeout**: Retry with extended timeout or queue position advancement
- **Temporary File System Issues**: Retry with backoff for recoverable I/O errors
- **Network-based Tool Failures**: Retry according to network error classification

**Non-Retryable Errors (Immediate Failure):**

- **Malformed Requests (4xx except 429)**: Log and fail immediately
- **Configuration Errors**: Validate and fail fast
- **Authorization Failures (permanent)**: Fail without retry
- **Resource Exhaustion (quota exceeded)**: Fail immediately with clear messaging

**Error Propagation and Aggregation:**

```typescript
interface ParallelExecutionError {
  originalError: Error;
  callId: string;
  retryCount: number;
  isRetryable: boolean;
  lastAttemptTime: number;
  aggregatedContext: {
    totalCalls: number;
    successfulCalls: number;
    failedCalls: number;
    retriesPending: number;
  };
}
```

**Error Context Enrichment:**

- **Call Traceability**: All errors include call ID and original prompt context
- **Retry History**: Error objects include complete retry attempt history
- **Execution Context**: Errors carry information about parallel execution state
- **File Lock Context**: Lock-related errors include lock state and queue information
- **Telemetry Integration**: All errors generate appropriate telemetry events

**Recovery Strategies:**

1. **Individual Call Recovery**: Failed calls retry independently without affecting others
2. **File Lock Recovery**: Lock failures trigger queue advancement or timeout extension
3. **Stream Recovery**: Stream multiplexing errors don't corrupt other concurrent streams
4. **Resource Recovery**: Resource exhaustion triggers cleanup and potential retry
5. **Partial Success Handling**: Return successful results even if some calls ultimately fail

**Error Reporting Enhancement:**

```typescript
interface EnhancedErrorReport {
  executionId: string;
  totalCalls: number;
  completedCalls: number;
  failedCalls: Array<{
    callId: string;
    error: ParallelExecutionError;
    finalRetryAttempt: boolean;
  }>;
  successfulCalls: Array<{
    callId: string;
    result: Turn;
    retryCount: number;
  }>;
  executionSummary: {
    totalDuration: number;
    totalRetries: number;
    lockConflicts: number;
    streamingErrors: number;
  };
}
```

## Build Integration Notes

**Impact on Build Process:**

- **No new dependencies**: Uses existing Node.js async/await and Promise.all patterns
- **TypeScript**: New interfaces will be type-checked during build
- **Testing**: New test files will be included in existing test suite
- **Performance**: Minimal impact as parallel execution is optional feature

**Deployment Considerations:**

- **Backward Compatible**: Existing sequential functionality unchanged
- **Feature Flag**: Controlled by existing [`concurrency.enabled`](packages/core/src/config/config.ts:297) setting
- **Memory Usage**: Parallel execution may increase memory usage temporarily
- **API Quotas**: Users should be aware that concurrent calls may hit rate limits faster

## Clarification Needed

**RESOLVED - User Architectural Decisions:**

1. **✅ Stream Event Ordering Strategy**:
   - **DECISION**: Implement interleaved event streaming for optimal performance
   - **REQUIREMENT**: Each `ServerGeminiStreamEvent` must be enriched with metadata to trace back to original prompt/call

2. **✅ Tool Call Conflict Resolution**:
   - **DECISION**: Enable parallel tool execution
   - **REQUIREMENT**: Implement file locking mechanism to prevent race conditions during parallel file write operations

3. **✅ Error Aggregation Strategy**:
   - **DECISION**: Continue other calls on partial failures
   - **REQUIREMENT**: Implement configurable retry mechanism allowing for `n` retries of failing calls

4. **✅ Memory and Performance Limits**:
   - **DECISION**: Continue with simple `maxConcurrentCalls` limit as planned
   - **IMPLEMENTATION**: No additional safeguards needed for this increment

**No Outstanding Clarifications Required**

## Potential Risks

**Integration Challenges:**

- **Stream Complexity**: Multiplexing multiple async generators adds complexity
- **Event Ordering**: Non-deterministic event ordering may confuse UI components
- **Tool Call Coordination**: Concurrent tool execution may cause race conditions

**Breaking Changes:**

- **None Expected**: All changes maintain existing API compatibility
- **Return Type**: [`sendMessageStream()`](packages/core/src/core/client.ts:298) signature remains unchanged
- **Event Structure**: [`ServerGeminiStreamEvent`](packages/core/src/core/turn.ts:149) types remain compatible

**Performance Concerns:**

- **Memory Usage**: Multiple concurrent API responses may increase memory consumption
- **API Rate Limits**: Concurrent calls may trigger rate limiting more frequently
- **Network Resources**: Multiple simultaneous connections may stress network infrastructure
- **CPU Usage**: Stream multiplexing and event processing overhead

**Mitigation Strategies:**

- **Gradual Rollout**: Start with conservative `maxConcurrentCalls` defaults
- **Monitoring**: Comprehensive telemetry to track performance impact
- **Circuit Breaker**: Ability to disable concurrency if issues arise
- **Resource Limits**: Respect system and API constraints through configuration

## Implementation Sequence

1. **Create Enhanced Configuration**: Extend [`ConcurrencyConfig`](packages/core/src/config/config.ts:66) with retry and file locking options
2. **Implement File Lock Manager**: Create [`FileLockManager`](packages/core/src/core/fileLockManager.ts:1) with comprehensive locking mechanism and tests
3. **Implement Retry Manager**: Create [`RetryManager`](packages/core/src/core/retryManager.ts:1) with configurable retry logic and tests
4. **Create Enhanced Stream Multiplexer**: Implement [`StreamMultiplexer`](packages/core/src/core/streamMultiplexer.ts:1) with metadata enrichment and comprehensive tests
5. **Add Enhanced Telemetry Events**: Extend telemetry system with all new parallel execution, retry, and file locking events
6. **Implement Enhanced Parallel Execution**: Add [`executeParallelPrompts()`](packages/core/src/core/client.ts:1) method with full retry and file locking integration
7. **Integrate File Locking into Turn Execution**: Modify [`Turn.run()`](packages/core/src/core/turn.ts:175) to use file locking for tool operations
8. **Integrate into Stream Flow**: Modify [`sendMessageStream()`](packages/core/src/core/client.ts:298) to use enhanced parallel execution with metadata
9. **Update Non-Interactive CLI**: Ensure [`nonInteractiveCli.ts`](packages/cli/src/nonInteractiveCli.ts:1) handles enhanced concurrent execution with proper retry support
10. **Comprehensive Testing**: Add extensive test coverage for all scenarios including complex retry and file locking interactions
11. **Integration Testing**: Verify end-to-end functionality with real concurrent scenarios
12. **Performance Validation**: Verify performance characteristics under load with retry and file locking overhead

## Success Criteria

**Core Functionality:**

- **Enhanced Parallel Execution**: Multiple prompts execute concurrently with full metadata traceability and retry support
- **Interleaved Stream Events**: Events from concurrent calls are properly interleaved with complete metadata for call identification
- **File Lock Coordination**: Concurrent tool calls safely coordinate file access without race conditions
- **Configurable Retry Logic**: Failed calls retry according to configuration with proper backoff and error classification

**Stream and Event Management:**

- **Metadata-Enriched Events**: All [`ServerGeminiStreamEvent`](packages/core/src/core/turn.ts:149) objects include call traceability metadata
- **Stream Compatibility**: Enhanced events maintain backward compatibility with existing UI and processing components
- **Event Ordering Integrity**: Interleaved events maintain logical coherence and proper temporal context

**Error Handling and Resilience:**

- **Partial Failure Isolation**: Individual call failures don't disrupt other concurrent calls during retry cycles
- **Retry Mechanism Effectiveness**: Failed calls retry according to error type and configuration with proper backoff
- **File Lock Conflict Resolution**: File access conflicts are resolved through proper queueing and timeout handling
- **Graceful Error Aggregation**: Final results properly aggregate successful calls, failed calls, and retry context

**Performance and Resource Management:**

- **File Locking Efficiency**: File locking doesn't significantly impact performance under normal concurrent loads
- **Retry Overhead Management**: Retry logic doesn't cause excessive resource consumption or cascading delays
- **Memory Usage Control**: Concurrent execution with retries maintains reasonable memory usage patterns
- **Performance Benefits**: Demonstrable performance improvement for appropriate concurrent workloads despite overhead

**Configuration and Control:**

- **Enhanced Configuration Support**: All new retry and file locking settings work as expected with proper validation
- **Backward Compatibility**: All existing functionality continues to work unchanged when new features are disabled
- **Telemetry Completeness**: Comprehensive monitoring covers all aspects of enhanced parallel execution behavior
- **Operational Transparency**: Clear visibility into retry attempts, file lock conflicts, and execution metadata through telemetry

**Integration and Compatibility:**

- **Non-Interactive CLI Support**: CLI properly handles enhanced concurrent execution with retry and file locking
- **Tool Integration**: Existing tools work seamlessly with new file locking mechanism
- **Configuration Flexibility**: Users can fine-tune retry and file locking behavior through configuration
- **Deployment Safety**: Feature can be safely enabled/disabled in production environments
