# `Increment 1: Basic Syntax Parsing` Implementation Plan

## Overview

Implement the logic to parse user input for the `callN:` syntax within the existing streaming architecture. This increment adds concurrent syntax detection to [`GeminiClient.sendMessageStream()`](packages/core/src/core/client.ts:288) method, enabling the system to identify when users want concurrent processing vs sequential processing.

**Primary Goals:**

- Parse `callN: prompt1, callN: prompt2` syntax from [`PartListUnion`](packages/core/src/utils/partUtils.ts:14) request
- Integrate parsing logic into existing streaming flow with minimal disruption
- Add configuration support for concurrency settings
- Maintain backward compatibility with existing sequential processing

## Current Codebase Analysis

### Relevant Files

- **[`packages/core/src/core/client.ts`](packages/core/src/core/client.ts:1)** - Main integration point, contains [`sendMessageStream()`](packages/core/src/core/client.ts:288) method
- **[`packages/core/src/config/config.ts`](packages/core/src/config/config.ts:1)** - Configuration system, needs new concurrency settings
- **[`packages/core/src/utils/partUtils.ts`](packages/core/src/utils/partUtils.ts:1)** - Text extraction utilities, contains [`partToString()`](packages/core/src/utils/partUtils.ts:13) function
- **[`packages/core/src/core/turn.ts`](packages/core/src/core/turn.ts:1)** - Turn execution logic (used for reference)

### Patterns/Conventions

- **Async Generator Pattern**: [`sendMessageStream()`](packages/core/src/core/client.ts:288) returns `AsyncGenerator<ServerGeminiStreamEvent, Turn>`
- **Text Extraction**: Use [`partToString(value)`](packages/core/src/utils/partUtils.ts:13) utility for converting [`PartListUnion`](packages/core/src/utils/partUtils.ts:14) to string
- **Configuration Pattern**: Add to [`ConfigParameters`](packages/core/src/config/config.ts:135) interface, implement getters in [`Config`](packages/core/src/config/config.ts:179) class
- **Error Handling**: Use [`reportError()`](packages/core/src/core/client.ts:30) function for consistent error reporting
- **Testing Pattern**: Create `.test.ts` files alongside implementation files

### Integration Points

- **Primary Integration**: [`GeminiClient.sendMessageStream()`](packages/core/src/core/client.ts:288) method, before [`turn.run()`](packages/core/src/core/client.ts:368) call
- **Configuration Access**: Through [`this.config`](packages/core/src/core/client.ts:111) property in [`GeminiClient`](packages/core/src/core/client.ts:87)
- **Text Processing**: Leverage existing [`partToString()`](packages/core/src/utils/partUtils.ts:13) utility

### Potential Conflicts

- **None Expected**: Purely additive changes to existing architecture
- **Backward Compatibility**: All existing functionality remains unchanged

## Detailed Implementation Specification

### File Structure

- **Modify**: [`packages/core/src/core/client.ts`](packages/core/src/core/client.ts:1) - Add `parseConcurrentSyntax()` method and integration logic
- **Modify**: [`packages/core/src/config/config.ts`](packages/core/src/config/config.ts:1) - Add concurrency configuration support
- **Create**: [`packages/core/src/core/client.test.ts`](packages/core/src/core/client.test.ts:1) - Unit tests for new parsing functionality (if not exists, extend existing)
- **Create**: [`packages/core/src/core/concurrentSyntaxParser.ts`](packages/core/src/core/concurrentSyntaxParser.ts:1) - Dedicated parser module (optional, could be inline)

### Interfaces and Contracts

**Types and Interfaces:**

```typescript
// In packages/core/src/config/config.ts
interface ConcurrencyConfig {
  enabled: boolean;
  maxConcurrentCalls: number;
  forceProcessing?: 'sequential' | 'concurrent';
}

interface ConcurrentCall {
  id: string;
  prompt: string;
}

interface ConcurrencyAnalysis {
  hasConcurrentCalls: boolean;
  calls: ConcurrentCall[];
}
```

**Functions:**

- **`parseConcurrentSyntax(request: PartListUnion): ConcurrencyAnalysis`** - Parse request for concurrent syntax
  - **Purpose**: Extract `callN:` patterns from user input
  - **Returns**: Analysis object indicating if concurrent calls detected and parsed calls
  - **Error Handling**: Return `{ hasConcurrentCalls: false, calls: [] }` on parse errors

**Configuration Methods:**

- **`getConcurrencyEnabled(): boolean`** - Check if concurrency is enabled
- **`getMaxConcurrentCalls(): number`** - Get max concurrent calls limit
- **`getForcedProcessingMode(): 'sequential' | 'concurrent' | undefined`** - Get forced processing mode

### Integration Requirements

**Existing Code to Modify:**

1. **[`packages/core/src/config/config.ts`](packages/core/src/config/config.ts:135)**:
   - **Add to `ConfigParameters` interface**: New `concurrency?: ConcurrencyConfig` property
   - **Add to `Config` class constructor**: Initialize concurrency settings with defaults
   - **Add getter methods**: `getConcurrencyEnabled()`, `getMaxConcurrentCalls()`, `getForcedProcessingMode()`

2. **[`packages/core/src/core/client.ts`](packages/core/src/core/client.ts:288)**:
   - **Add `parseConcurrentSyntax()` method**: Parse concurrent syntax from [`PartListUnion`](packages/core/src/utils/partUtils.ts:14)
   - **Modify `sendMessageStream()` method**: Add concurrent syntax detection before line 368 ([`turn.run()`](packages/core/src/core/client.ts:368))
   - **Add import**: Import [`partToString`](packages/core/src/utils/partUtils.ts:13) utility (already imported)

**New `imports`/`exports`:**

- **No new external dependencies required**
- **Use existing**: [`partToString`](packages/core/src/utils/partUtils.ts:13) from [`../utils/partUtils.js`](packages/core/src/utils/partUtils.ts:1)
- **Use existing**: [`PartListUnion`](packages/core/src/utils/partUtils.ts:14) from [`@google/genai`](packages/core/src/core/client.ts:12)

**Configuration Changes:**

- **Environment Variables** (optional): `GEMINI_CONCURRENCY_ENABLED`, `GEMINI_MAX_CONCURRENT_CALLS`, `GEMINI_FORCE_PROCESSING`
- **Settings.json Integration**: Add `concurrency` section to configuration schema
- **Default Values**: `enabled: true`, `maxConcurrentCalls: 3`, `forceProcessing: undefined`

### Unit Testing Requirements

**Test Files:**

- **[`packages/core/src/core/client.test.ts`](packages/core/src/core/client.test.ts:1)** - Add tests for `parseConcurrentSyntax()` method
- **[`packages/core/src/config/config.test.ts`](packages/core/src/config/config.test.ts:1)** - Add tests for concurrency configuration

**Key Test Cases:**

- **Valid Concurrent Syntax**: `"call1: analyze security, call2: check performance"`
- **Invalid Syntax**: `"call1 analyze security"` (missing colon)
- **Mixed Content**: `"call1: prompt1, regular text, call2: prompt2"`
- **Edge Cases**: Empty calls, single call, malformed syntax
- **PartListUnion Variants**: String input, Part array input, single Part input
- **Configuration Tests**: Default values, custom settings, environment variables

**Mocking:**

- **Mock [`partToString()`](packages/core/src/utils/partUtils.ts:13)**: Not needed, use real implementation
- **Mock [`Config`](packages/core/src/config/config.ts:179)**: Create test config instances with known concurrency settings

**Edge Cases:**

- **Empty/null input**: Handle gracefully, return no concurrent calls
- **Non-text Parts**: Skip parts without text content
- **Malformed syntax**: Parse what's valid, ignore malformed parts
- **Configuration disabled**: Respect `enabled: false` setting

### Error Handling Strategy

**Consistent with Existing Patterns:**

- **Use [`reportError()`](packages/core/src/core/client.ts:30)**: For unexpected parsing errors
- **Graceful Degradation**: On parse errors, fall back to sequential processing
- **No Exceptions**: Return safe default values instead of throwing
- **Logging**: Use console.warn for non-critical parsing issues

**Error Scenarios:**

- **Parse Failures**: Return `{ hasConcurrentCalls: false, calls: [] }`
- **Configuration Errors**: Use safe defaults and log warnings
- **Invalid Input**: Skip invalid parts, process valid ones

## Build Integration Notes

**Impact on Build Process:**

- **No new dependencies**: Uses existing utilities and types
- **No breaking changes**: Purely additive functionality
- **TypeScript**: New interfaces will be type-checked during build

**Deployment Considerations:**

- **Backward Compatible**: Existing functionality unchanged
- **Configuration**: May need to update default config schemas
- **Testing**: Ensure all tests pass before deployment

## Clarification Needed

**None at this time** - Requirements are clear from implementation guide and codebase analysis.

## Potential Risks

**Integration Challenges:**

- **Minimal Risk**: Changes are additive and isolated
- **Testing Required**: Ensure existing functionality unaffected

**Breaking Changes:**

- **None Expected**: All changes are additive to existing interfaces

**Performance Concerns:**

- **Parsing Overhead**: Minimal regex/string parsing cost
- **Memory Usage**: Small increase for storing parsed call data
- **Mitigation**: Use efficient parsing, minimal object allocation

## Implementation Sequence

1. **Add Configuration Support**: Extend [`ConfigParameters`](packages/core/src/config/config.ts:135) and [`Config`](packages/core/src/config/config.ts:179) class
2. **Implement Parser**: Add `parseConcurrentSyntax()` method to [`GeminiClient`](packages/core/src/core/client.ts:87)
3. **Integrate into Stream**: Modify [`sendMessageStream()`](packages/core/src/core/client.ts:288) to use parser
4. **Add Tests**: Comprehensive unit tests for all functionality
5. **Validate**: Ensure existing functionality remains intact

## Success Criteria

- **Parse Valid Syntax**: Successfully identify `callN:` patterns in user input
- **Maintain Compatibility**: All existing tests continue to pass
- **Configuration Works**: Settings properly control parsing behavior
- **Error Handling**: Graceful handling of malformed input
- **Performance**: No measurable impact on sequential processing
