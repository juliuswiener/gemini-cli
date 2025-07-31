# Coding Guidelines and Conventions
This document outlines the coding style, best practices, and conventions to be followed by all developers contributing to this project. Adherence to these guidelines ensures code consistency, readability, maintainability, and facilitates collaborative development.
### 1. General Principles
* **Readability First:** Code should be easy to read and understand by other developers. Prioritize clarity over cleverness.
* **Consistency:** Maintain a consistent style throughout the codebase. If a pattern or convention already exists in a file, follow it.
* **Modularity:** Design code in small, focused modules or functions with clear responsibilities.
* **Traceability:** Ensure code can be easily traced back to its corresponding tasks, user stories, and architectural decisions.
* **Defensive Programming:** Anticipate potential errors and handle them gracefully.
* **DRY (Don't Repeat Yourself):** Avoid duplicating code. Abstract common logic into reusable functions or modules.
### 2. Naming Conventions
Consistent naming is crucial for code readability and understanding.
* **Variables & Functions:**
    * Use `snake_case` (lowercase with underscores) for variable and function names.
    * Names should be descriptive and reflect their purpose.
    * *Examples:* `user_name`, `calculate_total_cost`, `process_file_data`.
* **Classes:**
    * Use `PascalCase` (CamelCase with first letter capitalized) for class names.
    * Names should be nouns or noun phrases.
    * *Examples:* `ImageConverter`, `ConversionError`, `CliInterface`.
* **Constants:**
    * Use `ALL_CAPS_SNAKE_CASE` for global constants.
    * *Examples:* `MAX_FILE_SIZE_MB`, `DEFAULT_OUTPUT_FORMAT`.
* **Private/Internal Members:**
    * Prefix internal-use functions or variables (not part of the public API of a module/class) with a single underscore (`_`).
    * *Examples:* `_validate_input`, `_process_chunk`.
* **Modules/Files:**
    * Use `snake_case` for module (file) names.
    * *Examples:* `image_converter.py`, `cli_interface.py`, `utils.py`.
### 3. Code Formatting
* **Indentation:** Use 4 spaces for indentation. **Never use tabs.**
* **Line Length:** Limit lines to a maximum of 120 characters to maintain readability on various screens. Break long lines logically.
* **Blank Lines:**
    * Use two blank lines to separate top-level function and class definitions.
    * Use one blank line to separate methods within a class.
    * Use blank lines sparingly within functions to indicate logical sections.
* **Imports:**
    * Imports should generally be at the top of the file.
    * Group imports: standard library, third-party, local project modules.
    * Sort alphabetically within each group.
    * *Example:*
        ```python
        import os
        import sys
        import click
        from PIL import Image
        from . import utils
        from .core_converter import convert_file
        ```
* **Whitespace:**
    * Avoid superfluous whitespace (e.g., `foo = bar + 1` not `foo = bar + 1 `).
    * Use single spaces around operators (`=`, `+`, `-`, `*`, `/`, `==`, `!=`, etc.).
    * No space immediately inside parentheses, brackets, or braces.
### 4. Comments and Documentation
* **Purpose:** Comments should explain *why* something is done, not *what* is done (unless the "what" is not obvious from the code itself).
* **Docstrings:**
    * All modules, classes, and public functions/methods **must** have docstrings.
    * Use triple double quotes (`"""Docstring content"""`).
    * Follow a consistent format (e.g., reStructuredText, Google style, or NumPy style).
* **Inline Comments:** Use sparingly for complex logic or workarounds. Place them on a separate line above the code they refer to, starting with `#`.
* **Commit Messages:** Write clear, concise, and descriptive commit messages. Follow a conventional commit style if possible (e.g., `feat: Add WebP conversion support`).
### 5. Error Handling
* **Specific Exceptions:** Raise specific, custom exception types where appropriate (e.g., `ConversionError`, `InvalidInputError`) instead of generic `Exception`.
* **Catch Specific Exceptions:** When handling errors, catch specific exceptions rather than broad ones.
* **Informative Messages:** Ensure error messages are clear, user-friendly, and provide enough context for debugging.
* **Logging:** Use the project's standardized logging mechanism (`utils.configure_logging()`) for all errors, warnings, and important debugging information.
### 6. Testing
* **Unit Tests:** Every new feature or bug fix **must** be accompanied by comprehensive unit tests.
* **Test Location:** Tests should reside in a `tests/` directory, mirroring the structure of the `src/` directory.
* **Test Naming:** Test files should be named `test_*.py` and test functions `test_*`.
* **Coverage:** Strive for high test coverage, particularly for core logic and critical paths.
### 7. Version Control (Git)
* **Branching Strategy:** Follow the project's defined branching strategy (e.g., GitFlow, GitHub Flow).
* **Small, Atomic Commits:** Make frequent, small commits that represent a single logical change.
* **Pull Requests (PRs):** All code changes **must** go through a PR process, including code review.
* **Rebasing/Merging:** Follow the team's preference for rebasing vs. merging for integrating branches.
By adhering to these guidelines, you will contribute to a codebase that is a joy to work with, ensuring the long-term success and maintainability of our project.