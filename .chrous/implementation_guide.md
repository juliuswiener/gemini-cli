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
// packages/core - current implementation
async processUserInput(input: string) {
  const prompt = this.buildPrompt(input, context);
  const response = await this.geminiApiClient.sendRequest(prompt);
  return this.processResponse(response);
}
```

### Enhanced API Flow with Concurrency Layer

**New Concurrent API Interaction:**
```typescript
// packages/core - enhanced with concurrency layer
async processUserInput(input: string) {
  const concurrencyAnalysis = this.parseConcurrentSyntax(input);
  
  if (concurrencyAnalysis.hasConcurrentCalls) {
    return this.executeConcurrentCalls(concurrencyAnalysis.calls, context);
  } else {
    // Existing sequential behavior unchanged
    const prompt = this.buildPrompt(input, context);
    const response = await this.geminiApiClient.sendRequest(prompt);
    return this.processResponse(response);
  }
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
  files: "Content of src/utils.js: [file content]",
  memory: "Content from GEMINI.md files...",
  toolSchemas: "Available tools: read_file, write_file, web_fetch..."
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
${context.toolSchemas}`
];
```

**Step 3: Parallel Execution**
```javascript
// Execute both calls simultaneously
const promises = finalPrompts.map(prompt => 
  this.geminiApiClient.sendRequest(prompt)
);
const results = await Promise.all(promises);

// Results array contains:
// results[0] = response to security analysis
// results[1] = response to performance analysis
```

**Step 4: Result Aggregation**
```javascript
const aggregatedResult = {
  summary: "Combined analysis results:",
  sections: [
    {
      title: "Security Analysis (call1)",
      content: results[0].content
    },
    {
      title: "Performance Analysis (call2)", 
      content: results[1].content
    }
  ]
};
```

**Final Output to User:**
```markdown
# Combined Analysis Results

## Security Analysis (call1)
[Security vulnerabilities found, recommendations, etc.]

## Performance Analysis (call2)  
[Performance bottlenecks identified, optimization suggestions, etc.]
```

**Key Benefits of This Processing:**
- **Same Context**: Both calls receive identical context (files, memory, tools)
- **Independent Analysis**: Each call focuses on its specific perspective
- **Parallel Speed**: Both analyses happen simultaneously instead of sequentially
- **Comprehensive Results**: User gets complete multi-perspective analysis
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

## 3. Incremental Implementation Strategy

### Increment 1: Basic Syntax Parsing (Minimal Viable Feature)
**Goal**: Parse user input for concurrent call syntax and detect when to use concurrency

**Implementation**:
- Simple regex/string parsing to detect `callN:` patterns
- Basic validation that calls are properly formatted
- Return parsed structure or fall back to sequential processing

**Test Criteria**:
- Can parse `call1: prompt1, call2: prompt2` syntax
- Correctly identifies concurrent vs sequential inputs
- Gracefully handles malformed syntax

**Code Changes**: 
- Add `parseConcurrentSyntax()` function to Core
- Minimal integration into existing `processUserInput()` flow

---

### Increment 2: Parallel API Execution (Core Concurrency)
**Goal**: Execute multiple API calls in parallel using existing Gemini API client

**Implementation**:
- Build multiple prompts from parsed concurrent calls
- Use `Promise.all()` to execute parallel API requests
- Handle basic errors (timeout, API failures)

**Test Criteria**:
- Successfully makes 2-3 parallel API calls
- Faster execution than sequential equivalent
- Proper error handling when some calls fail

**Code Changes**:
- Add `executeConcurrentCalls()` function
- Reuse existing API client for parallel requests
- Basic error handling and timeout management

---

### Increment 3: Basic Result Aggregation (Result Synthesis)
**Goal**: Combine parallel API responses into a coherent single response

**Implementation**:
- Simple concatenation strategy with clear separation
- Preserve individual call results with labels
- Basic formatting for readability

**Test Criteria**:
- Combined results are readable and well-organized
- Each concurrent call result is clearly attributed
- No data loss during aggregation

**Code Changes**:
- Add `combineResults()` function
- Basic markdown formatting for result presentation
- Clear labeling of which result came from which call

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
- Add `executeConcurrentCalls()` for LLM-structured concurrent calls
- Integration with existing Gemini API for prompt analysis
- Robust error handling and fallback mechanisms for LLM analysis failures

**Processing Flow**:
```typescript
async processUserInput(input: string, flags: any) {
  // Step 1: Check for forced behavior
  const forcedBehavior = this.checkForcedBehavior(input, flags);
  
  if (forcedBehavior === "sequential") {
    // Force sequential processing - skip LLM analysis
    return this.executeSequentialRequest(input, context);
  }
  
  if (forcedBehavior === "concurrent") {
    // Force concurrent processing - use manual parsing or simple splitting
    const manualAnalysis = this.parseConcurrentSyntax(input) || this.createSimpleConcurrentSplit(input);
    return this.executeConcurrentCalls(manualAnalysis.calls, context);
  }
  
  // Step 2: No forced behavior - use LLM analysis
  try {
    const analysisResponse = await this.analyzePromptForConcurrency(input);
    const structuredResponse = this.parseStructuredResponse(analysisResponse);
    
    if (structuredResponse.processing_type === "sequential") {
      return structuredResponse.sequential_response;
    } else {
      return this.executeConcurrentCalls(structuredResponse.concurrent_calls, context);
    }
  } catch (error) {
    // Step 3: Fallback to manual syntax parsing
    const manualAnalysis = this.parseConcurrentSyntax(input);
    if (manualAnalysis.hasConcurrentCalls) {
      return this.executeConcurrentCalls(manualAnalysis.calls, context);
    } else {
      // Standard sequential processing
      return this.executeSequentialRequest(input, context);
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
- Pass current context to each parallel API call
- Ensure file contexts and memory work in concurrent scenarios
- Maintain existing behavior for context handling

**Test Criteria**:
- Concurrent calls with `@file.js` context work correctly
- GEMINI.md memory is properly included in parallel calls
- No regression in existing context features

**Code Changes**:
- Integrate context building into concurrent call preparation
- Ensure context consistency across parallel calls

---

### Increment 6: Tool Integration (Concurrent Tool Usage)
**Goal**: Enable each concurrent call to use existing Gemini CLI tools

**Implementation**:
- Allow concurrent API calls to trigger tool executions
- Handle tool confirmations and security checks for concurrent scenarios
- Ensure tool results are properly integrated into concurrent result aggregation

**Test Criteria**:
- Concurrent calls can successfully use tools like `read_file`, `web_fetch`, etc.
- Tool confirmation workflows work correctly in concurrent scenarios
- Tool results are properly included in final aggregated response
- No conflicts between concurrent tool executions

**Code Changes**:
- Integrate existing tool execution flow into concurrent API calls
- Handle tool confirmation and security validation for parallel scenarios
- Aggregate tool results along with API responses

---

### Increment 7: Advanced Aggregation (Intelligent Synthesis)
**Goal**: Implement smarter result combination strategies beyond simple concatenation

**Implementation**:
- Conflict detection between parallel results
- Smart merging based on result types
- Quality scoring and confidence weighting

**Test Criteria**:
- Better result quality than simple concatenation
- Proper handling of contradictory parallel results
- Improved readability and coherence

**Code Changes**:
- Enhanced `combineResults()` with multiple strategies
- Result analysis and conflict resolution
- Configurable aggregation approaches

---

### Increment 8: Performance Optimization (Production Ready)
**Goal**: Optimize for performance, cost, and reliability in production usage

**Implementation**:
- Rate limiting and quota management
- Connection pooling and request optimization
- Advanced error recovery and retry logic

**Test Criteria**:
- Efficient API usage with minimal waste
- Robust error handling under various failure conditions
- Acceptable performance under load

**Code Changes**:
- Performance optimizations in API client usage
- Advanced error handling and recovery mechanisms
- Telemetry integration for monitoring

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
feat: implement concurrency increment 2 - parallel API execution

- Added executeConcurrentCalls() function
- Parallel Promise.all() execution with existing API client
- Basic error handling for failed concurrent calls
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
  - *Mitigation*: Built-in rate limiting and request queuing
- **Increased Costs**: More API calls mean higher usage costs
  - *Mitigation*: User awareness and optional cost controls
- **Complexity**: Risk of introducing bugs in Core package
  - *Mitigation*: Incremental approach with thorough testing at each step

### Implementation Risks
- **Integration Complexity**: Changes to Core might break existing functionality
  - *Mitigation*: Additive changes only, extensive regression testing
- **Performance Degradation**: Overhead from concurrency analysis
  - *Mitigation*: Minimal parsing overhead, fast fallback to sequential processing

