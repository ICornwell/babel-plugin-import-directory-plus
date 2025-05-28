# bare-import-exports-not-allowed

This scenario tests that the plugin does NOT rewrite a directory import if neither the original subpath nor the rewritten subpath is present in the package's exports field.

- If you import from 'mui-lib/utils', but only './node/utils/index.js' is exported, the plugin must leave the import as-is.
- This prevents runtime errors and matches Node.js ESM resolution rules.
