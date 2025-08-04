# System Design Specification: Project Chorus - Concurrent API Orchestration

- **Date**: 2025-07-29
- **Version**: 1.0
- **Authored By**: Detailler Mode
- **Last Updated**: 2025-07-29 11:31 UTC+2:00

---

## 1. Introduction

Project "Chorus" enhances the Gemini CLI by introducing a concurrent API orchestration layer. This layer enables parallel execution of multiple API requests to the Gemini model, intelligently aggregating results to deliver faster response times and multi-perspective analysis. This document outlines the high-level system design, architectural principles, module definitions, and key data flows for this new capability.

---

## 2. Architectural Principles

- **Core Integration Only**: New functionality integrates directly into the existing `packages/core` API interaction layer, minimizing changes to the CLI package and user interface. Concurrency is an optimization, not a separate feature.
- **User-Directed Control**: Users explicitly trigger concurrent calls via defined syntax or configuration, providing clear control.
- **Incremental Implementation**: Development proceeds in small, testable increments, building confidence through working prototypes.
- **Transparency**: The concurrency layer operates seamlessly within existing user interaction patterns, providing attributed, real-time streaming output.
- **Modularity**: Clear separation of concerns for parsing, execution, and aggregation logic.
- **Extensibility**: Design allows for future enhancements, such as more sophisticated LLM-assisted decision-making and advanced aggregation strategies.
- **Robustness**: Comprehensive error handling, retry mechanisms, and graceful fallbacks are prioritized.

---

## 3. System Boundaries and Modules

The core concurrency logic resides within the `packages/core` module, specifically enhancing the `GeminiClient`.

### 3.1. External Systems

- **Gemini API**: External large language model service.
- **User (via CLI)**: Interacts with the Gemini CLI, providing prompts and receiving responses.
- **File System**: For context (`@files`) and tool interactions (`read_file`, `write_file`).
- **Web**: For `web_fetch` tool interactions.

### 3.2. Internal Modules (`packages/core`)

#### `GeminiClient` (Enhanced)

- **Responsibility**: Orchestrates the overall API interaction flow.
- **Key Enhancements**:
  - **Concurrency Detection**: Determines if a user prompt requires sequential or concurrent processing (via `ConcurrentSyntaxParser` or LLM analysis).
  - **Execution Routing**: Directs requests to either the existing sequential flow or the new concurrent flow (`executeConcurrentStreams`).
  - **Context Management**: Ensures all concurrent calls receive the appropriate session context.

#### `ConcurrentSyntaxParser` (New Module/Component)

- **Responsibility**: Parses user input strings to detect explicit concurrent call syntax (`callN: prompt`).
- **Inputs**: `PartListUnion` (user prompt).
- **Outputs**: `ConcurrencyAnalysis` object (`{ hasConcurrentCalls: boolean, calls: ConcurrentCall[] }`).

#### `StreamAggregator` (New Module)

- **Responsibility**: Merges multiple `AsyncGenerator<ServerGeminiStreamEvent>` streams into a single coherent output stream, preserving real-time behavior and attributing events to their source calls.
- **Inputs**: Array of `AsyncGenerator<ServerGeminiStreamEvent>`, array of `ConcurrentCall` metadata.
- **Outputs**: Single `AsyncGenerator<ServerGeminiStreamEvent>` (aggregated and attributed).
- **Key Capabilities**: Basic error handling per stream, event transformation for attribution, potential for advanced synthesis.

#### `CoreToolScheduler` (Modified/Enhanced)

- **Responsibility**: Manages the lifecycle of tool calls, including validation, user approval, and execution.
- **Key Enhancements**:
  - **Concurrent Tool Call Management**: Adapt to handle tool call requests originating from multiple concurrent streams.
  - **Sequential Approval Enforcement**: Ensure user confirmations for tools (especially destructive ones like `write_file`) remain strictly sequential and centralized, even if multiple concurrent calls request tools.
  - **Stream Pausing/Resuming**: Mechanism to pause the specific concurrent stream that triggered a tool requiring approval, and resume it upon confirmation/rejection.

#### `Config` (Enhanced)

- **Responsibility**: Manages application configuration, including new concurrency settings.
- **Key Enhancements**:
  - New properties: `concurrency.enabled`, `concurrency.maxConcurrentCalls`, `concurrency.forceProcessing`.
  - Provides getter methods for these settings.
  - Loads settings from `settings.json` and environment variables.

---

## 4. Data Flow and Interfaces

### 4.1. High-Level API Interaction Flow

1.  **User Input**: `Gemini CLI User` provides a prompt to `packages/cli`.
2.  **CLI to Core**: `packages/cli` passes the `PartListUnion` request to `GeminiClient.sendMessageStream()`.
3.  **Concurrency Analysis**: Inside `sendMessageStream()`:
    a. `GeminiClient` first checks for forced processing mode (CLI flags, prompt prefixes, env vars).
    b. If no forced mode, `GeminiClient` calls `analyzePromptForConcurrency` (LLM-assisted analysis, Iteration 3).
    c. If LLM analysis fails or is skipped, `GeminiClient` calls `ConcurrentSyntaxParser.parseConcurrentSyntax()`.
4.  **Execution Branching**:
    a. If `concurrencyAnalysis.hasConcurrentCalls` (or forced concurrent):
    i. `GeminiClient` calls `executeConcurrentStreams(concurrencyAnalysis.calls, signal, prompt_id)`.
    b. Else (sequential or forced sequential):
    i. `GeminiClient` continues with existing sequential `Turn.run()` flow.
5.  **Parallel Execution (`executeConcurrentStreams`)**:
    a. For each `ConcurrentCall`:
    i. A new `Turn` instance is created.
    ii. The `Turn` instance's `run()` method is called, passing the specific prompt for that call, along with the shared context (files, memory, tool schemas).
    iii. These `Turn.run()` calls are executed in parallel, each returning an `AsyncGenerator<ServerGeminiStreamEvent>`.
    b. An instance of `StreamAggregator` is created with the list of concurrent calls.
    c. `StreamAggregator.mergeStreams()` is called with the array of `AsyncGenerator`s.
6.  **Stream Aggregation (`StreamAggregator`)**:
    a. Receives events from all parallel streams in real-time.
    b. Transforms events to include `callId` and `callTitle` for attribution.
    c. Yields aggregated `ServerGeminiStreamEvent`s to the `GeminiClient.sendMessageStream()` caller.
7.  **Tool Call Handling (within `StreamAggregator` / `CoreToolScheduler`)**:
    a. If a `tool_call_request` event is received from any individual stream:
    i. The `StreamAggregator` yields this event to `sendMessageStream`.
    ii. `sendMessageStream` (or a dedicated orchestrator) interacts with `CoreToolScheduler` to manage the tool call.
    iii. `CoreToolScheduler` handles user confirmation (sequentially).
    iv. The specific stream that triggered the tool call is paused until confirmation/execution completes.
    v. Upon completion, the tool result is injected back into the stream, and the stream resumes.
8.  **Final Response**: `GeminiClient.sendMessageStream()` returns the final `Turn` object (or a consolidated `Turn` for concurrent calls).

### 4.2. Key Interfaces

- `PartListUnion`: Existing type for user input.
- `ServerGeminiStreamEvent`: Existing type for streaming events.
- `Turn`: Existing class for managing a single conversation turn.
- `ConcurrentCall`: `{ id: string, prompt: string, purpose?: string, priority?: 'high' | 'medium' | 'low' }` - Represents a single parsed concurrent prompt.
- `ConcurrencyAnalysis`: `{ hasConcurrentCalls: boolean, calls: ConcurrentCall[] }` - Result of parsing/LLM analysis.
- `StreamAggregator`:
  - `constructor(calls: ConcurrentCall[])`
  - `mergeStreams(streams: AsyncGenerator<ServerGeminiStreamEvent>[]): AsyncGenerator<ServerGeminiStreamEvent>`
- `ConfigParameters` (extended):
  - `concurrency?: { enabled?: boolean; maxConcurrentCalls?: number; forceProcessing?: 'sequential' | 'concurrent'; }`
- `CoreToolScheduler` (modified):
  - Needs to support multiple concurrent tool call requests, potentially by managing per-stream queues or a more sophisticated global queue that allows pausing/resuming specific streams.
  - `schedule(request: ToolCallRequestInfo | ToolCallRequestInfo[], signal: AbortSignal): Promise<void>` (existing, but needs to handle concurrent requests without global lock).
  - `handleConfirmationResponse(callId: string, ...)` (existing, but needs to signal stream to resume).

---

## 5. Technology and Pattern Decisions

- **Core Language & Runtime**: TypeScript, Node.js.
- **Concurrency Model**: `AsyncGenerator` for streaming, `Promise.all` (or similar) for parallel execution of `Turn.run()`.
- **Parsing**: Regular expressions for initial syntax parsing (Increment 1).
- **LLM Integration**: Existing Gemini API for LLM-assisted prompt analysis (Increment 3). Prompt engineering techniques (few-shot, Chain-of-Thought) for accuracy.
- **Stream Aggregation**: Custom `StreamAggregator` class. Initial implementation will focus on basic merging with attribution. Advanced synthesis (conflict detection, quality scoring) will be considered for future increments, potentially using a secondary LLM call or rule-based heuristics.
- **Tool Scheduling**: The `CoreToolScheduler` will be modified to handle tool requests from multiple concurrent streams. The primary approach will be to adapt `CoreToolScheduler` to manage multiple independent tool queues (one per concurrent stream), while maintaining a single, sequential flow for user confirmations. This avoids duplicating the complex `CoreToolScheduler` logic and centralizes security-critical approval.
- **Configuration**: Leverage existing `Config` class, `settings.json`, and environment variables for concurrency settings.
- **Performance**: Implement client-side rate limiting (e.g., token bucket), reuse HTTP/2 connections (gRPC channels), and exponential backoff for retries. Streaming buffering/batching will be considered for fine-tuning.

---

## 6. Risks and Uncertainties (from Research Log)

- **Tool Usage within Concurrent Streams (US-006)**:
  - **Decision**: Modify `CoreToolScheduler` to manage multiple independent tool queues, one per concurrent stream. User confirmations remain sequential and centralized. This requires careful design to ensure correct pausing/resuming of individual `AsyncGenerator` streams.
  - **Knowledge Gap**: Specific implementation details for pausing and resuming individual `AsyncGenerator` streams in TypeScript/JavaScript. This might require custom `Promise` or `async/await` patterns.
- **LLM Accuracy for Intelligent Prompt Processing (US-002)**:
  - **Decision**: Prioritize advanced prompt engineering (few-shot/Chain-of-Thought) for initial implementation.
  - **Knowledge Gap**: Exact performance impact of LLM-based prompt analysis on overall response times and API costs. Requires benchmarking.
- **Advanced Stream Aggregation Algorithms (US-004)**:
  - **Decision**: Initial implementation will focus on basic merging with attribution. Advanced synthesis will be a later increment, likely requiring LLM-based post-processing or rule-based heuristics.
- **Performance Optimization Strategies (US-008)**:
  - **Decision**: Implement standard best practices: client-side rate limiting, connection pooling, exponential backoff.
  - **Knowledge Gap**: Optimal balance between real-time streaming and buffering/batching for aggregated outputs.

---

## 7. Development Tickets (for Iteration 1)

(To be generated in the next step)

---

## 8. System Design History

- **2025-07-29** – Detailler Mode: Initial system design specification created based on strategic plan, user stories, and research findings.
