# Rewriters Folder

This folder contains the core rewriter utilities for `babel-plugin-import-directory-plus`.

## Purpose

The rewriters encapsulate the logic for transforming import statements in JavaScript/TypeScript code, with a focus on:
- Modernizing directory imports to explicit entrypoints (e.g., `/index.js`)
- Ensuring compatibility with both ESM and CJS modules
- Handling edge cases and package `exports` fields robustly
- Supporting automated code migration and Babel plugin scenarios

## Modules

- **rewriteImport.js**
  - Rewrites bare or relative directory imports to explicit entrypoints when safe and appropriate.
  - Skips rewriting if the import is already explicit, unsafe, or blocked by package `exports`.
  - Designed for robust, testable, and scenario-driven transformation.

- **rewriteCjsNamedImports.js**
  - Rewrites named imports from CommonJS modules to a default import plus destructured variables.
  - Ensures compatibility with CJS modules in ESM-aware environments.
  - Only rewrites when the target is a CJS module and named imports are present.

## Usage

These modules are intended to be used by the main plugin entrypoint (`src/index.js`). Each rewriter is a pure function that receives all required context and utilities as arguments, making them easy to test and extend.

## Philosophy

- **Separation of Concerns:** Each rewriter handles a single transformation responsibility.
- **Explicit Context:** All dependencies (caches, utilities, logging) are passed as arguments.
- **Defensive & Robust:** Designed to avoid unsafe rewrites and handle edge cases gracefully.

---

For more details, see the JSDoc comments in each module.
