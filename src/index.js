// babel-plugin-import-directory-plus
// Main plugin entrypoint: orchestrates context setup, delegates to rewriter utilities, and manages plugin lifecycle.
//
// Purpose:
//   - Provide a robust, testable Babel plugin for rewriting directory imports to explicit entrypoints.
//   - Ensure compatibility with ESM/CJS, package exports, and modern Node.js resolution rules.
//   - Centralize context, caching, and configuration for all rewriter utilities.
//
// Division of Labour:
//   - This file: Orchestrates plugin lifecycle, context, and delegates to rewriters.
//   - fileUtil.js: Low-level file and path utilities.
//   - markersAndCacheUtils.js: Marker file logic and in-memory caching.
//   - packageUtils.js: Package.json, entrypoint, and ESM/CJS logic (context-aware).
//   - rewriters/: Pure rewriter functions for import and CJS named import transformations.

'use strict';
const path = require('path');
const fs = require('fs');
const template = require('@babel/template').default;
const fileUtil = require('./fileUtil');
const markersAndCacheUtils = require('./markersAndCacheUtils');
const rewriteImport = require('./rewriters/rewriteImport');
const rewriteCjsNamedImports = require('./rewriters/rewriteCjsNamedImports');

const MARKER_FILE = '.transpiled-by-copilot-directory-import-fixer';

// Destructure core file utilities
const { isDirectory, isFile, readJSON, safeJoin } = fileUtil;
const { hasMarkerFile, writeMarkerFile } = markersAndCacheUtils;
const { getConfiguredPackageUtils } = require('./packageUtils');

// Setup in-memory caches for directory and package.json lookups
const getCaches = () => {
  const dirCache = markersAndCacheUtils.createDirCache(isDirectory);
  const pkgCache = markersAndCacheUtils.createPkgCache(readJSON);
  return { getCachedDir: dirCache.getCachedDir, getCachedPkg: pkgCache.getCachedPkg };
};

// Verbose logging utility, context-aware
function verboseLog(msg, state) {
  if (state.opts && (state.opts.verbose || process.env.BABEL_PLUGIN_IMPORT_DIRECTORY_VERBOSE)) {
    // eslint-disable-next-line no-console
    console.log('[babel-plugin-import-directory]', msg);
  }
}

// Main Babel plugin export
module.exports = function importDirectoryPlugin(babel) {
  const t = babel.types;
  return {
    name: 'import-directory-plus',
    pre(state) {
      // Allow modulesDir override for testability and scenario-based testing
      this.modulesDir = (state.opts && state.opts.modulesDir) || 'node_modules';
    },
    visitor: {
      // Handles all import declarations in the AST
      ImportDeclaration(path, state) {
        // Patch safeJoin to respect modulesDir override for test scenarios
        const modulesDir = (state.opts && state.opts.modulesDir) || this.modulesDir || 'node_modules';
        const origSafeJoin = safeJoin;
        const patchedSafeJoin = (...args) => {
          if (args[0] === 'node_modules') args[0] = modulesDir;
          return origSafeJoin(...args);
        };
        // Setup context for rewriters: caches, package utils, and utilities
        const { getCachedDir, getCachedPkg } = getCaches();
        const packageUtils = getConfiguredPackageUtils(state, verboseLog);
        // ---
        // First, rewrite the import path if needed (directory → explicit entrypoint)
        const origSource = path.node.source.value;
        rewriteImport(path.node, state, t, {
          getCachedDir,
          getCachedPkg,
          packageUtils,
          safeJoin: patchedSafeJoin,
          hasMarkerFile,
          writeMarkerFile,
          verboseLog
        });
        // If the import path was rewritten, or is a directory import, handle CJS named imports
        const newSource = path.node.source.value;
        if (newSource !== origSource || /\/index\.js$/.test(newSource)) {
          rewriteCjsNamedImports(path, t, state, {
            getCachedDir,
            getCachedPkg,
            packageUtils,
            safeJoin: patchedSafeJoin,
            verboseLog
          });
        }
      },
    },
  };
};