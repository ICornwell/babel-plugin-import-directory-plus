# Copilot Debugging Context: Best Practices for Complex Plugins

## When to Add Tests and Refactor
- As soon as you see branching logic (e.g., `if package.json has xyz`), complexity multiplies—add scenario-driven tests immediately.
- Refactor for clarity and modularity before the codebase grows too complex to reason about.
- Use realistic, end-to-end fixtures (e.g., real `node_modules` structure, real `package.json` files) for plugins that simulate Node.js resolution.

## Static vs Dynamic Analysis
- **Static analysis (SAST)** is powerful, but for file-system or environment-dependent code, you need runtime values.
- **Dynamic analysis (DAST)**: Step through code, log or inspect key variables at decision points, and codify findings in tests.
- Ask the developer to step through and report variable values at key lines—this is invaluable for DAST, especially for plugins that depend on the filesystem or package.json state.

## Test Harness Best Practices
- Suppress marker logic and force rewrites in tests for deterministic, repeatable results (e.g., `noMarks: true`, `force: true`).
- Normalize output (e.g., quote style) before comparing in tests.
- Each scenario folder should:
  - Contain only up-to-date `input.js` and `expected.js` (and optionally a `package.json` for the test harness).
  - Simulate real-world structure (e.g., `node_modules/pkg/utils/index.js`).
  - Have both positive and negative (or variant) cases for each scenario.

## Debugging and Refactoring Tips
- When you hit a “complexity multiplier,” immediately add/expand tests and refactor for readability.
- Don’t hesitate to ask for runtime values at key lines—this is essential for debugging dynamic logic.
- Use debug logs or breakpoints at scenario detection and rewrite points.
- Review for any remaining “complexity multipliers” that could use more tests or refactoring.

## Checklist for Scenario-Driven Plugin Development
- [ ] Add/expand scenario-driven tests for each branch of logic.
- [ ] Refactor for modularity and clarity as soon as complexity increases.
- [ ] Use realistic fixtures and directory structures.
- [ ] Suppress non-deterministic logic (markers, caches) in tests.
- [ ] Normalize output for robust test comparisons.
- [ ] Ask for help and runtime values when static analysis isn’t enough.

---

*Use this file as a reference for future Copilot debugging and plugin development sessions!*
