# babel-plugin-import-directory-plus: Test Case Scenarios

This document describes each scenario folder in the `test/` directory, what real-world Node.js/package.json structure it simulates, and why it is a realistic or important case. Where possible, real npm package examples are referenced, with direct file paths and GitHub URLs for further exploration.

---

## 1. `bare-import-exports/`
- **Structure:**
  - `bare-import-exports/package.json` with:
    ```json
    {
      "name": "my-lib",
      "exports": { "./esm": "./esm/index.js" }
    }
    ```
  - `bare-import-exports/esm/index.js`
  - `input.js`: `import { foo } from 'my-lib/esm';`
- **What it simulates:**
  - A package with a restrictive `exports` field, only allowing import of a specific subpath (e.g., `my-lib/esm`).
- **Real-world example:**
  - [`@mui/material`](https://github.com/mui/material-ui/blob/HEAD/packages/mui-material/package.json) ([exports field](https://github.com/mui/material-ui/blob/HEAD/packages/mui-material/package.json#L13-L100)), e.g. `"./Button": "./Button/Button.js"`.
  - [`@emotion/react`](https://github.com/emotion-js/emotion/blob/HEAD/packages/react/package.json) ([exports field](https://github.com/emotion-js/emotion/blob/HEAD/packages/react/package.json#L18-L40)), e.g. `"./jsx-runtime": "./jsx-runtime/dist/emotion-react-jsx-runtime.cjs.js"`.
- **Why important:**
  - Ensures the plugin only rewrites imports when the subpath is explicitly exported and the directory exists, matching Node.js ESM rules.

---

## 2. `bare-import-main/`
- **Structure:**
  - `bare-import-main/package.json` with:
    ```json
    { "name": "main-lib", "main": "./utils/index.js" }
    ```
  - `bare-import-main/utils/index.js`
  - `input.js`: `import { foo } from 'main-lib/utils';`
- **What it simulates:**
  - A package with no `exports` field, only a `main` entrypoint, and a subdirectory import.
- **Real-world example:**
  - [`lodash`](https://github.com/lodash/lodash/blob/HEAD/package.json) ([main field](https://github.com/lodash/lodash/blob/HEAD/package.json#L5)), [`moment`](https://github.com/moment/moment/blob/HEAD/package.json).
- **Why important:**
  - Tests fallback to legacy Node.js resolution for subpaths when `exports` is missing.

---

## 3. `bare-import-noexports/`
- **Structure:**
  - `bare-import-noexports/package.json` with:
    ```json
    { "name": "my-lib" }
    ```
  - `bare-import-noexports/utils/index.js`
  - `input.js`: `import { foo } from 'my-lib/utils';`
- **What it simulates:**
  - A package with no `exports` or `main` field, and a subdirectory import.
- **Real-world example:**
  - Many simple or old packages, or monorepo packages without strict exports. See [npm/cli](https://github.com/npm/cli/tree/HEAD/packages) for monorepo packages with minimal package.json.
- **Why important:**
  - Ensures the plugin allows rewriting when no `exports` field blocks deep imports.

---

## 4. `bare-import-subpath/`
- **Structure:**
  - `bare-import-subpath/package.json` with:
    ```json
    { "name": "subpath-lib", "exports": { "./subdir": "./subdir/index.js" } }
    ```
  - `bare-import-subpath/subdir/index.js`
  - `input.js`: `import { foo } from 'subpath-lib/subdir';`
- **What it simulates:**
  - A package with an `exports` field that explicitly allows a subpath, and the subdirectory exists.
- **Real-world example:**
  - [`@mui/material`](https://github.com/mui/material-ui/blob/HEAD/packages/mui-material/package.json) ([exports field](https://github.com/mui/material-ui/blob/HEAD/packages/mui-material/package.json#L13-L100)), e.g. `"./Button": "./Button/Button.js"`.
- **Why important:**
  - Ensures the plugin only rewrites when the subpath is exported and the directory exists.

---

## 5. `bare-import-cjs/` and `bare-import-esm/`
- **Structure:**
  - CJS: `bare-import-cjs/package.json` with `main`, and `utils/index.js`.
  - ESM: `bare-import-esm/package.json` with `type: "module"`, `exports`, and `utils/index.js`.
- **What it simulates:**
  - CJS: Named import from a CJS package (should be rewritten to default import + destructure).
  - ESM: Named import from an ESM package (should be left as-is if allowed by exports).
- **Real-world example:**
  - CJS: [`lodash`](https://github.com/lodash/lodash/blob/HEAD/package.json), [`chalk`](https://github.com/chalk/chalk/blob/HEAD/package.json) (pre-ESM versions).
  - ESM: [`@mui/x-date-pickers`](https://github.com/mui/mui-x/blob/HEAD/packages/x-date-pickers/package.json) ([type: module](https://github.com/mui/mui-x/blob/HEAD/packages/x-date-pickers/package.json#L5), [exports](https://github.com/mui/mui-x/blob/HEAD/packages/x-date-pickers/package.json#L13-L50)).
- **Why important:**
  - Tests CJS/ESM interop and correct handling of named imports.

---

## 6. `relative-import/` and `relative-import-noexports/`
- **Structure:**
  - Both have a `utils/index.js` and a `package.json` (with or without exports).
  - `input.js`: `import { foo } from './utils';`
- **What it simulates:**
  - Importing a directory via a relative path, with or without a package.json.
- **Real-world example:**
  - Local imports in monorepos or apps, e.g., [`mui/material-ui/packages/mui-material/src`](https://github.com/mui/material-ui/tree/HEAD/packages/mui-material/src) or [`emotion-js/emotion/packages`](https://github.com/emotion-js/emotion/tree/HEAD/packages).
- **Why important:**
  - Ensures the plugin rewrites relative directory imports to explicit entrypoints.

---

## 7. `should-not-rewrite/`
- **Structure:**
  - `should-not-rewrite/package.json` with:
    ```json
    {
      "name": "@emotion/react",
      "exports": {
        ".": "./dist/emotion-react.cjs.js",
        "./jsx-runtime": "./jsx-runtime/dist/emotion-react-jsx-runtime.cjs.js"
      }
    }
    ```
  - `input.js`: `import _jsx from '@emotion/react/jsx-runtime';`
- **What it simulates:**
  - A package with a restrictive `exports` field, only allowing certain subpaths (e.g., `@emotion/react/jsx-runtime`).
  - The import matches an explicit subpath export that points to a file, not a directory.
- **Real-world example:**
  - [`@emotion/react`](https://github.com/emotion-js/emotion/blob/HEAD/packages/react/package.json) ([exports field](https://github.com/emotion-js/emotion/blob/HEAD/packages/react/package.json#L18-L40)), [`@mui/material`](https://github.com/mui/material-ui/blob/HEAD/packages/mui-material/package.json).
- **Why important:**
  - Ensures the plugin does NOT rewrite imports that are already explicit subpath exports pointing to files, even if a directory of the same name exists.
  - Matches Node.js ESM semantics for explicit subpath exports.

---

# Notes
- These scenarios are based on real-world package structures and Node.js resolution rules as seen in popular packages like [`@mui/material`](https://github.com/mui/material-ui/blob/HEAD/packages/mui-material/package.json), [`@emotion/react`](https://github.com/emotion-js/emotion/blob/HEAD/packages/react/package.json), and others.
- As Node.js and npm evolve, more edge cases may arise, but these cover the most common and important patterns in the ecosystem today.
- The plugin now explicitly distinguishes between subpath directory imports, explicit subpath file exports, and cases where no rewrite should occur, ensuring robust and standards-compliant behavior.
