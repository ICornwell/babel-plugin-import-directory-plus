# Copilot Context: babel-plugin-import-directory-plus

## Purpose

This plugin robustly rewrites directory imports in JavaScript/TypeScript projects to explicit entrypoints (e.g., `/index.js`) in both ESM and CJS modules. It is designed to work safely and automatically with both bare imports (e.g., `import x from 'foo/bar'`) and relative imports (e.g., `import x from './dir'`), especially for codebases and node_modules packages that use modern package.json `exports` fields, subpath exports, and a mix of CJS/ESM interop.

## Intent

- **Automate**: Remove the need for hand-written `index.js` files or manual import rewrites.
- **Safety**: Only rewrite imports when it is safe and allowed by the package's `exports` field or legacy entrypoints.
- **Compatibility**: Support both ESM and CJS, and handle named imports from CJS modules by rewriting to default import + destructure.
- **Performance**: Use in-memory caching for directory and package.json lookups.
- **Configurability**: Allow test suites to override the modules directory (e.g., for scenario-based testing).
- **Debuggability**: Support verbose and force modes for development and debugging.

## Use Cases

- **Node.js projects** using ESM or CJS, especially those consuming packages with restrictive or complex `exports` fields (e.g., `@mui/material`, `chelone-core`).
- **Monorepos** or codebases with many relative directory imports.
- **Automated code migration**: Upgrading code to be compatible with modern Node.js resolution rules.
- **Testing**: Scenario-based test suites that simulate node_modules structure for plugin validation.

## Key Features

- **Rewrites** directory imports (bare or relative) to `/index.js` or the correct entrypoint, but only when:
  - The path is a directory (or test scenario folder).
  - The rewrite is allowed by the package's `exports` field, or `exports` is missing.
  - The import is not a package root (e.g., `import x from 'foo'` is NOT rewritten, but `import x from 'foo/bar'` may be).
- **Handles** modern `exports` fields, subpath imports, and legacy `main`/`module` fields.
- **CJS/ESM interop**: Rewrites named imports from CJS modules to default import + destructure.
- **Marker file**: Writes a `.transpiled-by-copilot-directory-import-fixer` file to avoid redundant rewrites (unless `force` is set).
- **Verbose logging**: Logs all decision points if `verbose` is enabled.
- **Testability**: `modulesDir` option allows the plugin to treat test scenario folders as node_modules for accurate scenario testing.

## Fiddly Exceptions & Caveats

- **Exports field**: If a subpath is present in `exports` (e.g., `"./bar": "./bar/index.js"`), the plugin will NOT rewrite `import x from 'foo/bar'` to `import x from 'foo/bar/index.js'` (to avoid breaking restrictive packages).
- **Subpath logic**: For bare imports, the subpath for `exports` checks is always prefixed with `./` (per Node ESM rules).
- **CJS named imports**: If a CJS module is detected (by extension or lack of `type: module`), named imports are rewritten to a default import and destructured variables.
- **Test mode**: The plugin can be configured (via `modulesDir`) to treat scenario folders as node_modules, so tests are as true-to-life as possible.
- **Marker file**: The plugin writes a marker file in the target directory to avoid re-processing. This can be bypassed with the `force` option.
- **No rewrite for package roots**: Imports like `import x from 'foo'` are never rewritten, only subpaths (e.g., `import x from 'foo/bar'`).
- **Relative imports**: Only rewritten if the target is a directory and not already ending in `/index.js`.
- **Edge cases**: The plugin is defensive—if any file/directory/package.json is missing or unreadable, it skips rewriting.
- **Test suite**: The test suite uses scenario folders with `input.js`, `expected.js`, and (optionally) `package.json` to simulate real-world package structures and edge cases.

## Example Scenarios

- **bare-import-cjs**: CJS package, named import → rewritten to default import + destructure from `/index.js`.
- **bare-import-esm**: ESM package, named import → rewritten to `/index.js` if allowed by exports.
- **bare-import-exports**: Bare import with restrictive exports → only rewritten if allowed.
- **bare-import-main**: Bare import with only `main`/`module` fields.
- **bare-import-noexports**: Bare import, no exports field → rewritten.
- **bare-import-subpath**: Bare import of a subpath.
- **relative-import**: Relative import of a directory.
- **relative-import-noexports**: Relative import, no exports.
- **should-not-rewrite**: Import that must not be rewritten (e.g., `@emotion/react/jsx-runtime`).

## How to Add New Scenarios

1. Create a new folder in `test/`.
2. Add `input.js` (before transformation), `expected.js` (after transformation), and (optionally) `package.json` to simulate the package structure.
3. If the scenario is a directory import, add a dummy `index.js` in the target directory.

## Summary

This plugin is designed to be robust, safe, and highly configurable for both real-world and test environments. It is especially useful for modernizing codebases and ensuring compatibility with evolving Node.js and npm package resolution rules.
