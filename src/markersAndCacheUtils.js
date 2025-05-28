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
const { isFile } = require('./fileUtil')

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
  } catch { }
}

function cleanFileName(fileName) {
  // Clean up the file name to ensure it is a valid path
  return fileName.replace(/[^@a-zA-Z0-9_\-.]/g, '_');
}

function getMarkerFilePathForFile(targetFile, src) {
  // Place marker in the same directory as the rewritten file, named after the file
  const dir = path.dirname(targetFile);
  const base = cleanFileName(`${path.basename(targetFile)}-${src}`);
  return path.join(dir, `.transpile-imports-rewritten.${base}`);
}

function hasMarkerFileForFile(state, src) {
  if (state && state.opts && state.opts.force) return false;
  if (!state.file || !state.file.opts || !state.file.opts.filename) return false;
  return isFile(getMarkerFilePathForFile(state.file.opts.filename, src));
}

function writeMarkerFileForFile(state, src) {
  if (state && state.opts && (state.opts.noMarks)) return;
  if (!state.file || !state.file.opts || !state.file.opts.filename) return;
  try {
    const markerFilePath = getMarkerFilePathForFile(state.file.opts.filename, src);
    fs.writeFileSync(markerFilePath, '');
  } catch (err) { 
    console.log(`Error writing marker file: ${err.message}`);
  }
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
  // New file-based marker helpers
  getMarkerFilePathForFile,
  hasMarkerFileForFile,
  writeMarkerFileForFile,
};

module.exports = markersAndCacheUtils;
