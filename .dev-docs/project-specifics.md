# Project Specifics: Gemini CLI

---

## Metadata

- **Date**: 2025-07-29
- **Version**: 0.1.13
- **Filled By**: Project Initializer Mode
- **Last Updated**: 2025-07-29 11:27 UTC+2:00

---

## 📐 Programming Guidelines & Project Context

This document contains project-specific information that is critical for all AI modes to understand when working on this codebase. It serves as the single source of truth for technical context, build instructions, and development environment details.

---

## 🖥️ System Information

### Operating System

- **Primary OS**: Linux
- **Supported OS**: Linux, macOS, Windows (implied by Node.js/TypeScript cross-platform nature and Dockerfile)
- **Architecture**: x86_64, ARM64 (common for Node.js/Docker environments)

### Runtime Environment

- **Primary Language**: TypeScript
- **Package Manager**: npm
- **Virtual Environment**: Node.js `node_modules` (local to project via `npm install`)

---

## 📦 Dependencies & Versions

### Core Dependencies

- **@google/genai**: 1.9.0 - Gemini API client library
- **@modelcontextprotocol/sdk**: 1.11.0 - Model Context Protocol SDK
- **@opentelemetry/api**: 1.9.0 - OpenTelemetry API for tracing and metrics
- **@opentelemetry/exporter-logs-otlp-grpc**: 0.52.0 - OpenTelemetry OTLP gRPC Log Exporter
- **@opentelemetry/exporter-metrics-otlp-grpc**: 0.52.0 - OpenTelemetry OTLP gRPC Metrics Exporter
- **@opentelemetry/exporter-trace-otlp-grpc**: 0.52.0 - OpenTelemetry OTLP gRPC Trace Exporter
- **@opentelemetry/instrumentation-http**: 0.52.0 - OpenTelemetry HTTP Instrumentation
- **@opentelemetry/sdk-node**: 0.52.0 - OpenTelemetry Node.js SDK
- **react**: ^19.1.0 - UI library (used with Ink)
- **ink**: ^6.0.1 - React for interactive command-line apps
- **yargs**: ^17.7.2 - Command-line argument parser
- **diff**: ^7.0.0 - Library for computing and applying diffs
- **dotenv**: ^17.1.0 - Loads environment variables from `.env` file
- **glob**: ^10.4.5 - File matching utility
- **google-auth-library**: ^9.11.0 - Google authentication library
- **simple-git**: ^3.28.0 - Git operations in Node.js
- **ws**: ^8.18.0 - WebSocket client and server
- **undici**: ^7.10.0 - HTTP/1.1, HTTP/2 and WebSockets client
- **mime-types**: ^3.0.1 - Comprehensive MIME type mappings
- **open**: ^10.1.2 - Opens files and URLs with default applications
- **strip-ansi**: ^7.1.0 - Strips ANSI escape codes from strings

### Development Dependencies

- **typescript**: ^5.3.3 - TypeScript compiler
- **vitest**: ^3.1.1 - Unit and integration testing framework
- **@vitest/coverage-v8**: ^3.1.1 - Code coverage for Vitest
- **eslint**: ^9.24.0 - Linter
- **prettier**: ^3.5.3 - Code formatter
- **esbuild**: ^0.25.0 - Fast JavaScript bundler
- **cross-env**: ^7.0.3 - Sets environment variables across platforms
- **concurrently**: ^9.2.0 - Runs multiple commands concurrently
- **@types/\* (various)**: Type definitions for various libraries

### System Dependencies

- **Node.js**: >=20.0.0 (from `package.json` engines)
- **npm**: (implied by `package.json` and `npm` commands)
- **Docker**: 24.0+ (for sandbox environment, implied by `Dockerfile` and `GEMINI_SANDBOX` usage)
- **gcloud CLI**: (for `gcloud auth configure-docker` in `package.json` scripts)

---

## 🏗️ Project Structure (Monorepo)

This project uses a monorepo structure managed by npm workspaces.

```plaintext
/project-root
├── packages/
│   ├── cli/             # CLI application logic and UI
│   │   ├── src/
│   │   │   ├── acp/
│   │   │   ├── config/
│   │   │   ├── services/
│   │   │   ├── test-utils/
│   │   │   └── ui/
│   │   └── package.json
│   │   └── tsconfig.json
│   │   └── vitest.config.ts
│   └── core/            # Core logic, API interaction, tools, telemetry
│       ├── src/
│       │   ├── code_assist/
│       │   ├── config/
│       │   ├── core/
│       │   ├── mcp/
│       │   ├── services/
│       │   ├── telemetry/
│       │   └── tools/
│       │   └── utils/
│       └── package.json
│       └── tsconfig.json
├── docs/                # Project documentation (architecture, CLI usage, etc.)
├── integration-tests/   # End-to-end and integration tests
├── scripts/             # Build, test, and utility scripts
├── .chorus/             # Project management documentation (build protocol, ideas, issue tracker)
├── README.md
├── package.json         # Root workspace configuration
├── tsconfig.json        # Root TypeScript configuration
├── eslint.config.js     # ESLint configuration
├── prettierrc.json      # Prettier configuration
├── Makefile             # Build automation
├── Dockerfile           # Docker configuration for sandbox
└── etc.
```

**Directory Status (relative to project root):**

- [ ] `controllers/` - Missing (Functionality distributed within `packages/cli/src/services/` and `packages/core/src/core/`)
- [ ] `services/` - Present (e.g., `packages/cli/src/services/`, `packages/core/src/services/`)
- [ ] `utils/` - Present (e.g., `packages/cli/src/utils/`, `packages/core/src/utils/`)
- [ ] `views/` - Missing (CLI UI components are in `packages/cli/src/ui/components/`)
- [ ] `config/` - Present (e.g., `packages/cli/src/config/`, `packages/core/src/config/`)
- [ ] `tests/` - Present (e.g., `integration-tests/`, `packages/cli/src/**/*.test.ts`, `packages/core/src/**/*.test.ts`)

---

## 🔧 Build & Compilation Instructions

### Environment Setup

```bash
# Install root and workspace dependencies
npm install
```

### Build Commands

```bash
# Main project build (bundles CLI executable)
npm run build all

# Development build (builds individual packages)
npm run build

# Clean build artifacts
npm run clean
```

### Build Failure Diagnosis

```bash
# Generate diff to last commit for error diagnosis
git diff HEAD
```

### Configuration Files

- **Build Config**: `Makefile`, `package.json` (scripts), `esbuild.config.js`
- **Environment Config**: `.env` (implied by `dotenv` dependency), `packages/cli/src/config/config.ts`, `packages/core/src/config/config.ts`

---

## 🧪 Testing Instructions

### Unit Tests

```bash
# Command to run all unit tests across workspaces
npm test

# Command to run unit tests with coverage (CI)
npm run test:ci
```

### Integration Tests

```bash
# Command to run all integration tests (various sandbox modes)
npm run test:integration:all

# Command to run integration tests without sandbox
npm run test:integration:sandbox:none

# Command to run integration tests with Docker sandbox
npm run test:integration:sandbox:docker
```

### Test Configuration

- **Test Framework**: `vitest`
- **Coverage Tool**: `@vitest/coverage-v8`
- **Test Database**: Not applicable (no explicit database tests identified)

---

## 🎯 Development Lifecycle Standards

### Code Quality Tools

- **Formatter**: `prettier`
  - Command: `npm run format`
- **Linter**: `eslint`
  - Command: `npm run lint` (local), `npm run lint:ci` (CI, no warnings allowed)
- **Type Checker**: `typescript`
  - Command: `npm run typecheck`

### Pre-commit Hooks

- **Enabled**: No explicit pre-commit hooks configured.
- **Configuration**: N/A
- **Hooks**: The `preflight` script (`npm run preflight`) is a comprehensive check run before CI, which includes `format`, `lint:ci`, `build`, `typecheck`, and `test:ci`. This serves as a strong quality gate.

---

## 📋 Naming Conventions (Enforced)

| Element     | Convention                      | Example                             |
| ----------- | ------------------------------- | ----------------------------------- |
| Functions   | `camelCase`                     | `sendMessageStream()`               |
| Variables   | `camelCase`                     | `promptId`                          |
| Files       | `camelCase.ts`, `kebab-case.ts` | `client.ts`, `nonInteractiveCli.ts` |
| Classes     | `PascalCase`                    | `GeminiClient`, `CoreToolScheduler` |
| Constants   | `UPPER_SNAKE_CASE`              | `MAX_CONCURRENT_CALLS`              |
| Directories | `camelCase`, `kebab-case`       | `core`, `telemetry`, `code_assist`  |

### Language-Specific Conventions

- **TypeScript**: Use type annotations for all function parameters and returns. Prefer `async/await` for asynchronous operations.

---

## 🔒 Security & Environment

### Environment Variables

- **Required Variables**:
  - `GEMINI_SANDBOX` - Controls sandbox environment for integration tests (`false`, `docker`, `podman`)
  - `GEMINI_CONCURRENCY_ENABLED` - Enables/disables concurrent processing
  - `GEMINI_MAX_CONCURRENT_CALLS` - Maximum number of concurrent API calls
  - `GEMINI_FORCE_PROCESSING` - Forces sequential or concurrent processing (`sequential`, `concurrent`)
  - `DEBUG` - Enables debug logging (from `package.json` debug script)

### Security Tools

- **Dependency Scanner**: `npm audit` (implied by `npm` usage)
- **Static Analysis**: Not explicitly configured in `package.json` scripts.

---

## 📝 Documentation Standards

### Required Documentation

- **README.md**: Project overview, setup, usage
- **API Documentation**: Not explicitly generated, but JSDoc/TSDoc comments are likely used in source.
- **Architecture Documentation**: `docs/architecture.md`, `.chorus/implementation_guide.md`
- **Changelog**: Not explicitly maintained as a separate file; `git` history and commit messages serve this purpose.

### Documentation Generation

```bash
# No explicit documentation generation commands found beyond general build.
```

---

## 🚀 Deployment Information

### Build Artifacts

- **Output Directory**: `bundle/` (for main CLI executable), `dist/` (for individual packages)
- **Main Executable**: `bundle/gemini.js`
- **Dependencies**: Bundled within `bundle/` or managed by `node_modules` in `dist/` packages.

### Container Configuration

- **Docker**: Yes
- **Dockerfile Location**: `./Dockerfile`
- **Base Image**: Not explicitly stated in `Dockerfile` content, but typically Node.js base images.

---

## 📊 Performance & Monitoring

### Performance Requirements

- **Memory Limit**: Not explicitly defined.
- **CPU Usage**: Not explicitly defined.
- **Response Time**: Not explicitly defined, but "faster response times" is a core goal of Project Chorus.

### Monitoring & Logging

- **Log Level**: Not explicitly defined in config, but debug logging is available.
- **Log Format**: Not explicitly defined.
- **Metrics**: OpenTelemetry (used for `telemetry` events, e.g., `tool_call`, `concurrent_syntax_detected`).

---

## 🔄 Version Control & CI/CD

### Git Workflow

- **Branching Strategy**: Not explicitly defined, but standard Git practices are assumed.
- **Commit Convention**: Conventional Commits (e.g., `feat:`, `fix:`) as per `implementation_guide.md` example.
- **Required Checks**: `npm run preflight` (lint, typecheck, test:ci, build) must pass before commits.

### CI/CD Pipeline

- **Platform**: Not explicitly stated, but `test:ci` and `lint:ci` scripts suggest a CI environment.
- **Pipeline File**: Not explicitly stated.
- **Deployment Stages**: Not explicitly stated.

---

## 🚨 Critical Notes for AI Modes

### Mandatory Rules

1. **Never modify this file** without explicit user approval.
2. **Always follow the naming conventions** specified above.
3. **Use the exact build/test commands** provided in this document and `build_protocol.md`.
4. **Respect the project structure** - create files in correct directories within `packages/cli/src` or `packages/core/src` as appropriate.
5. **Check environment setup** (`npm install`) before attempting builds or tests.
6. **Adhere to incremental development and rigorous testing** as outlined in `.chorus/implementation_guide.md`.

### Common Pitfalls to Avoid

- Installing dependencies globally instead of using `npm install` locally.
- Using incorrect file or variable naming conventions.
- Ignoring build or test failures.
- Creating files outside the established `packages/` monorepo structure.
- Using outdated dependency versions (ensure `npm install` is run).

---

## 📞 Support & Resources

### Documentation Links

- **Project Repository**: `https://github.com/google-gemini/gemini-cli.git`
- **Issue Tracker**: `.chorus/issue_tracker.md`
- **Wiki/Confluence**: `docs/` folder serves as primary internal documentation.

### Key Personnel

- **Project Owner**: TBD
- **Lead Developer**: TBD
- **DevOps Contact**: TBD

---

## 🔄 Update History

- **2025-07-29** - Project Initializer Mode: Initial project specifics created.
