# Project Chorus: Issue Tracker

| Increment | Issue                                           | Status    | Assigned To |
| --------- | ----------------------------------------------- | --------- | ----------- |
| 1         | Basic Syntax Parsing                           | Failed QA | Coder       |
| 1         | Debug `parseConcurrentSyntax`                   | Complete  | Coder       |
| 1         | Missing Concurrent Syntax Telemetry in CLI     | Complete  | Debug Specialist |

## 2025-07-24 16:05 - Debug `parseConcurrentSyntax`

Issue Type: logic-error
Severity: 🔴 Critical
Description: The `parseConcurrentSyntax` function in `packages/core/src/core/client.ts` was not correctly identifying concurrent calls and was missing telemetry event logging. This was causing the Basic Syntax Parsing feature to fail QA.
Error Message: Concurrent syntax detection was not working as expected, with no telemetry events being logged when concurrent calls were detected.
Files Affected: packages/core/src/core/client.ts, packages/core/src/telemetry/types.ts, packages/core/src/telemetry/loggers.ts, packages/core/src/telemetry/loggers.test.ts, packages/core/src/core/client.test.ts
Solution Applied:

1. Added ConcurrentSyntaxDetectedEvent class to telemetry/types.ts with properties for event name, timestamp, prompt_id, call_count, and calls
2. Added logConcurrentSyntaxDetected function to telemetry/loggers.ts that logs the concurrent syntax detection event
3. Modified parseConcurrentSyntax method in core/client.ts to include debug logging and telemetry event triggering
4. Added conditional debug logging based on config.getDebugMode()
5. Added telemetry event logging when concurrent calls are detected
6. Updated mock config object in client.test.ts to include getDebugMode method
7. Added tests for the new telemetry event in loggers.test.ts
   Time to Resolution: 2 hours
   Prevention Notes: Ensure all telemetry events are properly tested and that mock objects in tests include all necessary methods.
   Related Issues: Basic Syntax Parsing (Increment 1)

## 2025-07-24 20:30 - Missing Concurrent Syntax Telemetry in CLI

Issue Type: missing-feature
Severity: 🟡 Medium
Description: The concurrent syntax telemetry event `concurrent_syntax_detected` was not being logged in the non-interactive CLI path despite concurrent calls being successfully executed by the Gemini API. This caused acceptance tests to fail when verifying that telemetry events are properly logged for concurrent syntax usage.

Error Message: `concurrent_syntax_detected` telemetry event missing from OpenTelemetry logs during acceptance testing with `--prompt "call1: What is TypeScript?, call2: What is JavaScript?"`

Root Cause Analysis:
- The Gemini API server has built-in concurrent syntax parsing that processes `"call1: ..., call2: ..."` syntax internally
- The non-interactive CLI path (`runNonInteractive` in `packages/cli/src/nonInteractiveCli.ts`) was missing concurrent syntax detection and telemetry logging
- The interactive CLI path already had concurrent syntax detection in `client.sendMessageStream`, but this was not used by the non-interactive path

Files Affected:
- `packages/cli/src/nonInteractiveCli.ts` (main implementation)
- `packages/core/src/telemetry/index.ts` (export telemetry functions)
- `packages/core/src/core/client.test.ts` (unit tests)

Solution Applied:
1. **Added concurrent syntax detection to non-interactive CLI**: Implemented regex parsing in `runNonInteractive` function to detect `callN: prompt` patterns
2. **Integrated telemetry logging**: Used existing `ConcurrentSyntaxDetectedEvent` class and `logConcurrentSyntaxDetected` function to log telemetry events when concurrent syntax is detected
3. **Exported telemetry functions**: Updated `packages/core/src/telemetry/index.ts` to export the required telemetry logging functions
4. **Added comprehensive unit tests**: Created failing test in `client.test.ts` that verifies concurrent syntax detection and telemetry logging works correctly

Technical Implementation:
- **Regex Pattern**: `/(call\d+):\s*((?:[^,]|,(?!\s*call\d+:))*)(?=,\s*call\d+:|$)/g` to parse concurrent call syntax
- **Telemetry Integration**: Reused existing telemetry infrastructure without code duplication
- **Non-Intrusive Design**: Added detection early in `runNonInteractive` before API calls, ensuring telemetry is logged regardless of how the API processes the concurrent syntax

Verification:
- ✅ Unit tests pass (61/61 tests passing)
- ✅ Acceptance test confirms `concurrent_syntax_detected` telemetry event is logged
- ✅ Existing functionality preserved
- ✅ Both tool calls execute successfully for TypeScript and JavaScript queries

Time to Resolution: 3 hours
Prevention Notes:
- Ensure telemetry coverage for all execution paths (interactive vs non-interactive)
- Use acceptance tests to verify end-to-end telemetry functionality
- Consider API-level vs client-level processing when implementing features

Related Issues: Debug `parseConcurrentSyntax` (Increment 1), Basic Syntax Parsing (Increment 1)
