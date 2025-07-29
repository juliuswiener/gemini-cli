# Project Chorus: Concurrent API Orchestration for Gemini CLI

## Executive Summary

Project "Chorus" enhances Gemini CLI with concurrent API orchestration capabilities. Instead of making sequential API calls, Chorus adds a smart concurrency layer in the Core package that can execute multiple parallel API requests and intelligently aggregate the results, delivering faster response times and multi-perspective analysis.

**Core Innovation**: A concurrency orchestration layer integrated into the Core's API interaction flow that can split user queries into parallel API calls and merge results transparently.

## 1. Vision & Technical Focus

### Primary Vision

Transform Gemini CLI's API interaction from sequential-only to intelligently concurrent, enabling faster response times and multi-perspective analysis without changing the user experience.

### Core Technical Innovation

**Concurrent API Orchestration Layer**: An enhancement to the Core package that:

- **Detects Concurrent Opportunities**: Analyzes user input for concurrent call syntax
- **Orchestrates Parallel Calls**: Executes multiple simultaneous API requests to Gemini
- **Aggregates Results**: Intelligently combines parallel responses into coherent outputs
- **Transparent Operation**: Works seamlessly within existing user interaction patterns

### Technical Philosophy

**🔄 Core Integration Only**

- Implement as enhancement to existing Core API interaction layer
- No changes to CLI package or user interface
- Make concurrency an optimization, not a separate feature

**🎯 User-Directed Control**

- Users explicitly specify when to use concurrent calls
- Clear syntax: `call1: ..., call2: ..., call3: ...`
- No automatic detection in initial implementation

**⚡ Incremental Implementation**

- Start with absolute minimum viable functionality
- Test each increment thoroughly before adding complexity
- Build confidence through working prototypes at each step

## 2. Technical Integration with Gemini CLI Architecture

### Current Gemini CLI API Flow

**Existing API Interaction:**

```typescript
// packages/core/src/core/client.ts - current implementation
async *sendMessageStream(
  request: PartListUnion,
  signal: AbortSignal,
  prompt_id: string,
): AsyncGenerator<ServerGeminiStreamEvent, Turn> {
  // Create Turn instance and stream events
  const turn = new Turn(this.getChat(), prompt_id);
  const resultStream = turn.run(request, signal);

  for await (const event of resultStream) {
    yield event; // Stream events: Content, ToolCallRequest, etc.
  }

  return turn;
}
```

### Enhanced API Flow with Concurrency Layer

**New Concurrent API Interaction:**

```typescript
// packages/core/src/core/client.ts - enhanced with concurrency layer
async *sendMessageStream(
  request: PartListUnion,
  signal: AbortSignal,
  prompt_id: string,
): AsyncGenerator<ServerGeminiStreamEvent, Turn> {
  // NEW: Concurrency detection and orchestration
  const concurrencyAnalysis = this.parseConcurrentSyntax(request);

  if (concurrencyAnalysis.hasConcurrentCalls) {
    // NEW: Parallel streaming with event aggregation
    yield* this.executeConcurrentStreams(concurrencyAnalysis.calls, signal, prompt_id);
    return new Turn(this.getChat(), prompt_id);
  }

  // EXISTING: Original sequential streaming unchanged
  const turn = new Turn(this.getChat(), prompt_id);
  const resultStream = turn.run(request, signal);

  for await (const event of resultStream) {
    yield event;
  }

  return turn;
}
```

### Streaming Event Aggregation Strategy

**Core Challenge**: Merge multiple `AsyncGenerator<ServerGeminiStreamEvent>` streams into a single coherent output while preserving real-time streaming behavior.

**Approach**:

```typescript
async *executeConcurrentStreams(
  calls: ConcurrentCall[],
  signal: AbortSignal,
  prompt_id: string,
): AsyncGenerator<ServerGeminiStreamEvent> {
  // Create multiple Turn instances for parallel execution
  const turns = calls.map(call => new Turn(this.getChat(), `${prompt_id}-${call.id}`));
  const streams = turns.map((turn, index) =>
    turn.run(this.buildRequestFromCall(calls[index]), signal)
  );

  // Aggregate streams with proper labeling
  const streamAggregator = new StreamAggregator(calls);

  // Merge streams while maintaining order and attribution
  for await (const event of streamAggregator.mergeStreams(streams)) {
    yield event;
  }
}
```

**Event Transformation Pattern**:

```typescript
// Transform individual call events to include call attribution
{
  type: 'content',
  value: 'Security analysis results...',
  callId: 'call1',
  callTitle: 'Security Analysis'
}
```

### Detailed System Processing Example

**User Input:**

```
call1: Analyze this code for security vulnerabilities, call2: Analyze this code for performance optimization opportunities
```

**Step 1: Syntax Parsing**
The system parses the input and extracts:

```javascript
{
  hasConcurrentCalls: true,
  calls: [
    {
      id: "call1",
      prompt: "Analyze this code for security vulnerabilities"
    },
    {
      id: "call2",
      prompt: "Analyze this code for performance optimization opportunities"
    }
  ]
}
```

**Step 2: Context Building**
For each parsed call, the system builds a complete prompt including:

- The specific call prompt
- Current context (files via @, GEMINI.md memory, etc.)
- Tool schemas (so each call can use tools)
- Session history

**Example Context Building:**

```javascript
// If user had previously used @src/utils.js
const context = {
  files: 'Content of src/utils.js: [file content]',
  memory: 'Content from GEMINI.md files...',
  toolSchemas: 'Available tools: read_file, write_file, web_fetch...',
};

// Final prompts sent to API:
const finalPrompts = [
  `Analyze this code for security vulnerabilities

Context:
${context.files}
${context.memory}

Available tools:
${context.toolSchemas}`,

  `Analyze this code for performance optimization opportunities

Context:
${context.files}
${context.memory}

Available tools:
${context.toolSchemas}`,
];
```

**Step 3: Parallel Streaming Execution**

```javascript
// Execute both calls simultaneously with streaming
const streamPromises = finalPrompts.map(prompt =>
  turn.run(this.buildRequestFromPrompt(prompt), signal)
);

// Merge streams in real-time
const aggregator = new StreamAggregator(['call1', 'call2']);
for await (const event of aggregator.mergeStreams(streamPromises)) {
  yield event; // Stream events with call attribution
}
```

**Step 4: Real-time Event Aggregation**

```javascript
// Events streamed to user in real-time:
{ type: 'content', value: 'Analyzing security...', callId: 'call1' }
{ type: 'content', value: 'Checking performance...', callId: 'call2' }
{ type: 'content', value: 'Found SQL injection risk...', callId: 'call1' }
{ type: 'content', value: 'Identified slow query...', callId: 'call2' }
{ type: 'finished', callId: 'call1' }
{ type: 'finished', callId: 'call2' }
```

**Key Benefits of This Processing:**

- **Same Context**: Both calls receive identical context (files, memory, tools)
- **Independent Analysis**: Each call focuses on its specific perspective
- **Parallel Speed**: Both analyses happen simultaneously instead of sequentially
- **Real-time Streaming**: Results stream as they arrive from each concurrent call
- **Tool Access**: Each concurrent call can use tools like read_file, web_fetch, etc.

**Context Preservation Example:**
If the user had multiple files in context:

```bash
# User previously ran:
gemini @src/auth.js @src/database.js

# Then runs concurrent analysis:
gemini "call1: Check these files for security issues, call2: Optimize these files for performance"

# Both calls receive BOTH auth.js AND database.js content
```

This ensures each concurrent call has complete context to provide thorough analysis.

### CLI Integration (Minimal Interface)

**No CLI Package Changes Required**: The concurrent processing is triggered entirely through user input syntax. The CLI package continues to call `GeminiClient.sendMessageStream()` unchanged.

**User Interface Pattern**:

```bash
# Existing CLI usage patterns work unchanged
gemini -p "call1: prompt1, call2: prompt2"  # Concurrent
gemini -p "regular prompt"                   # Sequential
gemini --force-concurrent -p "prompt"       # Force concurrent
gemini --force-sequential -p "prompt"       # Force sequential
```

**CLI-to-Core Flow**:

```typescript
// packages/cli - no changes needed
// CLI processes user input and passes to Core exactly as before
await geminiClient.sendMessageStream(userInput, signal, promptId);

// packages/core - handles concurrent detection internally
// Based on syntax in userInput, routes to concurrent or sequential processing
```

### Configuration Management (Config Class Integration)

**Minimal Config Integration**: Add concurrent processing settings to existing [`Config`](packages/core/src/config/config.ts:179) class following established patterns.

**New Config Properties**:

```typescript
// Add to ConfigParameters interface (line 135)
export interface ConfigParameters {
  // ... existing properties
  concurrency?: {
    enabled?: boolean;
    maxConcurrentCalls?: number;
    forceProcessing?: 'sequential' | 'concurrent';
  };
}
```

**Config Class Methods**:

```typescript
// Add to Config class (line 179)
export class Config {
  private readonly concurrency: {
    enabled: boolean;
    maxConcurrentCalls: number;
    forceProcessing?: 'sequential' | 'concurrent';
  };

  constructor(params: ConfigParameters) {
    // ... existing constructor
    this.concurrency = {
      enabled: params.concurrency?.enabled ?? true,
      maxConcurrentCalls: params.concurrency?.maxConcurrentCalls ?? 3,
      forceProcessing: params.concurrency?.forceProcessing,
    };
  }

  getConcurrencyEnabled(): boolean {
    return this.concurrency.enabled;
  }

  getMaxConcurrentCalls(): number {
    return this.concurrency.maxConcurrentCalls;
  }

  getForcedProcessingMode(): 'sequential' | 'concurrent' | undefined {
    return this.concurrency.forceProcessing;
  }
}
```

**Settings.json Integration**:

```json
{
  "concurrency": {
    "enabled": true,
    "maxConcurrentCalls": 3,
    "forceProcessing": "sequential"
  }
}
```

**Environment Variable Support**:

```bash
export GEMINI_CONCURRENCY_ENABLED=false
export GEMINI_MAX_CONCURRENT_CALLS=5
export GEMINI_FORCE_PROCESSING=concurrent
```

## 3. Incremental Implementation Strategy

### Increment 1: Basic Syntax Parsing (Minimal Viable Feature)

**Goal**: Parse user input for concurrent call syntax and detect when to use concurrency

**Implementation**:

- Simple regex/string parsing to detect `callN:` patterns in `PartListUnion` request
- Basic validation that calls are properly formatted
- Return parsed structure or fall back to sequential processing

**Test Criteria**:

- Can parse `call1: prompt1, call2: prompt2` syntax from `PartListUnion`
- Correctly identifies concurrent vs sequential inputs
- Gracefully handles malformed syntax

**Code Changes**:

- Add `parseConcurrentSyntax(request: PartListUnion)` function to `GeminiClient`
- Minimal integration into existing `sendMessageStream()` flow
- Handle text extraction from various `Part` types (text, inline data, etc.)

**Integration Point**:

```typescript
// In GeminiClient.sendMessageStream()
const concurrencyAnalysis = this.parseConcurrentSyntax(request);
if (concurrencyAnalysis.hasConcurrentCalls) {
  // Route to concurrent processing
} else {
  // Continue with existing sequential flow
}
```

---

### Increment 2: Parallel Streaming Execution (Core Concurrency)

**Goal**: Execute multiple streaming API calls in parallel and merge event streams

**Implementation**:

- Build multiple `PartListUnion` requests from parsed concurrent calls
- Create multiple `Turn` instances for parallel execution
- Implement `StreamAggregator` class to merge `AsyncGenerator<ServerGeminiStreamEvent>` streams
- Handle basic errors (timeout, API failures) per stream

**Test Criteria**:

- Successfully creates 2-3 parallel streaming calls
- Events from concurrent streams are properly attributed
- Faster execution than sequential equivalent
- Proper error handling when some streams fail

**Code Changes**:

- Add `executeConcurrentStreams()` function to `GeminiClient`
- Implement `StreamAggregator` class for merging async generators
- Add call ID attribution to streaming events
- Basic error handling and timeout management per stream

**Streaming Architecture**:

```typescript
class StreamAggregator {
  async *mergeStreams(
    streams: AsyncGenerator<ServerGeminiStreamEvent>[],
    callIds: string[],
  ): AsyncGenerator<ServerGeminiStreamEvent> {
    // Merge multiple streams with call attribution
    // Handle completion, errors, and ordering
  }
}
```

---

### Increment 3: Basic Result Aggregation (Streaming Result Synthesis)

**Goal**: Combine parallel streaming responses into a coherent aggregated stream

**Implementation**:

- Enhance `StreamAggregator` to group related events by call ID
- Add section headers and clear separation between concurrent call results
- Preserve streaming nature while organizing output

**Test Criteria**:

- Combined streaming results are readable and well-organized
- Each concurrent call result is clearly attributed in real-time
- No data loss during stream aggregation
- Maintains streaming performance benefits

**Code Changes**:

- Enhance `StreamAggregator` with result organization logic
- Add section formatting for streamed content
- Clear labeling of which streamed content came from which call
- Event buffering and ordering logic for clean presentation

**Stream Organization Pattern**:

```typescript
// Events yield pattern:
{ type: 'content', value: '## Security Analysis (call1)\n' }
{ type: 'content', value: 'Found vulnerabilities...', callId: 'call1' }
{ type: 'content', value: '\n## Performance Analysis (call2)\n' }
{ type: 'content', value: 'Optimization opportunities...', callId: 'call2' }
```

---

### Increment 4: Smart Decision Making (LLM-Assisted Prompt Analysis)

**Goal**: Use LLM to analyze prompts and automatically structure concurrent calls when beneficial, with ability to force specific behavior

**Implementation**:

- Check for forced behavior indicators first
- Send user prompt to LLM for analysis with structured response format (if not forced)
- Parse LLM response to determine sequential vs concurrent processing
- If sequential: Use LLM's direct answer
- If concurrent: Execute LLM-structured concurrent calls
- Fallback to manual syntax parsing if LLM analysis fails

**Forced Behavior Interface**:
Users can force specific processing behavior using:

**1. Command Line Flags:**

```bash
gemini --force-sequential -p "Analyze this complex system"
gemini --force-concurrent -p "What is TypeScript?"
```

**2. Prompt Prefixes:**

```bash
# Force sequential processing
gemini "[SEQUENTIAL] Analyze this architecture from multiple perspectives"

# Force concurrent processing
gemini "[CONCURRENT] What is the capital of France?"
```

**3. Environment Variables:**

```bash
export GEMINI_FORCE_PROCESSING=sequential
export GEMINI_FORCE_PROCESSING=concurrent
```

**Processing Priority Order:**

1. **Command Line Flags** (highest priority)
2. **Prompt Prefixes**
3. **Environment Variables**
4. **LLM Analysis** (default when no forcing)
5. **Manual Syntax Parsing** (fallback)

**Structured Response Format**:
The LLM will respond using this JSON structure:

```json
{
  "processing_type": "sequential" | "concurrent",
  "reasoning": "Brief explanation of why this processing type was chosen",
  "sequential_response": "Direct answer to the user's question (only if sequential)",
  "concurrent_calls": [
    {
      "call_id": "call1",
      "prompt": "Specific prompt for this concurrent call",
      "purpose": "What this call is intended to analyze/accomplish",
      "priority": "high" | "medium" | "low"
    }
  ]
}
```

**Example Sequential Response**:

```json
{
  "processing_type": "sequential",
  "reasoning": "This is a straightforward question that benefits from a single comprehensive answer",
  "sequential_response": "TypeScript is a strongly typed programming language that builds on JavaScript by adding static type definitions. It helps catch errors early in development and provides better tooling support..."
}
```

**Example Concurrent Response**:

```json
{
  "processing_type": "concurrent",
  "reasoning": "This complex analysis benefits from multiple specialized perspectives examined in parallel",
  "concurrent_calls": [
    {
      "call_id": "call1",
      "prompt": "Analyze this codebase for security vulnerabilities, focusing on authentication, authorization, and data validation",
      "purpose": "Security analysis",
      "priority": "high"
    },
    {
      "call_id": "call2",
      "prompt": "Analyze this codebase for performance optimization opportunities, focusing on algorithms, database queries, and resource usage",
      "purpose": "Performance analysis",
      "priority": "high"
    },
    {
      "call_id": "call3",
      "prompt": "Analyze this codebase for maintainability and code quality, focusing on structure, documentation, and best practices",
      "purpose": "Code quality analysis",
      "priority": "medium"
    }
  ]
}
```

**LLM Analysis Prompt Template**:

```
Analyze the following user prompt and determine if it would benefit from concurrent processing or sequential processing.

User prompt: "{user_input}"

Consider these factors:
- Can the prompt be broken into multiple independent analysis perspectives?
- Would parallel analysis provide more comprehensive results?
- Is the prompt complex enough to justify multiple API calls?
- Would concurrent processing significantly improve response time?

Respond using this exact JSON format:
{
  "processing_type": "sequential" | "concurrent",
  "reasoning": "Brief explanation",
  "sequential_response": "Direct answer (only if sequential)",
  "concurrent_calls": [array of calls (only if concurrent)]
}

For concurrent calls, create 2-5 focused, specific prompts that together provide comprehensive coverage of the user's request.
```

**Test Criteria**:

- Force flags correctly override LLM analysis in all scenarios
- Prompt prefixes are properly detected and processed
- Environment variables work as expected fallback
- LLM correctly identifies when concurrency would be beneficial (>80% accuracy)
- LLM-generated concurrent call structure is well-formed and logical
- Sequential responses are complete and directly answer the user's question
- Seamless fallback to manual parsing when LLM analysis fails
- Performance improvement through intelligent prompt structuring
- JSON parsing is robust and handles malformed responses

**Code Changes**:

- Add `checkForcedBehavior()` function to detect force flags/prefixes/env vars
- Add `analyzePromptForConcurrency()` function that sends analysis prompt to LLM
- Add `parseStructuredResponse()` function to handle JSON response parsing
- Add `executeSequentialResponse()` for direct LLM answers
- Add `executeConcurrentStreams()` for LLM-structured concurrent calls
- Integration with existing Gemini API for prompt analysis
- Robust error handling and fallback mechanisms for LLM analysis failures

**Processing Flow**:

```typescript
async *sendMessageStream(request: PartListUnion, signal: AbortSignal, prompt_id: string) {
  // Step 1: Check for forced behavior
  const forcedBehavior = this.checkForcedBehavior(request);

  if (forcedBehavior === "sequential") {
    // Force sequential processing - skip LLM analysis
    yield* this.executeSequentialStream(request, signal, prompt_id);
    return;
  }

  if (forcedBehavior === "concurrent") {
    // Force concurrent processing - use manual parsing or simple splitting
    const manualAnalysis = this.parseConcurrentSyntax(request) || this.createSimpleConcurrentSplit(request);
    yield* this.executeConcurrentStreams(manualAnalysis.calls, signal, prompt_id);
    return;
  }

  // Step 2: No forced behavior - use LLM analysis
  try {
    const analysisResponse = await this.analyzePromptForConcurrency(request);
    const structuredResponse = this.parseStructuredResponse(analysisResponse);

    if (structuredResponse.processing_type === "sequential") {
      yield* this.streamDirectResponse(structuredResponse.sequential_response);
    } else {
      yield* this.executeConcurrentStreams(structuredResponse.concurrent_calls, signal, prompt_id);
    }
  } catch (error) {
    // Step 3: Fallback to manual syntax parsing
    const manualAnalysis = this.parseConcurrentSyntax(request);
    if (manualAnalysis.hasConcurrentCalls) {
      yield* this.executeConcurrentStreams(manualAnalysis.calls, signal, prompt_id);
    } else {
      // Standard sequential streaming processing
      yield* this.executeSequentialStream(request, signal, prompt_id);
    }
  }
}
```

**Future Feature Benefits**:

- **Testing**: Force specific behaviors for comprehensive testing
- **Performance Benchmarking**: Compare sequential vs concurrent for same query
- **User Preference**: Allow users to override automatic decisions
- **Feature Development**: Future features can guarantee specific processing behavior
- **Debugging**: Isolate issues by forcing specific processing paths

---

### Increment 5: Context Integration (Existing Feature Compatibility)

**Goal**: Ensure concurrent calls work with existing context features (@files, GEMINI.md, etc.)

**Implementation**:

- Pass current context to each parallel streaming call
- Ensure file contexts and memory work in concurrent scenarios
- Maintain existing behavior for context handling
- Integrate with existing `GeminiChat` history and context systems

**Test Criteria**:

- Concurrent calls with `@file.js` context work correctly
- GEMINI.md memory is properly included in parallel calls
- No regression in existing context features
- Context is consistently applied across all concurrent streams

**Code Changes**:

- Integrate context building into concurrent call preparation
- Ensure context consistency across parallel calls
- Reuse existing context mechanisms from `GeminiClient.getEnvironment()`

---

### Increment 6: Tool Integration (Sequential Tool Usage in Concurrent Context)

**Goal**: Enable tool usage within concurrent calls while respecting the sequential nature of tool execution

**Implementation**:

- Allow concurrent API calls to trigger tool executions within their individual streams
- Handle tool confirmations and security checks sequentially even in concurrent scenarios
- Ensure tool results are properly integrated into concurrent result aggregation
- Respect existing tool execution patterns from `Turn.handlePendingFunctionCall()`

**Test Criteria**:

- Concurrent calls can successfully use tools like `read_file`, `web_fetch`, etc.
- Tool confirmation workflows work correctly in concurrent scenarios
- Tool results are properly included in final aggregated response
- No conflicts between concurrent tool executions
- Tool security and approval mechanisms remain intact

**Code Changes**:

- Integrate existing tool execution flow into concurrent streaming calls
- Handle tool confirmation and security validation for parallel scenarios
- Aggregate tool results along with API responses in streams
- Ensure tool execution remains sequential for safety even within concurrent context

**Tool Execution Pattern**:

```typescript
// Within concurrent streams, tools execute sequentially per call
async *executeConcurrentStreams(calls, signal, prompt_id) {
  for await (const event of this.mergeParallelStreams(calls)) {
    if (event.type === 'tool_call_request') {
      // Tool execution remains sequential within each concurrent call
      yield event; // Request user approval
      // Wait for approval before continuing that specific stream
    }
    yield event;
  }
}
```

---

### Increment 7: Advanced Aggregation (Intelligent Synthesis)

**Goal**: Implement smarter result combination strategies beyond simple concatenation

**Implementation**:

- Conflict detection between parallel results
- Smart merging based on result types
- Quality scoring and confidence weighting
- Cross-call relationship detection

**Test Criteria**:

- Better result quality than simple concatenation
- Proper handling of contradictory parallel results
- Improved readability and coherence
- Intelligent synthesis of related findings across calls

**Code Changes**:

- Enhanced `StreamAggregator` with multiple synthesis strategies
- Result analysis and conflict resolution
- Configurable aggregation approaches
- Cross-reference detection between concurrent call results

---

### Increment 8: Performance Optimization (Production Ready)

**Goal**: Optimize for performance, cost, and reliability in production usage

**Implementation**:

- Rate limiting and quota management across concurrent calls
- Connection pooling and request optimization
- Advanced error recovery and retry logic
- Streaming performance optimizations

**Test Criteria**:

- Efficient API usage with minimal waste
- Robust error handling under various failure conditions
- Acceptable performance under load
- Optimal streaming latency and throughput

**Code Changes**:

- Performance optimizations in concurrent API client usage
- Advanced error handling and recovery mechanisms
- Telemetry integration for monitoring concurrent operations
- Resource management for parallel streams

## 4. Rigorous Testing Strategy

### Per-Increment Testing Protocol

**Critical Rule**: Each increment must pass ALL tests before proceeding to the next increment.

#### Step-by-Step Testing Process

**1. Code Implementation**

- Implement the increment's code changes
- Follow existing Gemini CLI coding patterns and conventions

**2. Full Project Build**

- Build the entire Gemini CLI project: `npm run build`
- **If build fails**:
  - Create diff between current code and last commit: `git diff HEAD`
  - **ONLY the changes in the diff can be causing the error** (last commit worked)
  - Fix build errors using only the diff as error source
  - Repeat build until successful

**3. Unit Tests**

- Run existing test suite: `npm test`
- Add specific unit tests for the new increment functionality
- All tests must pass before proceeding

**4. Integration Tests**

- Run integration test suite: `npm run test:integration`
- Verify no regression in existing Gemini CLI functionality
- Test new increment integrates properly with existing features

**5. CLI Executor Mode Testing**

- Use CLI in executor mode with real prompts: `gemini -p "<test_prompt>"`
- Test both concurrent and sequential prompts relevant to the increment
- Verify actual CLI behavior matches expected functionality

**Example Test Prompts by Increment:**

```bash
# Increment 1 - Syntax Parsing
gemini -p "call1: What is TypeScript, call2: What is JavaScript"

# Increment 2 - Parallel Execution
gemini -p "call1: Explain React hooks, call2: Explain Vue composition API"

# Increment 3 - Result Aggregation
gemini -p "call1: List pros of microservices, call2: List cons of microservices"

# Increment 4 - Smart Decision Making
gemini -p "Analyze this architecture and suggest improvements from multiple perspectives"

# Increment 5 - Context Integration
gemini -p "call1: Review @src/utils.js for bugs, call2: Review @src/utils.js for performance"

# Increment 6 - Tool Integration
gemini -p "call1: Read package.json and analyze dependencies, call2: Run tests and analyze results"
```

**6. Performance Verification**

- Measure response times for concurrent vs sequential execution
- Verify concurrent calls are actually faster when applicable
- Monitor resource usage and API call patterns

**7. Error Scenario Testing**

- Test failure cases (network errors, API timeouts, malformed input)
- Verify graceful degradation and proper error messages
- Ensure system stability under various failure conditions

#### Git Commit Protocol

**Commit Only When Increment is Fully Validated:**

- All builds successful
- All tests passing
- CLI executor mode working correctly
- No regressions detected
- Performance improvements confirmed

**Commit Message Format:**

```
feat: implement concurrency increment N - [increment name]

- Brief description of what was implemented
- Key functionality added
- Test results summary
```

**Example:**

```
feat: implement concurrency increment 2 - parallel streaming execution

- Added executeConcurrentStreams() function to GeminiClient
- Implemented StreamAggregator for merging async generators
- Parallel streaming execution with event attribution
- Tested with 2-3 parallel calls, 40% performance improvement
```

### Continuous Validation Strategy

**Build Validation Pipeline:**

```bash
# After each code change
npm run build          # Must succeed
npm test              # Must pass
npm run test:integration  # Must pass
gemini -p "test prompt"   # Must work correctly
```

**Diff-Based Error Analysis:**

- When any step fails, immediately run: `git diff HEAD`
- Focus error investigation only on changed lines
- Previous commit is known working state - only changes can cause issues
- Fix incrementally and re-test

### Risk Mitigation Through Testing

**Build Failure Recovery:**

1. Stop all development
2. Generate diff: `git diff HEAD > current_changes.diff`
3. Analyze only the changes in the diff file
4. Fix errors systematically
5. Re-run build pipeline
6. Continue only when build is clean

**Regression Detection:**

- Every increment must maintain all existing functionality
- CLI executor mode tests with existing prompts must continue working
- Performance must not degrade for sequential use cases

**Quality Gates:**

- No increment proceeds without full validation
- No commit until increment is completely stable
- No skipping of testing phases

This rigorous testing approach ensures each increment is solid before building the next, preventing accumulation of technical debt and maintaining system stability throughout development.

## 5. Risk Mitigation

### Technical Risks

- **API Rate Limiting**: Multiple concurrent calls may exceed API limits
  - _Mitigation_: Built-in rate limiting and request queuing
- **Increased Costs**: More API calls mean higher usage costs
  - _Mitigation_: User awareness and optional cost controls
- **Complexity**: Risk of introducing bugs in Core package
  - _Mitigation_: Incremental approach with thorough testing at each step

### Implementation Risks

- **Integration Complexity**: Changes to Core might break existing functionality
  - _Mitigation_: Additive changes only, extensive regression testing
- **Performance Degradation**: Overhead from concurrency analysis
  - _Mitigation_: Minimal parsing overhead, fast fallback to sequential processing
