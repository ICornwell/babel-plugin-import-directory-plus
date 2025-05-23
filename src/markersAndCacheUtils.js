// markersAndCacheUtils.js
// Marker file and cache utilities for babel-plugin-import-directory-plus
//
// Purpose:
//   - Provide robust, reusable utilities for marker file management and in-memory caching of directory and package.json lookups.
//   - Support plugin performance, idempotency, and testability by centralizing stateful logic.
//
// Division of Labour:
//   - Marker file logic (hasMarkerFile, writeMarkerFile): Ensures imports are only rewritten once per directory unless forced, supporting idempotent transformations and test scenarios.
//   - Caching (createDirCache, createPkgCache): Provides fast, in-memory lookup for directory and package.json existence/content, reducing filesystem overhead and supporting scenario-based testing.
//   - This module is used by the main plugin entrypoint (src/index.js) and rewriter utilities to coordinate stateful operations.

const path = require('path');
const fs = require('fs');

const MARKER_FILE = '.transpiled-by-copilot-directory-import-fixer';

function hasMarkerFile(dir, state, isFile) {
  // If force is set, always return false (ignore marker file)
  if (state && state.opts && state.opts.force) return false;
  return isFile(path.join(dir, MARKER_FILE));
}

function writeMarkerFile(dir, state) {
  // If force is set, do not write marker file
  if (state && state.opts && (state.opts.force || state.opts.noMarks)) return;
  try {
    fs.writeFileSync(path.join(dir, MARKER_FILE), '');
  } catch {}
}

function createDirCache(isDirectory) {
  // Returns an object with a getCachedDir method and the underlying cache map.
  // Used to memoize directory existence checks for performance and test isolation.
  const _dirCache = new Map();
  return {
    getCachedDir(p) {
      if (!_dirCache.has(p)) {
        _dirCache.set(p, isDirectory(p));
      }
      return _dirCache.get(p);
    },
    _dirCache,
  };
}

function createPkgCache(readJSON) {
  // Returns an object with a getCachedPkg method and the underlying cache map.
  // Used to memoize package.json content for performance and test isolation.
  const _pkgCache = new Map();
  return {
    getCachedPkg(p) {
      if (!_pkgCache.has(p)) {
        _pkgCache.set(p, readJSON(p));
      }
      return _pkgCache.get(p);
    },
    _pkgCache,
  };
}

const markersAndCacheUtils = {
  MARKER_FILE,
  hasMarkerFile,
  writeMarkerFile,
  createDirCache,
  createPkgCache,
};

module.exports = markersAndCacheUtils;
