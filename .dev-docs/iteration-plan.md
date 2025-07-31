# Strategic Plan: Project Chorus Roadmap

- **Iteration Period**: TBD – TBD
- **Iteration Goal**: Deliver a fully functional, performant, and intelligently automated concurrent API orchestration layer for Gemini CLI.
- **Status**: Planned
- **Planned By**: Strategic Planner Mode

---

## 1. User Stories Included _(References to validated stories)_

### Iteration 1: Core Concurrency MVP

- **Iteration Goal**: Deliver a functional core concurrency layer allowing users to explicitly trigger parallel API calls and receive aggregated streaming output.

- **US-001**: Basic User-Directed Concurrent Calls
  - **Link to Story**: [`./.dev-docs/user-stories.md#user-story-basic-user-directed-concurrent-calls`](./.dev-docs/user-stories.md#user-story-basic-user-directed-concurrent-calls)
  - **Priority**: Must-have
  - **Initial Effort Estimate**: Medium

- **US-004**: Real-time Aggregated Streaming Output
  - **Link to Story**: [`./.dev-docs/user-stories.md#user-story-real-time-aggregated-streaming-output`](./.dev-docs/user-stories.md#user-story-real-time-aggregated-streaming-output)
  - **Priority**: Must-have
  - **Initial Effort Estimate**: Medium

- **US-007**: Configurable Concurrency Settings
  - **Link to Story**: [`./.dev-docs/user-stories.md#user-story-configurable-concurrency-settings`](./.dev-docs/user-stories.md#user-story-configurable-concurrency-settings)
  - **Priority**: Should-have
  - **Initial Effort Estimate**: Small

- **US-008**: Standardized Build Process
  - **Link to Story**: [`./.dev-docs/user-stories.md#user-story-standardized-build-process`](./.dev-docs/user-stories.md#user-story-standardized-build-process)
  - **Priority**: Must-have
  - **Initial Effort Estimate**: Ongoing

- **US-009**: Build Failure Diagnosis
  - **Link to Story**: [`./.dev-docs/user-stories.md#user-story-build-failure-diagnosis`](./.dev-docs/user-stories.md#user-story-build-failure-diagnosis)
  - **Priority**: Must-have
  - **Initial Effort Estimate**: Ongoing

- **US-010**: Incremental Feature Development
  - **Link to Story**: [`./.dev-docs/user-stories.md#user-story-incremental-feature-development`](./.dev-docs/user-stories.md#user-story-incremental-feature-development)
  - **Priority**: Must-have
  - **Initial Effort Estimate**: Ongoing

- **US-011**: Rigorous Per-Increment Testing
  - **Link to Story**: [`./.dev-docs/user-stories.md#user-story-rigorous-per-increment-testing`](./.dev-docs/user-stories.md#user-story-rigorous-per-increment-testing)
  - **Priority**: Must-have
  - **Initial Effort Estimate**: Ongoing

- **US-012**: Issue Tracking and Resolution
  - **Link to Story**: [`./.dev-docs/user-stories.md#user-story-issue-tracking-and-resolution`](./.dev-docs/user-stories.md#user-story-issue-tracking-and-resolution)
  - **Priority**: Must-have
  - **Initial Effort Estimate**: Ongoing

### Iteration 2: Enhanced Control & Developer Experience

- **Iteration Goal**: Provide users with explicit control over processing modes and ensure concurrent calls fully leverage existing context and tools.

- **US-003**: Forced Processing Mode
  - **Link to Story**: [`./.dev-docs/user-stories.md#user-story-forced-processing-mode`](./.dev-docs/user-stories.md#user-story-forced-processing-mode)
  - **Priority**: Must-have
  - **Initial Effort Estimate**: Medium

- **US-005**: Context-Aware Concurrent Calls
  - **Link to Story**: [`./.dev-docs/user-stories.md#user-story-context-aware-concurrent-calls`](./.dev-docs/user-stories.md#user-story-context-aware-concurrent-calls)
  - **Priority**: Should-have
  - **Initial Effort Estimate**: Medium

- **US-006**: Tool Usage within Concurrent Calls
  - **Link to Story**: [`./.dev-docs/user-stories.md#user-story-tool-usage-within-concurrent-calls`](./.dev-docs/user-stories.md#user-story-tool-usage-within-concurrent-calls)
  - **Priority**: Should-have
  - **Initial Effort Estimate**: Large

### Iteration 3: Intelligent Automation & Optimizations

- **Iteration Goal**: Introduce LLM-assisted intelligent decision-making for concurrency and optimize the system for production readiness.

- **US-002**: Intelligent Prompt Processing
  - **Link to Story**: [`./.dev-docs/user-stories.md#user-story-intelligent-prompt-processing`](./.dev-docs/user-stories.md#user-story-intelligent-prompt-processing)
  - **Priority**: Should-have
  - **Initial Effort Estimate**: Medium

- **US-004**: Real-time Aggregated Streaming Output (Advanced Aggregation)
  - **Link to Story**: [`./.dev-docs/user-stories.md#user-story-real-time-aggregated-streaming-output`](./.dev-docs/user-stories.md#user-story-real-time-aggregated-streaming-output)
  - **Priority**: Could-have
  - **Initial Effort Estimate**: Large

- **US-008**: Performance Optimization
  - **Link to Story**: [`./.dev-docs/user-stories.md#user-story-performance-optimization`](./.dev-docs/user-stories.md#user-story-performance-optimization)
  - **Priority**: Could-have
  - **Initial Effort Estimate**: Large

---

## 2. Iteration Tasks & Deliverables _(Atomic, Traceable Units)_

### Iteration 1: Core Concurrency MVP

### Task 1.1: Implement `parseConcurrentSyntax` function.
- **Associated User Story(s)**: US-001
- **Description**: Develop regex/string parsing to detect `callN:` patterns in `PartListUnion` request. Handle text extraction from various `Part` types.
- **Estimated Effort**: Small
- **Dependencies**: None
- **Acceptance Criteria**:
  - `parseConcurrentSyntax(request: PartListUnion)` function correctly identifies concurrent call syntax.
  - Extracts `callId` and `prompt` for each concurrent call.
  - Gracefully handles malformed syntax, returning `hasConcurrentCalls: false`.
- **Assigned To**: Coder

### Task 1.2: Integrate `parseConcurrentSyntax` into `sendMessageStream`.
- **Associated User Story(s)**: US-001
- **Description**: Modify `GeminiClient.sendMessageStream()` to call `parseConcurrentSyntax` and route to concurrent processing if `hasConcurrentCalls` is true, else continue sequential flow.
- **Estimated Effort**: Small
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - `sendMessageStream` correctly branches based on `concurrencyAnalysis.hasConcurrentCalls`.
  - Existing sequential flow remains unchanged when no concurrent calls are detected.
- **Assigned To**: Coder

### Task 1.3: Implement `StreamAggregator` class.
- **Associated User Story(s)**: US-004
- **Description**: Create `StreamAggregator` class to merge `AsyncGenerator<ServerGeminiStreamEvent>` streams, including basic error handling per stream.
- **Estimated Effort**: Medium
- **Dependencies**: None
- **Acceptance Criteria**:
  - `StreamAggregator` can merge multiple `AsyncGenerator` instances into a single stream.
  - Events from different streams are yielded in real-time.
  - Basic error in one stream does not halt other streams.
- **Assigned To**: Coder

### Task 1.4: Implement `executeConcurrentStreams` function.
- **Associated User Story(s)**: US-004
- **Description**: Build multiple `PartListUnion` requests from parsed concurrent calls, create multiple `Turn` instances, and use `StreamAggregator` to merge event streams. Add call ID attribution to streaming events.
- **Estimated Effort**: Medium
- **Dependencies**: Task 1.1, Task 1.3
- **Acceptance Criteria**:
  - `executeConcurrentStreams` successfully initiates parallel `Turn.run` calls.
  - Events yielded include `callId` and `callTitle` for attribution.
  - Aggregated output is coherent and readable.
- **Assigned To**: Coder

### Task 1.5: Integrate basic concurrency config.
- **Associated User Story(s)**: US-007
- **Description**: Add `concurrency` properties (`enabled`, `maxConcurrentCalls`, `forceProcessing`) to `ConfigParameters` interface and `Config` class. Implement getter methods.
- **Estimated Effort**: Small
- **Dependencies**: None
- **Acceptance Criteria**:
  - `ConfigParameters` interface updated with `concurrency` object.
  - `Config` class constructor initializes `concurrency` with defaults.
  - `getConcurrencyEnabled()`, `getMaxConcurrentCalls()`, `getForcedProcessingMode()` return correct values.
- **Assigned To**: Coder

### Task 1.6: Ensure build protocol adherence.
- **Associated User Story(s)**: US-008, US-009, US-010, US-011, US-012
- **Description**: Verify that development adheres to the defined build protocol (`npm install`, `npm run preflight`, `npm run build all`), incremental development, rigorous per-increment testing, and issue tracking. This is an ongoing process task.
- **Estimated Effort**: Ongoing
- **Dependencies**: None
- **Acceptance Criteria**:
  - All builds pass before commits.
  - All tests pass for each increment.
  - Issues are tracked in `issue_tracker.md`.
  - Development proceeds incrementally.
- **Assigned To**: All Developers

### Iteration 2: Enhanced Control & Developer Experience

### Task 2.1: Implement `checkForcedBehavior` function.
- **Associated User Story(s)**: US-003
- **Description**: Develop function to detect force flags (`--force-sequential`, `--force-concurrent`), prompt prefixes (`[SEQUENTIAL]`, `[CONCURRENT]`), and environment variables (`GEMINI_FORCE_PROCESSING`). Implement priority order.
- **Estimated Effort**: Medium
- **Dependencies**: None
- **Acceptance Criteria**:
  - Function correctly identifies and prioritizes forced behavior.
  - Returns `sequential`, `concurrent`, or `undefined` based on input.
- **Assigned To**: Coder

### Task 2.2: Integrate forced behavior into `sendMessageStream`.
- **Associated User Story(s)**: US-003
- **Description**: Modify `sendMessageStream` to use `checkForcedBehavior` and route processing accordingly (sequential, concurrent via manual parsing/simple splitting).
- **Estimated Effort**: Small
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - `sendMessageStream` respects forced behavior flags/prefixes/env vars.
  - Correctly routes to sequential or concurrent processing paths.
- **Assigned To**: Coder

### Task 2.3: Integrate context building into concurrent calls.
- **Associated User Story(s)**: US-005
- **Description**: Ensure current context (files, GEMINI.md memory, tool schemas) is passed to each parallel streaming call. Reuse existing `GeminiClient.getEnvironment()` mechanisms.
- **Estimated Effort**: Medium
- **Dependencies**: Task 1.4
- **Acceptance Criteria**:
  - Concurrent calls receive identical file, memory, and tool schema contexts.
  - Analyses from parallel calls are consistent with provided context.
- **Assigned To**: Coder

### Task 2.4: Enable tool execution within concurrent streams.
- **Associated User Story(s)**: US-006
- **Description**: Integrate existing tool execution flow into concurrent streaming calls. Handle sequential tool confirmations and security validation within parallel scenarios. Aggregate tool results.
- **Estimated Effort**: Large
- **Dependencies**: Task 1.4, Task 2.3
- **Acceptance Criteria**:
  - Concurrent calls can successfully trigger and execute tools.
  - Tool confirmations are handled sequentially per tool call.
  - Tool results are correctly integrated into the aggregated output.
  - No deadlocks or conflicts occur due to concurrent tool usage.
- **Assigned To**: Coder

### Iteration 3: Intelligent Automation & Optimizations

### Task 3.1: Implement LLM-assisted prompt analysis.
- **Associated User Story(s)**: US-002
- **Description**: Add `analyzePromptForConcurrency()` to send user prompt to LLM for analysis (structured JSON response). Implement `parseStructuredResponse()` for JSON parsing.
- **Estimated Effort**: Medium
- **Dependencies**: None (LLM integration is new)
- **Acceptance Criteria**:
  - `analyzePromptForConcurrency` sends prompt to LLM and receives structured response.
  - `parseStructuredResponse` correctly parses LLM's JSON output.
  - LLM identifies concurrent opportunities with >80% accuracy.
- **Assigned To**: Coder

### Task 3.2: Integrate LLM analysis into `sendMessageStream`.
- **Associated User Story(s)**: US-002
- **Description**: Modify `sendMessageStream` to use LLM analysis when no forced behavior is detected. Route to sequential or concurrent processing based on LLM response. Implement `streamDirectResponse()` for sequential LLM answers.
- **Estimated Effort**: Medium
- **Dependencies**: Task 3.1, Task 1.4
- **Acceptance Criteria**:
  - `sendMessageStream` uses LLM analysis as default processing mode.
  - Correctly routes based on LLM's `processing_type`.
  - Graceful fallback to manual parsing/sequential if LLM analysis fails.
- **Assigned To**: Coder

### Task 3.3: Implement advanced stream aggregation.
- **Associated User Story(s)**: US-004 (Advanced Aggregation)
- **Description**: Enhance `StreamAggregator` with smarter result combination strategies (e.g., conflict detection, quality scoring, cross-call relationship detection).
- **Estimated Effort**: Large
- **Dependencies**: Task 1.3
- **Acceptance Criteria**:
  - Aggregated results show improved coherence and readability.
  - Conflicts between parallel results are detected and handled.
  - Cross-call relationships are identified and synthesized.
- **Assigned To**: Coder

### Task 3.4: Implement performance optimizations.
- **Associated User Story(s)**: US-008
- **Description**: Implement rate limiting, quota management, connection pooling, advanced error recovery, and streaming performance optimizations.
- **Estimated Effort**: Large
- **Dependencies**: All core concurrency features.
- **Acceptance Criteria**:
  - API usage is efficient and within limits.
  - System remains stable under various failure conditions.
  - Measurable performance improvements (e.g., faster response times).
  - Optimal streaming latency and throughput.
- **Assigned To**: Coder

---

## 3. Dependencies & Critical Path

### Iteration 1
- **Internal Dependencies**:
  - Task 1.2 depends on Task 1.1
  - Task 1.4 depends on Task 1.1, Task 1.3
- **External Dependencies**: None identified
- **Critical Path**: `Task 1.1 → Task 1.2 → Task 1.4` (Core concurrent execution flow)

### Iteration 2
- **Internal Dependencies**:
  - Task 2.2 depends on Task 2.1
  - Task 2.3 depends on Task 1.4
  - Task 2.4 depends on Task 1.4, Task 2.3
- **External Dependencies**: None identified
- **Critical Path**: `Task 2.1 → Task 2.2` (Forced behavior control) and `Task 2.3 → Task 2.4` (Context and Tooling)

### Iteration 3
- **Internal Dependencies**:
  - Task 3.2 depends on Task 3.1, Task 1.4
  - Task 3.3 depends on Task 1.3
  - Task 3.4 depends on all core concurrency features.
- **External Dependencies**: None identified
- **Critical Path**: `Task 3.1 → Task 3.2` (LLM-assisted intelligence) and `Task 3.3` (Advanced Aggregation) and `Task 3.4` (Performance)

---

## 4. Risks and Uncertainties _(Requiring Downstream Action)_

### Iteration 2
- **Uncertainty**: Tool Usage within Concurrent Streams (US-006) - Potential complexity in managing sequential tool confirmations within parallel streams.
  - **Impact**: Risk of deadlocks, unexpected behavior, or poor user experience.
  - **Action Needed**: Researcher/Detailler Mode to investigate and define robust interaction patterns for tool execution and confirmation in a concurrent environment.
  - **Status**: Pending Researcher/Detailler input

### Iteration 3
- **Uncertainty**: LLM Accuracy for Intelligent Prompt Processing (US-002) - Accuracy of LLM in identifying concurrency opportunities and generating optimal sub-prompts.
  - **Impact**: Suboptimal processing, reduced performance benefits, or incorrect responses.
  - **Action Needed**: Researcher Mode to investigate LLM prompt engineering strategies, fine-tuning options, and define robust fallback mechanisms.
  - **Status**: Pending Researcher input

- **Uncertainty**: Advanced Stream Aggregation Algorithms (US-004) - Complexity of intelligent synthesis algorithms (e.g., conflict detection, quality scoring, cross-call relationship detection).
  - **Impact**: Suboptimal or confusing aggregated results.
  - **Action Needed**: Researcher/Detailler Mode to investigate and propose suitable algorithms and data structures for intelligent stream aggregation.
  - **Status**: Pending Researcher/Detailler input

- **Uncertainty**: Performance Optimization Strategies (US-008) - Identifying specific performance bottlenecks and optimal mitigation strategies (e.g., rate limiting, connection pooling).
  - **Impact**: Suboptimal performance, increased costs, or API rate limit issues.
  - **Action Needed**: Researcher Mode to investigate profiling tools, benchmarking methodologies, and best practices for concurrent API client optimization.
  - **Status**: Pending Researcher input

---

## 5. Key Decisions & Assumptions

- **Decision**: Project Chorus will be implemented incrementally, following the 8 increments outlined in `implementation_guide.md`.
- **Decision**: The initial MVP (Iteration 1) will focus on user-directed concurrency, basic streaming aggregation, and foundational configuration.
- **Decision**: Development and operational processes (build, testing, issue tracking) are considered ongoing "must-have" tasks for all iterations.
- **Assumption**: The existing Gemini CLI architecture in `packages/core/src/core/client.ts` is suitable for integration with the new concurrency layer without major refactoring outside the specified areas.
- **Assumption**: The `PartListUnion` request structure is flexible enough to accommodate concurrent call syntax.

---

## 6. Notes & Iteration History

- **[Date: 2025-07-29]** – Strategic Planner: _Initial strategic plan created based on `.chorus` documentation and validated user stories._