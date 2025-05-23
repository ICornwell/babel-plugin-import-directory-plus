// packageUtils.js
// Context-aware package and import-related utilities for babel-plugin-import-directory-plus
//
// Purpose:
//   - Provide robust, context-aware utilities for resolving package entrypoints, import types, and ESM/CJS interop.
//   - Centralize logic for handling package.json, exports fields, and Node.js module resolution rules.
//   - Support scenario-based testing and plugin configuration by accepting state and logging context.
//
// Division of Labour:
//   - getConfiguredPackageUtils: Factory that returns all package utilities, bound to the current plugin state and logger.
//   - getPackageJson, getEntrypoint: Resolve package.json location and entrypoint for a given directory/subpath.
//   - isBareImport, isRelativeImport: Classify import types for transformation logic.
//   - resolveEntrypoint: Compute the correct entrypoint for a package subpath, using cache/context.
//   - isAllowedByExports: Check if a rewrite is allowed by the package's exports field, with debug logging.
//   - isCjsModule: Heuristically determine if a file is a CommonJS module, supporting safe interop.
//   - This module is used by the main plugin entrypoint and rewriter utilities to encapsulate all package-related logic.

const path = require('path');
const fileUtil = require('./fileUtil');

function getConfiguredPackageUtils(state, verboseLog) {
  /**
   * Returns the absolute path to the nearest package.json for a given directory.
   * Purpose: Abstracts package.json location logic for use in entrypoint and module resolution.
   */
  function getPackageJson(dir) {
    return fileUtil.getPackageJson(dir);
  }

  /**
   * Determines the entrypoint for a given package.json and subpath.
   * Purpose: Implements Node.js and npm logic for resolving exports, module, and main fields.
   */
  function getEntrypoint(pkgJson, subpath) {
    // For subpaths, try exports, then module, then main, then index.js
    if (pkgJson && typeof pkgJson === 'object') {
      if (pkgJson.exports && typeof pkgJson.exports === 'object') {
        if (pkgJson.exports[subpath]) {
          if (typeof pkgJson.exports[subpath] === 'string') return pkgJson.exports[subpath];
          if (pkgJson.exports[subpath] && typeof pkgJson.exports[subpath] === 'object') {
            if (typeof pkgJson.exports[subpath].import === 'string') return pkgJson.exports[subpath].import;
            if (typeof pkgJson.exports[subpath].default === 'string') return pkgJson.exports[subpath].default;
          }
        }
      }
      if (typeof pkgJson.module === 'string') return pkgJson.module;
      if (typeof pkgJson.main === 'string') return pkgJson.main;
    }
    return 'index.js';
  }

  /**
   * Returns true if the import source is a bare import (not relative or absolute).
   * Purpose: Used to distinguish between package and file/directory imports for transformation logic.
   */
  function isBareImport(src) {
    // Only treat as bare import if src is a non-empty string and not relative/absolute
    return typeof src === 'string' && src.length > 0 && !src.startsWith('.') && !src.startsWith('/');
  }

  /**
   * Returns true if the import source is a relative or absolute import.
   * Purpose: Used to distinguish between file/directory and package imports for transformation logic.
   */
  function isRelativeImport(src) {
    // Only treat as relative import if src is a non-empty string and starts with . or /
    return typeof src === 'string' && src.length > 0 && (src.startsWith('.') || src.startsWith('/'));
  }

  /**
   * Resolves the entrypoint path for a given directory and subpath using cache/context.
   * Purpose: Centralizes entrypoint resolution logic for both bare and relative imports, supporting testability and performance.
   */
  function resolveEntrypoint(dir, subpath, getCachedPkg, getEntrypointFn) {
    // getCachedPkg and getEntrypointFn are injected for cache/context
    const pkgPath = getPackageJson(dir);
    if (!pkgPath || typeof pkgPath !== 'string') return path.join(dir, 'index.js');
    const pkgJson = getCachedPkg(pkgPath);
    const entry = getEntrypointFn(pkgJson, subpath);
    if (typeof entry !== 'string') return path.join(dir, 'index.js');
    return path.join(path.dirname(pkgPath), subpath, entry);
  }

  /**
   * Checks if a rewrite is allowed by the package's exports field, with debug logging.
   * Purpose: Ensures safe and standards-compliant rewrites, avoiding breaking restrictive packages.
   */
  function isAllowedByExports(pkgJson, subpath) {
    // If no exports field, allow
    if (!pkgJson || typeof pkgJson !== 'object' || !pkgJson.exports) {
      if (verboseLog) verboseLog(`[DEBUG] No exports field, allowing rewrite for subpath: '${subpath}'`, state);
      return true;
    }
    if (typeof pkgJson.exports === 'object') {
      // Only allow if the subpath is an exact key in exports (with or without /index.js)
      if (Object.prototype.hasOwnProperty.call(pkgJson.exports, subpath)) {
        if (verboseLog) verboseLog(`[DEBUG] Exports allows subpath: '${subpath}'`, state);
        return true;
      }
      if (subpath.endsWith('/index.js')) {
        const alt = subpath.replace(/\/index\.js$/, '');
        if (Object.prototype.hasOwnProperty.call(pkgJson.exports, alt)) {
          if (verboseLog) verboseLog(`[DEBUG] Exports allows alt subpath: '${alt}'`, state);
          return true;
        }
      } else if (subpath + '/index.js' in pkgJson.exports) {
        if (verboseLog) verboseLog(`[DEBUG] Exports allows subpath with /index.js: '${subpath}/index.js'`, state);
        return true;
      }
      if (verboseLog) verboseLog(`[DEBUG] Exports does NOT allow subpath: '${subpath}' (exports: ${JSON.stringify(pkgJson.exports)})`, state);
      return false;
    }
    if (verboseLog) verboseLog(`[DEBUG] Exports field is not an object, blocking rewrite for subpath: '${subpath}'`, state);
    return false;
  }

  /**
   * Heuristically determines if a file is a CommonJS module, supporting safe interop.
   * Purpose: Enables correct transformation of named imports from CJS modules to default import + destructure.
   */
  function isCjsModule(entryPath, getPackageJsonFn, getCachedPkg) {
    // Heuristic: .cjs or .js with no "type": "module" in package.json
    if (entryPath.endsWith('.cjs')) return true;
    if (entryPath.endsWith('.js')) {
      const pkgPath = getPackageJsonFn(path.dirname(entryPath));
      if (!pkgPath) return true;
      const pkgJson = getCachedPkg(pkgPath);
      // Treat as CJS if no 'type: module' (for test scenarios, always treat as CJS if no type)
      if (!pkgJson || pkgJson.type !== 'module') return true;
      return false;
    }
    return false;
  }

  return {
    getPackageJson,
    getEntrypoint,
    isBareImport,
    isRelativeImport,
    resolveEntrypoint,
    isAllowedByExports,
    isCjsModule,
  };
}

module.exports = { getConfiguredPackageUtils };
