# babel-plugin-import-directory-plus Test Suite

This folder contains scenario-based tests for the plugin. Each subfolder is a scenario:

- `bare-import-exports/` — bare import with restrictive exports
- `bare-import-main/` — bare import with only main/module
- `bare-import-noexports/` — bare import, no exports field
- `bare-import-subpath/` — bare import of a subpath
- `bare-import-cjs/` — CJS package, named import
- `bare-import-esm/` — ESM package, named import
- `relative-import/` — relative import of a directory
- `relative-import-noexports/` — relative import, no exports
- `should-not-rewrite/` — import that must not be rewritten (e.g. @emotion/react/jsx-runtime)

Each folder contains:
- `input.js` — the code before transformation
- `expected.js` — the code after transformation
- `package.json` — (optional) for simulating package structure/exports

To add a new scenario, create a new folder and add the files above.
