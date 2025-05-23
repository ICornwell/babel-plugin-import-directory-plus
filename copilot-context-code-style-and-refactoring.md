# Copilot Context: Code Style and Refactoring Guidelines

This document describes the preferred code style, refactoring principles, and documentation practices for the `babel-plugin-import-directory-plus` project. It is intended to guide both human contributors and AI assistants (such as GitHub Copilot) to produce code that is readable, maintainable, and easy to reason about, especially in complex or fiddly logic scenarios.

## 1. Problem-First, Intent-Driven Comments
- **Express the problem before the solution.**
  - Use plain-language comments to state the *problem* or *intent* before each major conditional, branch, or return.
  - Example:
    ```js
    // Problem: No import source provided
    if (!src) return { scenario: 'invalid', meta: {} };
    ```
- **Avoid technical jargon in comments unless necessary.**
- **Comments should clarify *why* a branch exists, not just *what* it does.**

## 2. Scenario-Based Logic
- **Detect scenarios up front.**
  - Use a dedicated function (e.g., `detectImportScenario`) to classify the current situation before acting.
  - Return a scenario string and metadata object for clarity.
- **Switch or map on scenario, not on technical details.**
  - This makes the code easier to extend and reason about.

## 3. Separation of Concerns
- **Split code by responsibility, not just by file size.**
  - Utilities for file, path, and package logic go in their own modules.
  - Rewriter logic is separated from scenario detection.
- **Avoid hiding complexity in too many layers.**
  - Prefer visible, linear logic with clear comments over excessive abstraction.

## 4. Readability Over Brevity
- **Prefer clarity to cleverness.**
- **Allow some chunkiness if it preserves visibility of the logic.**
- **Do not split functions further if it would obscure the overall flow.**

## 5. Documentation and JSDoc
- **Every major function should have a JSDoc comment describing its purpose, contract, and rationale.**
- **Modules should have a high-level comment explaining their role in the system.**

## 6. Naming
- **Names should reflect intent and domain, not just implementation.**
- **Scenario names should match test scenario names where possible.**

## 7. When in Doubt
- **Err on the side of more comments and more explicitness.**
- **If a piece of logic is fiddly, make the problem and the reason for the solution visible in the code.**

---

## Example: Scenario Detection (from `rewriteImport.js`)

```js
// Problem: No import source provided
if (!src) return { scenario: 'invalid', meta: {} };

// Problem: Import is already explicit (ends with /index or /index.js)
if (src.endsWith('/index.js') || src.endsWith('/index')) return { scenario: 'already-explicit', meta: {} };

// ...
```

---

## If You Suggest Refactoring
- Only suggest further splitting or abstraction if it will *increase* clarity and maintainability, not just to reduce function size.
- If the logic is inherently complex, prefer to keep it visible and well-commented.

---

## When to Revisit This Style
- If the codebase or requirements change significantly, or if a new contributor finds the style unclear, revisit and update this document.

---

*This style guide is designed to keep complex logic readable and maintainable for humans, not just machines.*
