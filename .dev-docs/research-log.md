# Research Log: 2025-07-29

- **Research Topic/Uncertainty**: Technical uncertainties for Project Chorus concurrent API orchestration.
- **Triggered By**:
  - **User Story ID**: US-006, US-002, US-004, US-008
    - **Link**: [`./.dev-docs/user-stories.md`](./.dev-docs/user-stories.md)
  - **Iteration ID**: Iteration 2: Enhanced Control & Developer Experience, Iteration 3: Intelligent Automation & Optimizations
    - **Link**: [`./.dev-docs/iteration-plan.md`](./.dev-docs/iteration-plan.md)
- **Researcher**: Researcher Mode

---

## 1. Original Uncertainty/Problem Statement

Investigate and provide technical insights for the following uncertainties identified in the strategic plan:
1.  Tool Usage within Concurrent Streams (US-006): How to manage sequential tool confirmations and execution within parallel streams without deadlocks or conflicts.
2.  LLM Accuracy for Intelligent Prompt Processing (US-002): Strategies for achieving high accuracy in LLM-based prompt analysis for concurrency and robust fallback mechanisms.
3.  Advanced Stream Aggregation Algorithms (US-004): Algorithms and data structures for intelligent synthesis, conflict detection, and quality scoring of multiple LLM text streams.
4.  Performance Optimization Strategies (US-008): Best practices for concurrent API client performance, including rate limiting, connection pooling, error recovery, and streaming optimization.

---

## 2. Research Questions

- How can `CoreToolScheduler` be adapted to manage tool calls from multiple concurrent streams while maintaining sequential execution and user approval?
- What prompt engineering techniques or LLM capabilities can enhance accuracy in classifying prompts for concurrent vs. sequential processing?
- What algorithms or patterns exist for intelligently merging and synthesizing text-based asynchronous streams, especially with potential conflicts?
- What are the key strategies and best practices for optimizing performance, managing rate limits, and ensuring robust error recovery in concurrent API clients?

---

## 3. Evaluated Options

### Uncertainty: Tool Usage within Concurrent Streams (US-006)

**Description:** The current `CoreToolScheduler` enforces a global lock, preventing new tool calls while others are executing or awaiting approval. This conflicts with the need for independent tool execution within concurrent streams.

**Key Characteristics:**
- `CoreToolScheduler` manages tool call lifecycle (validation, execution, approval).
- `Turn.handlePendingFunctionCall()` yields `ToolCallRequest` events.
- `sendMessageStream` needs to pause a specific stream for tool approval/execution.

**Advantages:**
- Centralized tool management via `CoreToolScheduler` ensures consistency and security.
- Existing `ToolCallRequest` event and confirmation flow can be reused.

**Disadvantages:**
- `CoreToolScheduler`'s current design (global lock via `isRunning()`) is a blocker for concurrent tool execution.
- Requires significant modification to `CoreToolScheduler` or a new per-stream tool scheduling mechanism.

**Evaluated Options for Resolution:**
1.  **Option: Modify `CoreToolScheduler` for Multiple Queues/Contexts**
    - **Description**: Enhance `CoreToolScheduler` to manage multiple independent queues of tool calls, one per concurrent stream. It would still handle global user confirmations sequentially but allow parallel processing of tool requests up to `maxConcurrentCalls`.
    - **Pros**: Reuses existing robust tool scheduling logic; maintains centralized control over approvals.
    - **Cons**: Complex modification to a core component; potential for new race conditions if not carefully implemented.
2.  **Option: Per-Stream Tool Schedulers**
    - **Description**: Each concurrent `Turn` instance gets its own `CoreToolScheduler` instance. A higher-level orchestrator would then manage user approvals across these independent schedulers, potentially pausing the relevant stream.
    - **Pros**: Simpler to implement per-stream logic; clear separation of concerns.
    - **Cons**: Duplication of `CoreToolScheduler` logic; complex global approval management; potential for conflicting tool requests (e.g., two streams trying to write to the same file simultaneously).

**Relevant Links:**
- [`packages/core/src/core/turn.ts`](packages/core/src/core/turn.ts)
- [`packages/core/src/core/coreToolScheduler.ts`](packages/core/src/core/coreToolScheduler.ts)

---

### Uncertainty: LLM Accuracy for Intelligent Prompt Processing (US-002)

**Description:** Achieving high accuracy (>80%) in LLM-based classification of user prompts for sequential vs. concurrent processing, and generating well-formed, logical concurrent call structures.

**Key Characteristics:**
- LLM needs to classify prompt type (`sequential` | `concurrent`).
- LLM needs to generate structured JSON output for concurrent calls.
- Fallback mechanisms are crucial if LLM analysis fails.

**Advantages:**
- LLM can adapt to complex user intents beyond simple keyword matching.
- Automates decision-making, improving user experience.

**Disadvantages:**
- Accuracy depends heavily on prompt engineering and LLM capabilities.
- Potential for hallucinations or malformed JSON output.

**Evaluated Options for Resolution:**
1.  **Option: Advanced Prompt Engineering (Few-shot/Chain-of-Thought)**
    - **Description**: Utilize few-shot examples within the LLM prompt to demonstrate desired classification and structured output format. Incorporate Chain-of-Thought prompting (e.g., "Let's think step by step") to guide the LLM's reasoning process.
    - **Pros**: Improves accuracy and consistency of LLM output without fine-tuning. Relatively quick to implement.
    - **Cons**: Prompt length can increase, consuming more tokens. May not be sufficient for highly ambiguous cases.
2.  **Option: LLM Fine-tuning (Future Consideration)**
    - **Description**: Fine-tune a smaller, specialized LLM on a dataset of user prompts labeled with desired processing types and concurrent call structures.
    - **Pros**: Potentially highest accuracy and efficiency for this specific task.
    - **Cons**: Requires significant data labeling effort and computational resources. Not suitable for initial implementation.
3.  **Option: Robust Fallback Mechanisms**
    - **Description**: Implement comprehensive error handling for LLM responses, including JSON parsing validation. If LLM analysis fails, fall back to manual syntax parsing (US-001) or default to sequential processing.
    - **Pros**: Ensures system stability and user experience even with LLM failures.
    - **Cons**: May result in suboptimal processing if fallback is frequently triggered.

**Relevant Links:**
- [Prompt Engineering Guide - Dair.ai](https://github.com/dair-ai/prompt-engineering-guide) (General resource for prompt engineering techniques)

---

### Uncertainty: Advanced Stream Aggregation Algorithms (US-004)

**Description:** Implementing smarter result combination strategies for multiple LLM text streams, including conflict detection, quality scoring, confidence weighting, and cross-call relationship detection.

**Key Characteristics:**
- Merging `AsyncGenerator<ServerGeminiStreamEvent>` streams.
- Beyond simple concatenation: semantic understanding of content.
- Identifying contradictions or complementary information.

**Advantages:**
- Provides a more coherent and insightful aggregated response.
- Reduces information overload for the user.

**Disadvantages:**
- Highly complex, requiring advanced NLP/semantic analysis.
- No direct off-the-shelf libraries found for this specific problem.

**Evaluated Options for Resolution:**
1.  **Option: LLM-based Synthesis (Post-processing)**
    - **Description**: After all concurrent streams complete, feed their individual outputs (or key summaries) to another LLM instance with a prompt to perform intelligent synthesis, conflict resolution, and summarization.
    - **Pros**: Leverages LLM's natural language understanding capabilities for complex synthesis. Flexible and adaptable.
    - **Cons**: Introduces additional latency for the final aggregation step. Increases API costs.
2.  **Option: Rule-based/Heuristic Aggregation (Incremental)**
    - **Description**: Implement a set of heuristics or rules within `StreamAggregator` to detect simple conflicts (e.g., contradictory facts) or identify related content based on keywords or basic semantic similarity.
    - **Pros**: Real-time processing; lower latency and cost than LLM post-processing.
    - **Cons**: Limited in complexity; difficult to scale for nuanced semantic understanding. Requires manual rule definition.
3.  **Option: Attribute-based Merging with Prioritization**
    - **Description**: Continue to use `callId` for attribution. For conflicting information, prioritize based on predefined rules (e.g., "security analysis" overrides "general analysis" for security-related content).
    - **Pros**: Simple to implement; provides a deterministic resolution.
    - **Cons**: Can be overly simplistic; may miss subtle conflicts or important nuances.

**Relevant Links:**
- No direct library matches found for "intelligent synthesis" of LLM outputs. This area likely requires custom development leveraging NLP techniques or further LLM calls.

---

### Uncertainty: Performance Optimization Strategies (US-008)

**Description:** Optimizing for performance, cost, and reliability in production usage, including rate limiting, connection pooling, advanced error recovery, and streaming performance.

**Key Characteristics:**
- Concurrent API calls can hit rate limits.
- Efficient network resource utilization.
- Robustness against transient failures.

**Advantages:**
- Ensures system stability and responsiveness under load.
- Reduces operational costs.

**Disadvantages:**
- Requires careful implementation to avoid introducing new bottlenecks.
- Balancing performance with resource consumption.

**Evaluated Options for Resolution:**
1.  **Option: Client-Side Rate Limiting (Token Bucket/Leaky Bucket)**
    - **Description**: Implement a client-side rate limiter (e.g., using a token bucket or leaky bucket algorithm) to control the number of outgoing API requests per unit of time.
    - **Pros**: Prevents hitting API rate limits; ensures fair usage.
    - **Cons**: Adds complexity to the client; requires careful tuning of parameters.
2.  **Option: Connection Pooling (HTTP/2 Multiplexing)**
    - **Description**: Reuse underlying HTTP/2 connections for multiple concurrent API calls. For gRPC, this means reusing gRPC channels. If concurrent stream limits are reached, create additional connections.
    - **Pros**: Reduces overhead of establishing new connections; improves latency.
    - **Cons**: Requires proper management of channel lifecycle.
3.  **Option: Exponential Backoff and Retry Logic**
    - **Description**: For transient API errors (e.g., rate limit errors, network issues), implement an exponential backoff strategy for retrying failed requests.
    - **Pros**: Improves resilience and reliability; reduces manual intervention.
    - **Cons**: Can increase overall latency for failed requests.
4.  **Option: Streaming Buffering and Batching**
    - **Description**: For streaming outputs, consider intelligent buffering and batching strategies to optimize network throughput and reduce overhead, while still maintaining real-time perception.
    - **Pros**: Improves efficiency of data transfer.
    - **Cons**: Can introduce slight latency if buffering is too aggressive.

**Relevant Links:**
- [Mastering API Throughput: 8 Key Strategies for Optimal Performance](https://zuplo.com/blog/2025/02/21/mastering-api-throughput)
- [10 Best Practices for API Rate Limiting in 2025](https://zuplo.com/blog/2025/01/06/10-best-practices-for-api-rate-limiting-in-2025)
- [Performance best practices with gRPC | Microsoft Learn](https://learn.microsoft.com/en-us/aspnet/core/grpc/performance?view=aspnetcore-9.0)
- [Best Practices for Handling Concurrent API Requests](https://medium.com/@mohamedsaidibrahim/best-practices-for-handling-concurrent-api-requests-requesting-responding-and-recovery-4716504f2477)
- [Effective Strategies for Rate Limiting Asynchronous Requests in Python](https://proxiesapi.com/articles/effective-strategies-for-rate-limiting-asynchronous-requests-in-python)

---

## 4. Assumptions and Knowledge Gaps

- **Assumption 1:** The existing `GeminiClient` and `Turn` classes provide sufficient hooks or extensibility points to integrate the proposed concurrency and tool scheduling modifications without requiring a complete rewrite.
- **Knowledge Gap 1:** Specific implementation details for pausing and resuming individual `AsyncGenerator` streams in TypeScript/JavaScript. This might require custom `Promise` or `async/await` patterns.
- **Knowledge Gap 2:** The exact performance impact of LLM-based prompt analysis and advanced aggregation on overall response times and API costs. Requires benchmarking during implementation.
- **Knowledge Gap 3:** The optimal balance between real-time streaming and buffering/batching for aggregated outputs to maximize perceived performance without excessive resource consumption.

---

## 5. Conclusion / Summary of Findings (Informative Only)

Research for Project Chorus's technical uncertainties has yielded the following:

- **Tool Usage (US-006)**: The current `CoreToolScheduler`'s global lock is a primary challenge. Solutions involve either modifying `CoreToolScheduler` to manage multiple tool queues per stream or implementing per-stream schedulers with a global approval orchestrator. The former seems more aligned with existing architecture but is more complex.
- **LLM Accuracy (US-002)**: High accuracy in LLM-based prompt classification can be achieved through advanced prompt engineering (few-shot, Chain-of-Thought). Robust fallback mechanisms are essential for reliability.
- **Advanced Aggregation (US-004)**: Direct libraries for intelligent LLM output synthesis are not readily available. This will likely require custom solutions, potentially leveraging LLMs for post-processing synthesis or implementing rule-based heuristics for real-time merging.
- **Performance Optimization (US-008)**: Standard best practices for concurrent API clients apply, including client-side rate limiting (token/leaky bucket), connection pooling (HTTP/2 multiplexing), exponential backoff for retries, and intelligent streaming buffering.

These findings provide a foundation for the Detailler Mode to design the specific technical solutions for each increment.

---

## 6. Research History

- **[Date: 2025-07-29]** – Researcher Mode: Initial research completed for all flagged technical uncertainties.