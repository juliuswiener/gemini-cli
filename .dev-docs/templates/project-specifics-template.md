# Project Specifics: [Project Name]

---

## Metadata

- **Date**: [YYYY-MM-DD]
- **Version**: [e.g., 1.0.0]
- **Filled By**: Project Initializer Mode
- **Last Updated**: [YYYY-MM-DD HH:MM]

---

## 📐 Programming Guidelines & Project Context

This document contains project-specific information that is critical for all AI modes to understand when working on this codebase. It serves as the single source of truth for technical context, build instructions, and development environment details.

---

## 🖥️ System Information

### Operating System

- **Primary OS**: [e.g., Ubuntu 22.04 LTS]
- **Supported OS**: [e.g., Linux, macOS, Windows 10+]
- **Architecture**: [e.g., x86_64, ARM64]

### Runtime Environment

- **Primary Language**: [e.g., Python 3.11+]
- **Package Manager**: [e.g., pip, npm, cargo]
- **Virtual Environment**: [e.g., venv, conda, poetry]

---

## 📦 Dependencies & Versions

### Core Dependencies

- **[Framework/Library Name]**: [Version] - [Purpose]
  - Example: **FastAPI**: 0.104.1 - Web API framework
  - Example: **SQLAlchemy**: 2.0.23 - Database ORM
  - Example: **Pytest**: 7.4.3 - Testing framework

### Development Dependencies

- **[Tool Name]**: [Version] - [Purpose]
  - Example: **Black**: 23.10.1 - Code formatter
  - Example: **Flake8**: 6.1.0 - Code linter
  - Example: **MyPy**: 1.6.1 - Type checker

### System Dependencies

- **[System Package]**: [Version] - [Purpose]
  - Example: **PostgreSQL**: 15+ - Primary database
  - Example: **Redis**: 7.0+ - Caching layer
  - Example: **Docker**: 24.0+ - Containerization

---

## 🏗️ Project Structure (Mandatory)

```plaintext
/project-root
├── controllers/         # Receives input, delegates to services, forwards to views
├── services/            # Stateless business logic, data access, external APIs
├── utils/               # Pure helper functions with no side effects or state
├── views/               # Output rendering: CLI, API responses, templates
├── config/              # Static configuration: env, secrets, constants
├── tests/               # Mirrors structure for unit/integration tests
├── docs/
│   ├── DevDocs/         # Internal docs: decisions, architecture, iterations
│   ├── UserDocs/        # External-facing docs: setup, usage, public API
│   └── Resources/       # Linked/embedded references: specs, papers, diagrams
└── README.md            # Project overview, structure, setup, conventions
```

**Directory Status:**

- [ ] controllers/ - [Created/Missing]
- [ ] services/ - [Created/Missing]
- [ ] utils/ - [Created/Missing]
- [ ] views/ - [Created/Missing]
- [ ] config/ - [Created/Missing]
- [ ] tests/ - [Created/Missing]

---

## 🔧 Build & Compilation Instructions

### Environment Setup

```bash
# Example for Python projects
python -m venv .venv
source .venv/bin/activate  # Linux/macOS
# .venv\Scripts\activate   # Windows

pip install -r requirements.txt
pip install -r requirements-dev.txt
```

### Build Commands

```bash
# Main build command
[e.g., make build, npm run build, cargo build --release]

# Development build
[e.g., make dev, npm run dev, cargo build]

# Clean build
[e.g., make clean, npm run clean, cargo clean]
```

### Configuration Files

- **Build Config**: [e.g., Makefile, package.json, Cargo.toml, pyproject.toml]
- **Environment Config**: [e.g., .env.example, config.yaml, settings.ini]

---

## 🧪 Testing Instructions

### Unit Tests

```bash
# Command to run all unit tests
[e.g., pytest tests/unit/, npm test, cargo test]

# Command to run specific test file
[e.g., pytest tests/unit/test_services.py, npm test -- --testPathPattern=services]

# Command to run tests with coverage
[e.g., pytest --cov=src tests/, npm run test:coverage]
```

### Integration Tests

```bash
# Command to run integration tests
[e.g., pytest tests/integration/, npm run test:integration]

# Command to run end-to-end tests
[e.g., pytest tests/e2e/, npm run test:e2e]
```

### Test Configuration

- **Test Framework**: [e.g., pytest, jest, cargo test]
- **Coverage Tool**: [e.g., pytest-cov, istanbul, tarpaulin]
- **Test Database**: [e.g., PostgreSQL test instance, SQLite in-memory]

---

## 🎯 Development Lifecycle Standards

### Code Quality Tools

- **Formatter**: [e.g., black, prettier, rustfmt]
  - Command: `[e.g., black src/, npm run format, cargo fmt]`
- **Linter**: [e.g., flake8, eslint, clippy]
  - Command: `[e.g., flake8 src/, npm run lint, cargo clippy]`
- **Type Checker**: [e.g., mypy, typescript, built-in]
  - Command: `[e.g., mypy src/, npm run type-check, cargo check]`

### Pre-commit Hooks

- **Enabled**: [Yes/No]
- **Configuration**: [e.g., .pre-commit-config.yaml, husky]
- **Hooks**: [e.g., black, flake8, mypy, tests]

---

## 📋 Naming Conventions (Enforced)

| Element     | Convention         | Example                |
| ----------- | ------------------ | ---------------------- |
| Functions   | `snake_case`       | `get_user_data()`      |
| Variables   | `snake_case`       | `user_email`           |
| Files       | `snake_case.ext`   | `user_service.py`      |
| Classes     | `PascalCase`       | `UserService`          |
| Constants   | `UPPER_SNAKE_CASE` | `MAX_RETRY_LIMIT`      |
| Directories | `lowercase`        | `controllers`, `utils` |

### Language-Specific Conventions

- **[Language]**: [Additional conventions specific to the programming language]
  - Example: **Python**: Use type hints for all function parameters and returns
  - Example: **JavaScript**: Use camelCase for variables, PascalCase for constructors
  - Example: **Rust**: Use snake_case for variables and functions, PascalCase for types

---

## 🔒 Security & Environment

### Environment Variables

- **Required Variables**:
  - `[VAR_NAME]` - [Description]
  - Example: `DATABASE_URL` - PostgreSQL connection string
  - Example: `JWT_SECRET` - Secret key for JWT token signing

### Security Tools

- **Dependency Scanner**: [e.g., safety, npm audit, cargo audit]
  - Command: `[e.g., safety check, npm audit, cargo audit]`
- **Static Analysis**: [e.g., bandit, sonarqube, semgrep]
  - Command: `[e.g., bandit -r src/, npm run security-scan]`

---

## 📝 Documentation Standards

### Required Documentation

- **README.md**: Project overview, setup, usage
- **API Documentation**: [e.g., OpenAPI/Swagger, JSDoc, rustdoc]
- **Architecture Documentation**: High-level system design
- **Changelog**: Version history and changes

### Documentation Generation

```bash
# Generate API docs
[e.g., sphinx-build docs/ docs/_build/, npm run docs, cargo doc]

# Serve docs locally
[e.g., python -m http.server -d docs/_build/, npm run docs:serve]
```

---

## 🚀 Deployment Information

### Build Artifacts

- **Output Directory**: [e.g., dist/, build/, target/release/]
- **Main Executable**: [e.g., main.py, index.js, binary-name]
- **Dependencies**: [e.g., requirements.txt bundled, node_modules excluded]

### Container Configuration

- **Docker**: [Yes/No]
- **Dockerfile Location**: [e.g., ./Dockerfile, ./docker/Dockerfile]
- **Base Image**: [e.g., python:3.11-slim, node:18-alpine]

---

## 📊 Performance & Monitoring

### Performance Requirements

- **Memory Limit**: [e.g., 512MB typical, 1GB max]
- **CPU Usage**: [e.g., Single-threaded, multi-core capable]
- **Response Time**: [e.g., <200ms for API calls, <5s for batch operations]

### Monitoring & Logging

- **Log Level**: [e.g., INFO in production, DEBUG in development]
- **Log Format**: [e.g., JSON structured, plain text]
- **Metrics**: [e.g., Prometheus, application-specific metrics]

---

## 🔄 Version Control & CI/CD

### Git Workflow

- **Branching Strategy**: [e.g., Git Flow, GitHub Flow, trunk-based]
- **Commit Convention**: [e.g., Conventional Commits, semantic commits]
- **Required Checks**: [e.g., tests pass, linting clean, security scan]

### CI/CD Pipeline

- **Platform**: [e.g., GitHub Actions, GitLab CI, Jenkins]
- **Pipeline File**: [e.g., .github/workflows/ci.yml, .gitlab-ci.yml, Jenkinsfile]
- **Deployment Stages**: [e.g., test → staging → production]

---

## 🚨 Critical Notes for AI Modes

### Mandatory Rules

1. **Never modify this file** without explicit user approval
2. **Always follow the naming conventions** specified above
3. **Use the exact build/test commands** provided in this document
4. **Respect the project structure** - create files in correct directories
5. **Check environment setup** before attempting builds or tests

### Common Pitfalls to Avoid

- [ ] Installing dependencies globally instead of in virtual environment
- [ ] Using incorrect file naming conventions
- [ ] Ignoring build failures and proceeding with broken code
- [ ] Creating files outside the mandated project structure
- [ ] Using outdated dependency versions

---

## 📞 Support & Resources

### Documentation Links

- **Project Repository**: [e.g., https://github.com/org/project]
- **Issue Tracker**: [e.g., GitHub Issues, Jira, etc.]
- **Wiki/Confluence**: [Internal documentation links]

### Key Personnel

- **Project Owner**: [Name/Role]
- **Lead Developer**: [Name/Role]
- **DevOps Contact**: [Name/Role]

---

## 🔄 Update History

- **[YYYY-MM-DD]** - Project Initializer Mode: Initial project specifics created
- **[YYYY-MM-DD]** - [Mode/Person]: [Description of changes]
