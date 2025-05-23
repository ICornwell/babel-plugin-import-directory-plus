# babel-plugin-import-directory-plus

> **A robust, scenario-aware fork of [babel-plugin-wildcard](https://github.com/babel-utils/babel-plugin-wildcard) and [babel-plugin-import-directory](https://github.com/59naga/babel-plugin-import-directory), with full support for modern Node.js/package.json exports, real-world package structures, and edge-case correctness.**

---

This project is a **heavily refactored, modernized, and scenario-driven fork** of the original [babel-plugin-import-directory](https://github.com/59naga/babel-plugin-import-directory) and [babel-plugin-wildcard](https://github.com/babel-utils/babel-plugin-wildcard). It is designed to handle all the quirks and realities of Node.js module resolution in 2024+, including:

- **Full support for package.json `exports` and subpath exports** (e.g., @mui/material, @emotion/react)
- **Scenario-based import rewriting**: Only rewrites when it is safe and correct, matching Node.js and npm semantics
- **Realistic test fixtures**: All tests use real-world package structures and node_modules layouts
- **Edge-case correctness**: Handles explicit file exports, directory subpaths, and non-exported subpaths with precision
- **Extensive documentation and comments**: Every scenario and code path is explained and justified
- **Thorough unit and scenario tests**: Utilities and rewriters are fully tested, with scenario-driven coverage

## Why this fork exists

The original plugins were great for simple directory imports, but did not handle the full complexity of modern package resolution, especially with the rise of ESM, `exports` fields, and strict subpath rules. This fork:

- Modularizes and documents all logic for maintainability
- Adds scenario detection that matches Node.js behavior (including all edge cases)
- Uses real package structures in tests (e.g., @mui/material/Button, lodash/utils)
- Documents every scenario, with rationale and real-world analogs
- Ensures you never break a package by rewriting an import that shouldn't be rewritten

**If you want a drop-in for the old plugins, but with bulletproof correctness for modern JS, this is it.**

---

## Example Usage

With the following folder structure:

```
|- index.js
|- actions
    |- action.a.js
    |- action_b.js
    |- sub_dir
        |- actionC.js
```

and with the following JS:

```javascript
import actions from './actions';
```

will be compiled to:

```javascript
const _dirImport = {};
import * as _actionA from "./actions/action.a";
import * as _actionB from "./actions/action_b";
_dirImport.actionA = _actionA;
_dirImport.actionB = _actionB;
const actions = _dirImport;
```

---



---

<!--
The original babel-plugin-import-directory and babel-plugin-wildcard supported a non-standard pattern:

```javascript
import actions from './actions/*';
```

which would import all methods from each file directly into the resulting object. This is not valid JavaScript syntax and is not supported by this fork, as it is non-standard and not recognized by Babel or Node.js. Only standard directory imports (with or without `/**`) are supported in babel-plugin-import-directory-plus.
-->

And you can use both, double and single `asterisk`, like this:
```javascript
import actions from './actions/**/*';
```

will be compiled to:

```javascript
const _dirImport = {};
import * as _actionA from "./actions/action.a";
import * as _actionB from "./actions/action_b";
import * as _actionC from "./actions/sub_dir/actionC";
for (let key in _actionA) {
  _dirImport[key === 'default' ? 'actionA' : key] = _actionA[key];
}
for (let key in _actionB) {
  _dirImport[key === 'default' ? 'actionB' : key] = _actionB[key];
}
for (let key in _actionC) {
  _dirImport[key === 'default' ? 'actionC' : key] = _actionC[key];
}
const actions = _dirImport;
```

---

## Usage

Add it to your **.babelrc** file:

```json
{
  "plugins": ["import-directory-plus"]
}
```

---

## Advanced: Scenario-based import rewriting

This plugin is unique in that it:
- Detects the exact scenario for every import (bare, subpath, relative, ESM/CJS, explicit file, etc.)
- Only rewrites imports when it is safe and matches Node.js/module/package.json semantics
- Never rewrites imports that would break due to package.json `exports` or explicit file exports
- Is tested against real-world package structures and edge cases (see `test/test-cases.md`)

See the [test/test-cases.md](./test/test-cases.md) for a full list of scenarios, rationale, and real-world analogs.

---

## Credits & Upstream

- Forked from [babel-plugin-import-directory](https://github.com/59naga/babel-plugin-import-directory) and [babel-plugin-wildcard](https://github.com/babel-utils/babel-plugin-wildcard)
- Modernized, scenario-ized, and tested by [your team]
- See original READMEs for legacy usage and options

---

## Contributing

Contributions welcome! Please see the [test/test-cases.md](./test/test-cases.md) for scenario documentation and rationale. PRs should include scenario-driven tests and clear comments.

## License

MIT (see LICENSE)
