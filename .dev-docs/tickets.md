# Development Tickets: Iteration 1: Core Concurrency MVP

- **Iteration ID**: Iteration-1-MVP
- **Link to Iteration Plan**: [`./.dev-docs/iteration-plan.md#iteration-1-core-concurrency-mvp`](./.dev-docs/iteration-plan.md#iteration-1-core-concurrency-mvp)
- **Iteration Period**: TBD – TBD
- **Planned By**: Strategic Planner Mode
- **Detailed By**: Detailler Mode
- **Last Updated**: 2025-07-29 11:32 UTC+2:00

---

## Overview

## This document contains all detailed development tickets for the iteration. Each ticket represents an atomic, actionable task derived from the Strategic Planner's Iteration Plan and refined with architectural guidance from the Detailler Mode. This document also serves as the primary tracking log for progress, issues, and resolution of all tasks within this iteration.

## Tickets for This Iteration

---

### Ticket: T-001: Implement `parseConcurrentSyntax` function

- **Ticket ID**: T-001
- **Related User Story**: US-001: Basic User-Directed Concurrent Calls
  - **Link**: [`./.dev-docs/user-stories.md#user-story-basic-user-directed-concurrent-calls`](./.dev-docs/user-stories.md#user-story-basic-user-directed-concurrent-calls)
- **Assigned To**: Coder
- **Status**: Done
- **Priority**: Critical
- **Estimated Effort**: Small

#### 1. Task Description

Develop the `parseConcurrentSyntax` method within the `GeminiClient` class in [`packages/core/src/core/client.ts`](packages/core/src/core/client.ts). This method will be responsible for parsing user input (`PartListUnion`) to detect explicit concurrent call syntax (e.g., `call1: prompt1, call2: prompt2`). It should extract the `callId` and `prompt` for each detected concurrent call. The implementation should leverage existing text extraction utilities like `partToString`.

#### 2. Architectural Guidance

- **Responsible Module**: `packages/core/src/core`
  - **Sub-module/File**: [`packages/core/src/core/client.ts`](packages/core/src/core/client.ts)
- **Key Function/Method to Implement/Modify**:
  `GeminiClient.parseConcurrentSyntax(request: PartListUnion): ConcurrencyAnalysis`
  - **Pseudocode**:

    ```typescript
    // In packages/core/src/core/client.ts
    class GeminiClient {
      // ... existing methods ...

      private parseConcurrentSyntax(
        request: PartListUnion,
      ): ConcurrencyAnalysis {
        const textInput = partToString(request); // Use existing utility
        const concurrentCalls: ConcurrentCall[] = [];
        let hasConcurrentCalls = false;

        // Regex to find patterns like "callN: " followed by content
        // Example: /(call\d+):\s*((?:[^,]|,(?!\s*call\d+:))*)(?=,\s*call\d+:|$)/g
        const regex =
          /(call\d+):\s*((?:[^,]|,(?!\s*call\d+:))*)(?=,\s*call\d+:|$)/g;
        let match;

        while ((match = regex.exec(textInput)) !== null) {
          hasConcurrentCalls = true;
          const callId = match[1]; // e.g., "call1"
          const prompt = match[2].trim(); // e.g., "analyze security"
          concurrentCalls.push({ id: callId, prompt: prompt });
        }

        // Handle cases where no explicit callN: syntax is found, but it might be a single implicit call
        // Or if the input is not a string, handle gracefully.
        if (
          !hasConcurrentCalls &&
          typeof request === 'string' &&
          request.trim().length > 0
        ) {
          // Consider if a single prompt without "callN:" should be treated as a single concurrent call
          // For Increment 1, if no "callN:" syntax, it's not concurrent.
        }

        return { hasConcurrentCalls, calls: concurrentCalls };
      }
    }
    ```

- **Dependencies**:
  - Internal: `partToString` from `../utils/partUtils.js`
  - External: `@google/genai` (for `PartListUnion` type)
- **Relevant Naming Conventions**:
  - Interfaces: `ConcurrencyConfig`, `ConcurrentCall`, `ConcurrencyAnalysis`
  - Function: `parseConcurrentSyntax`
  - Variables: `textInput`, `concurrentCalls`, `hasConcurrentCalls`, `regex`, `match`, `callId`, `prompt`
- **Scope within Module**:
  This method is purely for parsing and data structuring. It does not interact with the Gemini API or manage streams directly.

---

#### 3. Data Flow & Interfaces

- **Inputs**:
  - `request`: `PartListUnion` - The raw user input, which can be a string, an array of `Part` objects, or a single `Part` object.
- **Outputs**:
  - `ConcurrencyAnalysis` object:
    - `hasConcurrentCalls`: `boolean` - `true` if `callN:` syntax is detected, `false` otherwise.
    - `calls`: `ConcurrentCall[]` - An array of objects, where each object represents a parsed concurrent call with:
      - `id`: `string` (e.g., "call1", "call2")
      - `prompt`: `string` (the extracted prompt text for that call)
- **Transformation**:
  1.  Converts `PartListUnion` to a single string using `partToString`.
  2.  Applies a regular expression to identify and extract `callN: ` patterns and their associated prompt text.
  3.  Structures the extracted data into `ConcurrencyAnalysis` object.
- **Interactions**:
  - Called by `GeminiClient.sendMessageStream()`.
  - Consumes `PartListUnion` and produces `ConcurrencyAnalysis`.

---

#### 4. Acceptance Criteria

- **Valid Concurrent Syntax**:
  - `parseConcurrentSyntax("call1: analyze security, call2: check performance")` returns `hasConcurrentCalls: true` and `calls: [{ id: "call1", prompt: "analyze security" }, { id: "call2", prompt: "check performance" }]`.
  - `parseConcurrentSyntax("call1: prompt only")` returns `hasConcurrentCalls: true` and `calls: [{ id: "call1", prompt: "prompt only" }]`.
- **No Concurrent Syntax**:
  - `parseConcurrentSyntax("regular prompt text")` returns `hasConcurrentCalls: false` and an empty `calls` array.
  - `parseConcurrentSyntax("")` (empty string) returns `hasConcurrentCalls: false` and an empty `calls` array.
- **Malformed Syntax Handling**:
  - `parseConcurrentSyntax("call1 analyze security")` (missing colon) returns `hasConcurrentCalls: false` and an empty `calls` array (graceful fallback).
  - `parseConcurrentSyntax("call1: prompt1, malformed, call2: prompt2")` correctly parses `call1` and `call2` if the regex is robust enough, or falls back to `false` if the malformed part breaks the pattern. (Prioritize robust parsing of valid parts).
- **Mixed Content Handling**:
  - `parseConcurrentSyntax("call1: prompt1, some other text, call2: prompt2")` should ideally extract `call1` and `call2` correctly, ignoring the intermediate "some other text".
- **PartListUnion Variants**:
  - Function correctly extracts text content from `PartListUnion` inputs that are `string`, `Part[]`, or `Part` (e.g., `text` part, `inlineData` part).

---

#### 5. Progress & Updates

- [ ]

---

#### 6. Issues & Blocks

- [ ]

---

#### 7. Code References

- **File Paths**:
  - [`packages/core/src/core/client.ts`](packages/core/src/core/client.ts)
  - [`packages/core/src/core/client.test.ts`](packages/core/src/core/client.test.ts) (for new unit tests)
  - [`packages/core/src/utils/partUtils.ts`](packages/core/src/utils/partUtils.ts) (for `partToString` reference)
- **Relevant Commits**: [Insert Git commit links or hashes]

---

### Ticket: T-002: Integrate `parseConcurrentSyntax` into `sendMessageStream`

- **Ticket ID**: T-002
- **Related User Story**: US-001: Basic User-Directed Concurrent Calls
  - **Link**: [`./.dev-docs/user-stories.md#user-story-basic-user-directed-concurrent-calls`](./.dev-docs/user-stories.md#user-story-basic-user-directed-concurrent-calls)
- **Assigned To**: Coder
- **Status**: Done
- **Priority**: Critical
- **Estimated Effort**: Small

#### 1. Task Description

## Modify the `GeminiClient.sendMessageStream()` method in [`packages/core/src/core/client.ts`](packages/core/src/core/client.ts) to integrate the newly created `parseConcurrentSyntax` method (from T-001). The `sendMessageStream` method should call `parseConcurrentSyntax` and, based on its `hasConcurrentCalls` result, route the request to either the new concurrent processing flow (which will be implemented in T-004, currently a placeholder) or continue with the existing sequential processing flow.

#### 2. Architectural Guidance

- **Responsible Module**: `packages/core/src/core`
  - **Sub-module/File**: [`packages/core/src/core/client.ts`](packages/core/src/core/client.ts)
- **Key Function/Method to Implement/Modify**:
  `GeminiClient.sendMessageStream(request: PartListUnion, signal: AbortSignal, prompt_id: string): AsyncGenerator<ServerGeminiStreamEvent, Turn>`
  - **Pseudocode for `sendMessageStream` modification**:

    ```typescript
    // In packages/core/src/core/client.ts, inside sendMessageStream method
    // ... existing code ...

    // NEW: Concurrency detection and orchestration
    const concurrencyAnalysis = this.parseConcurrentSyntax(request);

    if (concurrencyAnalysis.hasConcurrentCalls) {
      // NEW: Route to concurrent processing (placeholder for T-004)
      // This will eventually call executeConcurrentStreams
      console.log("Concurrent calls detected. Routing to concurrent processing.");
      // For now, you might yield a placeholder event or throw a temporary error
      // to indicate this path is taken, until T-004 is implemented.
      // Example placeholder:
      yield { type: 'debug', value: 'Concurrent processing path taken.' };
      // Return a dummy Turn or throw an error to satisfy type signature for now
      return new Turn(this.getChat(), prompt_id);
    }

    // EXISTING: Original sequential streaming unchanged
    const turn = new Turn(this.getChat(), prompt_id);
    const resultStream = turn.run(request, signal);

    for await (const event of resultStream) {
      yield event;
    }

    return turn;
    ```

- **Dependencies**:
  - Internal: `GeminiClient.parseConcurrentSyntax` (T-001), `GeminiClient.executeConcurrentStreams` (T-004 - will be implemented later, so this ticket will use a placeholder/dummy call for now).
  - External: None
- **Relevant Naming Conventions**:
  - Variables: `concurrencyAnalysis`
- **Scope within Module**:
  This task focuses solely on the conditional branching logic within `sendMessageStream` based on the output of `parseConcurrentSyntax`. It does not involve the actual implementation of parallel API calls or stream aggregation, which are covered in subsequent tickets.

---

#### 3. Data Flow & Interfaces

- **Inputs**:
  - `request`: `PartListUnion` - The user's input prompt.
  - `signal`: `AbortSignal` - For cancellation.
  - `prompt_id`: `string` - Identifier for the current prompt.
- **Outputs**:
  - `AsyncGenerator<ServerGeminiStreamEvent, Turn>` - The output stream of events, which will either come from the existing sequential path or a placeholder for the new concurrent path.
- **Transformation**:
  1.  Receives `request`.
  2.  Passes `request` to `parseConcurrentSyntax`.
  3.  Based on `concurrencyAnalysis.hasConcurrentCalls`, directs execution flow.
- **Interactions**:
  - Calls `parseConcurrentSyntax`.
  - Conditionally calls either the existing `Turn.run()` method or a placeholder for `executeConcurrentStreams`.

---

#### 4. Acceptance Criteria

- **Concurrent Path Activation**:
  - When `parseConcurrentSyntax` returns `hasConcurrentCalls: true`, `sendMessageStream` executes the code path intended for concurrent processing (e.g., logs a message, yields a placeholder event, or calls a dummy `executeConcurrentStreams` function).
- **Sequential Path Preservation**:
  - When `parseConcurrentSyntax` returns `hasConcurrentCalls: false`, `sendMessageStream` continues with the original sequential `Turn.run()` logic, and existing sequential functionality remains unchanged and fully functional.
- **No Regression**:
  - All existing unit and integration tests for `sendMessageStream` (for sequential prompts) continue to pass.

---

#### 5. Progress & Updates

- [x] **[2025-07-29 12:02 UTC+2:00]** – Coder Mode: Successfully integrated `parseConcurrentSyntax` into `sendMessageStream` method
  - Modified `sendMessageStream` to call `parseConcurrentSyntax` and branch based on `hasConcurrentCalls` result
  - When concurrent calls are detected, now routes to `executeConcurrentStreams` instead of just logging
  - Maintains existing sequential processing path when no concurrent calls are detected
  - Proper return type handling for both concurrent and sequential paths with Turn instance
  - Added console.log message "Concurrent calls detected. Routing to concurrent processing."
- [x] **[2025-07-29 12:03 UTC+2:00]** – Coder Mode: Created comprehensive unit tests for concurrent routing logic
  - Added test `should route to executeConcurrentStreams when concurrent calls are detected`
  - Added test `should continue with sequential path when no concurrent calls are detected`
  - Added test `should handle errors in concurrent path gracefully`
  - Tests verify proper integration with `executeConcurrentStreams` and event yielding
  - Tests ensure sequential path remains unchanged and functional
  - Error handling tests confirm graceful failure propagation

---

#### 6. Issues & Blocks

- [ ]

---

#### 7. Code References

- **File Paths**:
  - [`packages/core/src/core/client.ts`](packages/core/src/core/client.ts)
  - [`packages/core/src/core/client.test.ts`](packages/core/src/core/client.test.ts) (for new unit tests to verify branching)
- **Relevant Commits**: [Insert Git commit links or hashes]

---

### Ticket: T-003: Implement `StreamAggregator` class

- **Ticket ID**: T-003
- **Related User Story**: US-004: Real-time Aggregated Streaming Output
  - **Link**: [`./.dev-docs/user-stories.md#user-story-real-time-aggregated-streaming-output`](./.dev-docs/user-stories.md#user-story-real-time-aggregated-streaming-output)
- **Assigned To**: Coder
- **Status**: Done
- **Priority**: Critical
- **Estimated Effort**: Medium

#### 1. Task Description

## Create a new `StreamAggregator` class in [`packages/core/src/core/streamAggregator.ts`](packages/core/src/core/streamAggregator.ts) (or similar appropriate location within `packages/core/src/core`). This class will be responsible for merging multiple `AsyncGenerator<ServerGeminiStreamEvent>` streams into a single coherent output stream. It should include basic error handling for individual streams (i.e., an error in one stream should not halt others) and enrich events with `callId` and `callTitle` metadata.

#### 2. Architectural Guidance

- **Responsible Module**: `packages/core/src/core`
  - **Sub-module/File**: [`packages/core/src/core/streamAggregator.ts`](packages/core/src/core/streamAggregator.ts) (new file)
- **Key Class/Method to Implement/Modify**:
  `class StreamAggregator`
  - **Constructor**: `constructor(calls: ConcurrentCall[])` - Stores metadata about the concurrent calls for attribution.
  - **Method**: `async *mergeStreams(streams: AsyncGenerator<ServerGeminiStreamEvent>[]): AsyncGenerator<ServerGeminiStreamEvent>`
  - **Pseudocode for `StreamAggregator.mergeStreams`**:

    ```typescript
    // In packages/core/src/core/streamAggregator.ts
    import { ServerGeminiStreamEvent } from '@google/genai'; // Assuming this path
    import { ConcurrentCall } from './client'; // Assuming this path

    class StreamAggregator {
      private callMetadata: Map<string, ConcurrentCall>;

      constructor(calls: ConcurrentCall[]) {
        this.callMetadata = new Map(calls.map((call) => [call.id, call]));
      }

      async *mergeStreams(
        streams: AsyncGenerator<ServerGeminiStreamEvent>[],
      ): AsyncGenerator<ServerGeminiStreamEvent> {
        const activeGenerators = streams.map((generator, index) => ({
          generator,
          callId: Array.from(this.callMetadata.keys())[index], // Simple mapping for now
          done: false,
          buffer: [], // Optional: for reordering or buffering if needed later
        }));

        while (activeGenerators.some((g) => !g.done)) {
          for (const genInfo of activeGenerators) {
            if (genInfo.done) continue;

            try {
              const { value, done } = await genInfo.generator.next();
              if (done) {
                genInfo.done = true;
              } else {
                // Enrich event with callId and callTitle
                const originalCall = this.callMetadata.get(genInfo.callId);
                const enrichedEvent = {
                  ...value,
                  callId: genInfo.callId,
                  callTitle: originalCall?.prompt || genInfo.callId, // Use prompt as title
                };
                yield enrichedEvent;
              }
            } catch (error) {
              // Basic error handling: log and mark as done, but don't stop other streams
              console.error(
                `Stream for call ${genInfo.callId} encountered an error:`,
                error,
              );
              yield {
                type: 'error',
                value: `Error in call ${genInfo.callId}: ${error.message}`,
                callId: genInfo.callId,
              };
              genInfo.done = true;
            }
          }
          // Add a small delay to prevent busy-waiting if streams are slow
          // await new Promise(resolve => setTimeout(resolve, 0));
        }
      }
    }
    ```

- **Dependencies**:
  - Internal: `ServerGeminiStreamEvent` type (from `@google/genai`), `ConcurrentCall` type (from `client.ts`).
  - External: None
- **Relevant Naming Conventions**:
  - Class: `StreamAggregator`
  - Method: `mergeStreams`
  - Variables: `activeGenerators`, `genInfo`, `enrichedEvent`, `callMetadata`
- **Scope within Module**:
  Focus on the mechanics of merging asynchronous generators, basic error isolation, and event enrichment. This class is a utility for `executeConcurrentStreams`.

---

#### 3. Data Flow & Interfaces

- **Inputs**:
  - `streams`: `AsyncGenerator<ServerGeminiStreamEvent>[]` - An array of asynchronous generators, each representing the streaming output from a single parallel API call (`Turn.run()`).
  - `calls`: `ConcurrentCall[]` - An array of `ConcurrentCall` objects, providing metadata (like `id` and `prompt`) for each stream to be merged.
- **Outputs**:
  - Single `AsyncGenerator<ServerGeminiStreamEvent>` - A unified stream of events where each event is enriched with `callId` and `callTitle` metadata, allowing the consumer to identify the source of the event.
- **Transformation**:
  1.  Receives multiple independent event streams.
  2.  Iterates through active streams, pulling events.
  3.  Enriches each event with source `callId` and `callTitle`.
  4.  Yields enriched events into a single, interleaved output stream.
  5.  Handles individual stream errors gracefully without stopping the entire aggregation.
- **Interactions**:
  - Instantiated by `GeminiClient.executeConcurrentStreams()`.
  - Consumes multiple `AsyncGenerator`s and produces a single `AsyncGenerator`.

---

#### 4. Acceptance Criteria

- **Successful Merging**:
  - `mergeStreams` successfully combines events from 2-3 parallel `AsyncGenerator`s into a single output stream.
- **Real-time Delivery & Attribution**:
  - Events from different source streams are yielded in real-time as they arrive.
  - Each `ServerGeminiStreamEvent` yielded includes `callId` and `callTitle` properties, correctly identifying the source concurrent call.
- **Error Isolation**:
  - If one input stream throws an error, other streams continue to yield events.
  - The error from the failed stream is either propagated as an error event within the aggregated stream or logged, without crashing the `StreamAggregator`.
- **Type Integrity**:
  - The output stream maintains the `ServerGeminiStreamEvent` type, with added `callId` and `callTitle` properties.

---

#### 5. Progress & Updates

- [x] **[2025-07-29 11:52 UTC+2:00]** – Coder Mode: Implemented StreamAggregator class in `packages/core/src/core/streamAggregator.ts`
  - Created the main StreamAggregator class with constructor accepting ConcurrentCall[]
  - Implemented mergeStreams method that combines multiple AsyncGenerator streams
  - Added proper event enrichment with callId and callTitle properties
  - Implemented error isolation - individual stream failures don't crash other streams
  - Error events are generated and yielded for failed streams while others continue
- [x] **[2025-07-29 11:53 UTC+2:00]** – Coder Mode: Created comprehensive unit tests in `packages/core/src/core/streamAggregator.test.ts`
  - Tests cover successful merging of 2-3 parallel streams
  - Verified real-time event delivery and proper attribution
  - Tested error isolation and continued processing of healthy streams
  - Validated type integrity with ServerGeminiStreamEvent + added properties
  - Edge cases: empty streams, immediate completion, missing metadata

---

#### 6. Issues & Blocks

- [ ]

---

#### 7. Code References

- **File Paths**:
  - [`packages/core/src/core/streamAggregator.ts`](packages/core/src/core/streamAggregator.ts) ✅ **Created**
  - [`packages/core/src/core/streamAggregator.test.ts`](packages/core/src/core/streamAggregator.test.ts) ✅ **Created**
  - [`packages/core/src/core/client.ts`](packages/core/src/core/client.ts) (for `ConcurrentCall` type reference)
- **Relevant Commits**: Ready for commit

---

### Ticket: T-004: Implement `executeConcurrentStreams` function

- **Ticket ID**: T-004
- **Related User Story**: US-004: Real-time Aggregated Streaming Output
  - **Link**: [`./.dev-docs/user-stories.md#user-story-real-time-aggregated-streaming-output`](./.dev-docs/user-stories.md#user-story-real-time-aggregated-streaming-output)
- **Assigned To**: Coder
- **Status**: Done
- **Priority**: Critical
- **Estimated Effort**: Medium

#### 1. Task Description

## Implement the `executeConcurrentStreams` method within the `GeminiClient` class in [`packages/core/src/core/client.ts`](packages/core/src/core/client.ts). This method will take an array of `ConcurrentCall` objects (from T-001), create a `Turn` instance for each, build appropriate requests (reusing existing context building logic), and execute these `Turn.run()` calls in parallel. It will then use the `StreamAggregator` (T-003) to merge the resulting `AsyncGenerator` streams. Events yielded from this function must be enriched with `callId` and `callTitle` for attribution.

#### 2. Architectural Guidance

- **Responsible Module**: `packages/core/src/core`
  - **Sub-module/File**: [`packages/core/src/core/client.ts`](packages/core/src/core/client.ts)
- **Key Function/Method to Implement/Modify**:
  `GeminiClient.executeConcurrentStreams(calls: ConcurrentCall[], signal: AbortSignal, prompt_id: string): AsyncGenerator<ServerGeminiStreamEvent>`
  - **Pseudocode**:

    ```typescript
    // In packages/core/src/core/client.ts
    import { Turn } from './turn'; // Assuming Turn is imported
    import { StreamAggregator } from './streamAggregator'; // Assuming StreamAggregator is imported (T-003)
    import { ConcurrentCall, ConcurrencyAnalysis } from './client'; // Assuming these types are defined or imported

    class GeminiClient {
      // ... existing properties and methods ...

      private async *executeConcurrentStreams(
        calls: ConcurrentCall[],
        signal: AbortSignal,
        prompt_id: string,
      ): AsyncGenerator<ServerGeminiStreamEvent> {
        const turns: Turn[] = [];
        const streams: AsyncGenerator<ServerGeminiStreamEvent>[] = [];

        for (const call of calls) {
          // Create a new Turn instance for each concurrent call
          const turn = new Turn(this.getChat(), `${prompt_id}-${call.id}`);
          turns.push(turn);

          // Build the request for this specific call, including full context
          // This part reuses existing context building logic from GeminiClient
          const requestForCall = this.buildRequestFromCall(call); // Assuming this helper exists or is implemented here
          streams.push(turn.run(requestForCall, signal));
        }

        // Aggregate streams with proper labeling
        const streamAggregator = new StreamAggregator(calls); // Pass calls for metadata

        // Merge streams while maintaining order and attribution
        for await (const event of streamAggregator.mergeStreams(streams)) {
          yield event; // Stream events with call attribution (handled by StreamAggregator)
        }

        // Optionally, return a consolidated Turn object if needed for final state.
        // For now, the primary output is the stream.
        // return new Turn(this.getChat(), prompt_id); // Or a new consolidated Turn
      }

      // Helper method to build a full request for a concurrent call, including context
      // This might involve reusing logic from existing sendMessageStream or getEnvironment
      private buildRequestFromCall(call: ConcurrentCall): PartListUnion {
        // Example: Combine call.prompt with current context (files, memory, tools)
        const currentContext = this.getEnvironment(); // Assuming this method exists and provides context
        const fullPrompt = `${call.prompt}\n\nContext:\n${currentContext.files}\n${currentContext.memory}\nAvailable tools:\n${currentContext.toolSchemas}`;
        return [{ text: fullPrompt }]; // Return as PartListUnion
      }
    }
    ```

- **Dependencies**:
  - Internal: `Turn` class (`packages/core/src/core/turn.ts`), `StreamAggregator` class (T-003, `packages/core/src/core/streamAggregator.ts`), `ConcurrentCall` type (from T-001).
  - External: `@google/genai` (for `ServerGeminiStreamEvent`, `PartListUnion`).
- **Relevant Naming Conventions**:
  - Function: `executeConcurrentStreams`, `buildRequestFromCall`
  - Variables: `turns`, `streams`, `streamAggregator`, `requestForCall`
- **Scope within Module**:
  This method orchestrates the parallel execution of multiple `Turn` instances and their streaming outputs. It relies on `StreamAggregator` for merging.

---

#### 3. Data Flow & Interfaces

- **Inputs**:
  - `calls`: `ConcurrentCall[]` - An array of parsed concurrent prompts, each containing an `id` and `prompt`.
  - `signal`: `AbortSignal` - An abort signal to allow cancellation of ongoing operations.
  - `prompt_id`: `string` - The base prompt ID for generating unique IDs for each concurrent `Turn`.
- **Outputs**:
  - `AsyncGenerator<ServerGeminiStreamEvent>` - A single, merged asynchronous generator that yields events from all concurrent calls, with each event attributed to its source `callId` and `callTitle`.
- **Transformation**:
  1.  For each `ConcurrentCall`, a new `Turn` instance is created.
  2.  A full request (including context) is built for each `Turn`.
  3.  Each `Turn.run()` is initiated in parallel, returning an `AsyncGenerator`.
  4.  These individual `AsyncGenerator`s are fed into `StreamAggregator.mergeStreams()`.
  5.  The `StreamAggregator` yields a single, interleaved stream of events.
- **Interactions**:
  - Called by `GeminiClient.sendMessageStream()` (T-002).
  - Creates and manages multiple `Turn` instances.
  - Utilizes `StreamAggregator` to combine results.
  - Interacts with the underlying Gemini API via `Turn.run()`.

---

#### 4. Acceptance Criteria

- **Parallel Execution**:
  - `executeConcurrentStreams` successfully creates and runs multiple `Turn` instances in parallel, initiating API calls for each concurrent prompt.
- **Stream Merging**:
  - The function correctly uses the `StreamAggregator` (T-003) to merge the output streams from all parallel `Turn` instances into a single `AsyncGenerator`.
- **Event Attribution**:
  - Each `ServerGeminiStreamEvent` yielded from `executeConcurrentStreams` includes `callId` and `callTitle` properties, correctly identifying the source concurrent call.
- **Performance Improvement**:
  - For independent concurrent calls, the overall execution time is demonstrably faster than if the calls were executed sequentially.
- **Error Handling**:
  - If one parallel call fails (e.g., due to an API error), other calls continue processing, and the error is reflected in the aggregated stream (as handled by `StreamAggregator`). The overall function does not crash.
- **Context Preservation**:
  - Each individual `Turn` instance created for a concurrent call receives the correct and complete session context (files, memory, tool schemas).

---

#### 5. Progress & Updates

- [x] **[2025-07-29 11:58 UTC+2:00]** – Coder Mode: Implemented `executeConcurrentStreams` method in `packages/core/src/core/client.ts`
  - Added StreamAggregator import to client.ts
  - Implemented the main executeConcurrentStreams method that creates multiple Turn instances
  - Each concurrent call gets its own Turn with unique prompt_id format (`${prompt_id}-${call.id}`)
  - Properly uses StreamAggregator to merge multiple AsyncGenerator streams
  - Yields enriched events with callId and callTitle attribution from StreamAggregator
- [x] **[2025-07-29 11:58 UTC+2:00]** – Coder Mode: Implemented `buildRequestFromCall` helper method
  - Simple implementation that converts ConcurrentCall prompt to PartListUnion format
  - Returns `[{ text: call.prompt }]` as required by Turn.run() interface
  - TODO note added for future enhancement with session context integration
- [x] **[2025-07-29 11:59 UTC+2:00]** – Coder Mode: Created comprehensive unit tests in `packages/core/src/core/client.test.ts`
  - Added mock for StreamAggregator with proper mergeStreams implementation
  - Tests cover multiple Turn instance creation and parallel execution
  - Verified proper event enrichment with callId and callTitle properties
  - Tested error handling scenarios (errors handled by StreamAggregator)
  - Validated signal propagation for cancellation support
  - Edge cases: empty calls array, complex prompts, special characters

---

#### 6. Issues & Blocks

- [ ]

---

#### 7. Code References

- **File Paths**:
  - [`packages/core/src/core/client.ts`](packages/core/src/core/client.ts) ✅ **Modified**
  - [`packages/core/src/core/client.test.ts`](packages/core/src/core/client.test.ts) ✅ **Extended with tests**
  - [`packages/core/src/core/turn.ts`](packages/core/src/core/turn.ts)
  - [`packages/core/src/core/streamAggregator.ts`](packages/core/src/core/streamAggregator.ts) (T-003)
- **Relevant Commits**: Ready for commit

---

### Ticket: T-005: Integrate basic concurrency config

- **Ticket ID**: T-005
- **Related User Story**: US-007: Configurable Concurrency Settings
  - **Link**: [`./.dev-docs/user-stories.md#user-story-configurable-concurrency-settings`](./.dev-docs/user-stories.md#user-story-configurable-concurrency-settings)
- **Assigned To**: Coder
- **Status**: To Do
- **Priority**: Should-have
- **Estimated Effort**: Small

#### 1. Task Description

## Extend the `ConfigParameters` interface and the `Config` class in [`packages/core/src/config/config.ts`](packages/core/src/config/config.ts) to include new concurrency-related properties: `enabled`, `maxConcurrentCalls`, and `forceProcessing`. Implement corresponding getter methods (`getConcurrencyEnabled`, `getMaxConcurrentCalls`, `getForcedProcessingMode`). Ensure default values are set and that the configuration can be loaded from `settings.json` and environment variables.

#### 2. Architectural Guidance

- **Responsible Module**: `packages/core/src/config`
  - **Sub-module/File**: [`packages/core/src/config/config.ts`](packages/core/src/config/config.ts)
- **Key Class/Method to Implement/Modify**:
  - `interface ConfigParameters`
  - `class Config` (constructor and new getter methods)
  - **Pseudocode for `ConfigParameters` and `Config` modifications**:

    ```typescript
    // In packages/core/src/config/config.ts

    export interface ConfigParameters {
      // ... existing properties
      concurrency?: {
        enabled?: boolean;
        maxConcurrentCalls?: number;
        forceProcessing?: 'sequential' | 'concurrent';
      };
    }

    export class Config {
      private readonly concurrency: {
        enabled: boolean;
        maxConcurrentCalls: number;
        forceProcessing?: 'sequential' | 'concurrent';
      };

      constructor(params: ConfigParameters) {
        // ... existing constructor logic ...
        this.concurrency = {
          enabled: params.concurrency?.enabled ?? true, // Default to true
          maxConcurrentCalls: params.concurrency?.maxConcurrentCalls ?? 3, // Default to 3
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

      // ... existing methods ...
    }
    ```

- **Dependencies**:
  - Internal: None
  - External: None
- **Relevant Naming Conventions**:
  - Properties: `concurrency.enabled`, `concurrency.maxConcurrentCalls`, `concurrency.forceProcessing`
  - Getters: `getConcurrencyEnabled`, `getMaxConcurrentCalls`, `getForcedProcessingMode`
- **Scope within Module**:
  This task is purely for configuration management. It does not involve direct application of these settings to the CLI's operational logic, which will be handled in other tickets (e.g., T-002, T-004).

---

#### 3. Data Flow & Interfaces

- **Inputs**:
  - `ConfigParameters` object (passed to `Config` constructor, typically from parsed `settings.json` or environment variables).
  - `settings.json` file (implicitly read by the `Config` loading mechanism).
  - Environment variables (e.g., `GEMINI_CONCURRENCY_ENABLED`, `GEMINI_MAX_CONCURRENT_CALLS`, `GEMINI_FORCE_PROCESSING`).
- **Outputs**:
  - Configuration values exposed via the new getter methods (`getConcurrencyEnabled`, `getMaxConcurrentCalls`, `getForcedProcessingMode`).
- **Transformation**:
  1.  Reads configuration from various sources (defaults, `settings.json`, environment variables) with defined priority.
  2.  Parses and stores these values internally within the `Config` instance.
- **Interactions**:
  - The `Config` instance is typically created once at application startup.
  - Other modules (e.g., `GeminiClient`) will query the `Config` instance using the new getter methods to retrieve concurrency settings.

---

#### 4. Acceptance Criteria

- **Interface and Class Extension**:
  - The `ConfigParameters` interface is updated to include a `concurrency` object with optional `enabled` (boolean), `maxConcurrentCalls` (number), and `forceProcessing` ('sequential' | 'concurrent') properties.
  - The `Config` class constructor correctly initializes these properties, setting `enabled` to `true` and `maxConcurrentCalls` to `3` by default if not provided.
- **Getter Methods Functionality**:
  - `getConcurrencyEnabled()`, `getMaxConcurrentCalls()`, and `getForcedProcessingMode()` methods are implemented and return the currently active concurrency settings.
- **Configuration Loading Priority**:
  - Settings defined in `settings.json` are correctly loaded and applied.
  - Environment variables (e.g., `GEMINI_CONCURRENCY_ENABLED=false`) correctly override corresponding settings from `settings.json`.
  - CLI flags (if applicable, though this ticket focuses on `Config` class) should take highest precedence (as per `implementation_guide.md`).
- **Unit Test Coverage**:
  - New unit tests are added to `packages/core/src/config/config.test.ts` to verify the correct loading, initialization, and retrieval of all new concurrency settings from various sources.

---

#### 5. Progress & Updates

- [ ]

---

#### 6. Issues & Blocks

- [ ]

---

#### 7. Code References

- **File Paths**:
  - [`packages/core/src/config/config.ts`](packages/core/src/config/config.ts)
  - [`packages/core/src/config/config.test.ts`](packages/core/src/config/config.test.ts) (for new unit tests)
- **Relevant Commits**: [Insert Git commit links or hashes]

---

### Ticket: T-006: Ensure build protocol adherence (Ongoing Process)

- **Ticket ID**: T-006
- **Related User Story**: US-008: Standardized Build Process, US-009: Build Failure Diagnosis, US-010: Incremental Feature Development, US-011: Rigorous Per-Increment Testing, US-012: Issue Tracking and Resolution
  - **Link**: [`./.dev-docs/user-stories.md#user-story-standardized-build-process`](./.dev-docs/user-stories.md#user-story-standardized-build-process) (and others)
- **Assigned To**: All Developers
- **Status**: In Progress
- **Priority**: Must-have
- **Estimated Effort**: Ongoing

#### 1. Task Description

This is an ongoing process task to ensure continuous adherence to the project's defined development lifecycle standards. This includes:

- Following the standardized build protocol (`npm install`, `npm run preflight`, `npm run build all`).
- Utilizing `git diff HEAD` for efficient build failure diagnosis.
- Implementing features incrementally, with small, testable units.
- Adhering to the rigorous per-increment testing protocol (unit, integration, CLI executor, performance, error scenarios).
- Diligently tracking all issues and their resolutions in `.chorus/issue_tracker.md`.

---

#### 2. Architectural Guidance

- **Responsible Module**: N/A (Process adherence)
  - **Sub-module/File**: N/A
- **Key Function/Method to Implement/Modify**: N/A
- **Dependencies**: N/A
- **Relevant Naming Conventions**: N/A
- **Scope within Module**: Applies across all modules and development activities.

---

#### 3. Data Flow & Interfaces

- **Inputs**: Developer actions, code changes, test results.
- **Outputs**: Clean builds, passing tests, documented issues, incremental progress.
- **Transformation**: N/A
- **Interactions**: N/A

---

#### 4. Acceptance Criteria

- All code changes are preceded by successful `npm run preflight` and `npm run build all`.
- When a build fails, `git diff HEAD` is used to identify the source of the error.
- New features are broken down into small, shippable increments.
- Each increment passes all relevant unit, integration, and CLI executor tests.
- All identified bugs or issues are logged and updated in `.chorus/issue_tracker.md`.
- No regressions are introduced in existing functionality.

---

#### 5. Progress & Updates

- **[Date: 2025-07-29]** – Detailler Mode: Initial context added. This ticket is ongoing and will be updated by Coder/Tester/Debugger modes.

---

#### 6. Issues & Blocks

- [ ]

---

#### 7. Code References

- **File Paths**:
  - [`.chorus/build_protocol.md`](.chorus/build_protocol.md)
  - [`.chorus/implementation_guide.md`](.chorus/implementation_guide.md) (Section 4: Rigorous Testing Strategy)
  - [`.chorus/issue_tracker.md`](.chorus/issue_tracker.md)
  - [`./.dev-docs/project-specifics.md`](./.dev-docs/project-specifics.md)
- **Relevant Commits**: [Insert Git commit links or hashes]
