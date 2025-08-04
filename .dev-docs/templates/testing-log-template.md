# Testing Log: [Iteration Name/ID - e.g., Sprint 1: Core CLI Conversion MVP]

---

## Metadata

- **Iteration ID**: [e.g., Sprint-1-MVP]
- **Link to Iteration Plan**: `./dev-docs/iteration_template.md#Sprint-1-MVP`
- **Tester**: Tester Mode
- **Testing Date**: [YYYY-MM-DD HH:MM]
- **Last Updated**: [YYYY-MM-DD HH:MM]

---

## 1. Overall Testing Summary

- **Build/Compilation Status**: [PASS/FAIL]
  - **Details (if FAIL)**: [Describe compilation errors, if any. Refer to `./dev-docs/project-specifics.md` for build instructions.]
- **Unit Test Execution Status**: [PASS/FAIL]
  - **Total Unit Tests Run**: [Number]
  - **Unit Tests Passed**: [Number]
  - **Unit Tests Failed**: [Number]
  - **Details (if FAIL)**: [Summarize unit test failures. Refer to `./dev-docs/project-specifics.md` for unit test execution instructions.]
- **Functional Testing Status**: [All Tests Passed/Some Failures/Blocked]
- **Overall Assessment**: [Brief summary of the iteration's quality status.]

---

## 2. Test Cases and Results

_This section details the execution of individual test cases._

### Test Case: [e.g., TC-001: Single JPG to WebP Conversion - Happy Path]

- **Test Case ID**: TC-[Sequential Number]
- **Associated User Story**: [e.g., US-001: Convert Image to WebP]
  - **Link**: `./dev-docs/user-stories.md#US-001`
- **Associated Development Ticket**: [e.g., T-001: Implement Core Image Conversion Utility]
  - **Link**: `./dev-docs/ticket_template.md#T-001`
- **Test Type**: [Functional/Integration/Performance/Security/Usability]
- **Tested By**: Tester Mode
- **Date Executed**: [YYYY-MM-DD HH:MM]
- **Status**: [PASS/FAIL/BLOCKED]

#### Test Steps

1.  [e.g., Place `input.jpg` in the test directory.]
2.  [e.g., Execute CLI command: `python cli_app.py convert input.jpg output.webp --from jpg --to webp`]
3.  [e.g., Verify `output.webp` exists in the test directory.]
4.  [e.g., Open `output.webp` in an image viewer and confirm content.]

#### Expected Outcome

- The CLI command executes successfully without errors.
- A new file named `output.webp` is created.
- The original `input.jpg` file remains unchanged.
- `output.webp` is a valid WebP image containing the converted content.

#### Actual Outcome

[Describe what actually happened. Be precise.]

#### Verdict

**[PASS/FAIL/BLOCKED]**

---

### Test Case: [e.g., TC-002: Single JPG to WebP Conversion - Invalid Input Path]

- **Test Case ID**: TC-[Sequential Number]
- **Associated User Story**: [e.g., US-001: Convert Image to WebP]
  - **Link**: `./dev-docs/user-stories.md#US-001`
- **Associated Development Ticket**: [e.g., T-001: Implement Core Image Conversion Utility]
  - **Link**: `./dev-docs/ticket_template.md#T-001`
- **Test Type**: [Functional/Negative]
- **Tested By**: Tester Mode
- **Date Executed**: [YYYY-MM-DD HH:MM]
- **Status**: [PASS/FAIL/BLOCKED]

#### Test Steps

1.  [e.g., Ensure `non_existent.jpg` does NOT exist in the test directory.]
2.  [e.g., Execute CLI command: `python cli_app.py convert non_existent.jpg output.webp --from jpg --to webp`]

#### Expected Outcome

- The CLI command fails gracefully.
- An error message indicating "Input file not found" or similar is displayed on the console.
- No output file is created.

#### Actual Outcome

[Describe what actually happened. Be precise.]

#### Verdict

**[PASS/FAIL/BLOCKED]**

---

## 3. Identified Issues / Bugs

_This section lists all issues found during testing, with detailed reproduction steps for the Debugger Mode._

### Issue: [e.g., BUG-001: Corrupted WebP Output]

- **Issue ID**: [e.g., BUG-001]
- **Reported By**: Tester Mode
- **Date Reported**: [YYYY-MM-DD HH:MM]
- **Status**: [Open/Under Diagnosis/Fix Implemented/Closed]
- **Related Test Case ID**: [e.g., TC-001]

#### Description of Issue

> _Example: "When converting a JPG image to WebP, the resulting .webp file is corrupted and cannot be opened by standard image viewers."_
>
> [Concise summary of the bug.]

#### Steps to Reproduce (for Debugger)

1.  [e.g., Use `sample.jpg` (attached/available in test data).]
2.  [e.g., Run `python cli_app.py convert sample.jpg output.webp --from jpg --to webp`.]
3.  [e.g., Attempt to open `output.webp` with any image viewer.]

- **Expected Outcome**: `output.webp` should open as a valid image.
- **Actual Outcome**: `output.webp` is reported as corrupted or unreadable by image viewers.

#### Relevant Error Messages/Logs

```
[Paste relevant error messages, stack traces, or log snippets here.]
```

#### Supporting Evidence

- [Attach screenshot of corrupted file/error message, if applicable.]
- [Link to specific log lines.]

_... (Add more issues as needed, following the same structure.)_

---

## 4. Testing History

- **[YYYY-MM-DD HH:MM]** - Tester Mode: Initial build verification and unit test run.
- **[YYYY-MM-DD HH:MM]** - Tester Mode: Functional testing for US-001 completed. Identified BUG-001.
- **[YYYY-MM-DD HH:MM]** - Tester Mode: Re-verified fix for BUG-001 (TC-001 now PASS).
