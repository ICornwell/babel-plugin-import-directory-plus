const path = require('path');
const { isFile } = require('../fileUtil.js');

/**
 * Detects the scenario for a given import, matching test scenario names.
 * Returns { scenario, meta } where scenario is a string and meta contains scenario-specific info.
 */
function detectImportScenario({ src, state, packageUtils, safeJoin, getCachedPkg, getCachedDir }) {
  // Problem: No import source provided
  if (!src) return { scenario: 'invalid', meta: {} };

  // Problem: Import is already explicit (ends with /index or /index.js)
  if (src.endsWith('/index.js') || src.endsWith('/index')) return { scenario: 'already-explicit', meta: {} };

  const isBare = packageUtils.isBareImport(src);
  const isRelative = packageUtils.isRelativeImport(src);

  if (isBare) {
    // Problem: Need to determine if this is a package root, subpath, or something else
    const parts = src.split('/');
    const subpathStartIdx = parts[0].startsWith('@') ? 2 : 1;
    const pkgName = parts[0].startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
    const pkgDir = safeJoin('node_modules', pkgName);
    if (typeof pkgDir !== 'string') {
      // Problem: Could not resolve package directory
      return { scenario: 'invalid', meta: {} };
    }
    const pkgJsonPath = safeJoin(pkgDir, 'package.json');
    const pkgJson = getCachedPkg(pkgJsonPath);
    if (!pkgJson) {
      // Problem: No package.json found, so we can't check exports or main
      // Check if importDir is a directory for subpath scenario
      const importDir = safeJoin(pkgDir, ...parts.slice(subpathStartIdx));
      if (typeof importDir === 'string' && getCachedDir(importDir)) {
        return { scenario: 'bare-import-subpath', meta: { parts, subpathStartIdx, pkgName, pkgDir, pkgJson: null, importDir } };
      }
      return { scenario: 'bare-import-noexports', meta: { parts, subpathStartIdx, pkgName, pkgDir, pkgJson: null } };
    }
    if (src === pkgName) {
      // Problem: Import is the package root (e.g., 'foo' or '@scope/foo')
      return { scenario: 'bare-import-main', meta: { parts, subpathStartIdx, pkgName, pkgDir, pkgJson } };
    }
    const subpathForExports = './' + parts.slice(subpathStartIdx).join('/');
    const importDir = safeJoin(pkgDir, ...parts.slice(subpathStartIdx));
    // --- DEBUG: Log what exports and subpathForExports are ---
    // eslint-disable-next-line no-console
    if (pkgJson.exports) {
      // SCENARIO: The package.json has an 'exports' field. This means the package uses modern subpath exports (Node.js ESM semantics).
      // We must check if the import matches an explicit subpath export (e.g., './Button' in @mui/material).
      // This branch is relevant because Node.js will only allow access to explicitly exported subpaths.
      console.log('[detectImportScenario] pkgJson.exports:', JSON.stringify(pkgJson.exports), 'subpathForExports:', subpathForExports);
    }
    if (pkgJson.exports) {
      // --- SCENARIO: Package has 'exports' field ---
      // This branch handles packages using modern exports maps (e.g., @emotion/react, @mui/material)
      // Node.js ESM resolution only allows importing subpaths that are explicitly exported in 'exports'.
      // WHY: If a subpath is not exported, Node.js will throw an error (ERR_PACKAGE_PATH_NOT_EXPORTED).
      //      This is a security and encapsulation feature: only listed subpaths are public API.
      // We must check if the import subpath is explicitly exported, and if so, what it points to.
      if (Object.prototype.hasOwnProperty.call(pkgJson.exports, subpathForExports)) {
        // --- SCENARIO: Import matches an explicit subpath export ---
        // Real-world use-case: @emotion/react/jsx-runtime, where './jsx-runtime' is exported as a file, not a directory.
        // WHY: If the export target is a file, Node.js expects the import to resolve directly to that file.
        //      Rewriting to a directory (e.g., adding '/index.js') would break the import, as there is no directory to resolve.
        //      This is common for packages that export a single entrypoint per subpath (e.g., './jsx-runtime': './dist/jsx-runtime.js').
        let exportTarget = pkgJson.exports[subpathForExports]?.default || pkgJson.exports[subpathForExports];
        if (typeof exportTarget === 'object' && exportTarget.default) {
          exportTarget = exportTarget.default;
        }
        if (typeof exportTarget === 'string') {
          const exportTargetPath = safeJoin(pkgDir, exportTarget.replace(/^[./\\]/, ''));
          if (typeof exportTargetPath === 'string' && isFile(exportTargetPath)) {
            // --- SCENARIO: Export points to a file, not a directory ---
            // WHY: Node.js treats this as a file-only export. Importing as a directory (with '/index.js') would fail.
            //      This is critical for correct interop with packages that export files as subpaths (e.g., @emotion/react/jsx-runtime).
            //      We must NOT rewrite, or consumers will get runtime errors (MODULE_NOT_FOUND).
            return { scenario: 'bare-import-exports-no-rewrite', meta: { parts, subpathStartIdx, pkgName, pkgDir, pkgJson, importDir, subpathForExports, exportTargetPath } };
          }
        }
        // --- SCENARIO: Export exists, but does not point to a file ---
        // WHY: If the export is not a file, it may be a directory (e.g., @mui/material/Button).
        //      In this case, Node.js allows importing the directory, and will resolve to its 'index.js' (or 'index.mjs', etc.).
        //      Rewriting to '/index.js' is safe and matches Node.js behavior, making imports explicit and compatible with bundlers.
        const importDirExists = typeof importDir === 'string' && getCachedDir(importDir);
        if (!importDirExists) {
          // --- SCENARIO: Export exists, but importDir is not a directory ---
          // WHY: If the export does not resolve to a directory, rewriting would break the import (no 'index.js' to resolve).
          //      This prevents accidental rewrites that would cause runtime errors for consumers.
          return { scenario: 'bare-import-exports-no-rewrite', meta: { parts, subpathStartIdx, pkgName, pkgDir, pkgJson, importDir, subpathForExports } };
        }
        // --- SCENARIO: Export exists and importDir is a directory ---
        // Real-world use-case: @mui/material/Button, where './Button' is exported and is a directory with index.js
        // WHY: Node.js will resolve the import to './Button/index.js' automatically.
        //      Rewriting to '/index.js' is safe, explicit, and helps bundlers and static analysis tools.
        //      This is the canonical case for directory-style subpath exports.
        // Debug: log importDir and directory existence
        // eslint-disable-next-line no-console
        console.log('[detectImportScenario] importDir:', importDir, 'getCachedDir(importDir):', getCachedDir(importDir));
        if (importDirExists) {
          return { scenario: 'bare-import-exports', meta: { parts, subpathStartIdx, pkgName, pkgDir, pkgJson, importDir, subpathForExports } };
        } else {
          // --- SCENARIO: Defensive fallback, should not normally hit ---
          // WHY: If importDir does not exist, treat as not-a-dir (should be unreachable if above logic is correct).
          //      This is a safety net to avoid rewriting imports that cannot possibly resolve.
          return { scenario: 'bare-import-not-a-dir', meta: { parts, subpathStartIdx, pkgName, pkgDir, pkgJson, importDir, subpathForExports } };
        }
      } else {
        // --- SCENARIO: Import subpath is NOT exported in package.json ---
        // Real-world use-case: User tries to import a subpath that is not listed in exports (e.g., 'foo/unknown')
        // WHY: Node.js will throw ERR_PACKAGE_PATH_NOT_EXPORTED for such imports.
        //      We must not rewrite, as the import is not valid per the package's public API.
        // Debug: log importDir and directory existence for not-a-dir
        // eslint-disable-next-line no-console
        console.log('[detectImportScenario] (not exported) importDir:', importDir, 'getCachedDir(importDir):', getCachedDir(importDir));
        return { scenario: 'bare-import-not-a-dir', meta: { parts, subpathStartIdx, pkgName, pkgDir, pkgJson, importDir, subpathForExports } };
      }
    } else {
      // SCENARIO: The package.json does NOT have an 'exports' field (classic CommonJS/ESM package).
      // We fall back to checking if the import resolves to a directory (e.g., lodash/utils/).
      // If so, allow rewrite to '/index.js'. If not, do not rewrite.
      console.log('[detectImportScenario] (no exports) importDir:', importDir, 'getCachedDir(importDir):', getCachedDir(importDir));
      if (typeof importDir === 'string' && getCachedDir(importDir)) {
        return { scenario: 'bare-import-subpath', meta: { parts, subpathStartIdx, pkgName, pkgDir, pkgJson, importDir } };
      } else {
        return { scenario: 'bare-import-noexports', meta: { parts, subpathStartIdx, pkgName, pkgDir, pkgJson, importDir, subpathForExports } };
      }
    }
  } else if (isRelative) {
    // Problem: Need to check if relative import points to a directory
    const fileDir = path.dirname(state.file.opts.filename || state.file.opts.sourceFileName || '');
    const importDir = path.resolve(fileDir, src);
    if (typeof importDir !== 'string' || !getCachedDir(importDir)) {
      // Problem: Relative import does not resolve to a directory
      return { scenario: 'relative-import-not-a-dir', meta: { importDir } };
    }
    // Problem: Relative import points to a directory
    return { scenario: 'relative-import', meta: { importDir } };
  }
  // Problem: Import type is unknown or unsupported
  return { scenario: 'unknown', meta: {} };
}

/**
 * Rewrites bare or relative directory imports to explicit entrypoints (e.g., '/index.js') when safe and appropriate.
 * Now uses scenario detection to select the correct rewrite strategy.
 */
function rewriteImport(node, state, t, {
  getCachedDir,
  getCachedPkg,
  packageUtils,
  safeJoin,
  hasMarkerFile,
  writeMarkerFile,
  verboseLog
}) {
  const src = node.source.value;
  const { scenario, meta } = detectImportScenario({ src, state, packageUtils, safeJoin, getCachedPkg, getCachedDir });
  verboseLog(`[SCENARIO] Detected scenario: ${scenario} for import '${src}'`, state);
  let resolvedPath = null;
  let importDir = null;
  switch (scenario) {
    case 'bare-import-subpath':
    case 'bare-import-exports': // Now allow rewrite for this scenario
      resolvedPath = src + '/index.js';
      importDir = meta.importDir;
      break;
    case 'bare-import-noexports':
      // No package.json, but if importDir exists, allow rewrite
      if (meta.importDir && typeof meta.importDir === 'string') {
        resolvedPath = src + '/index.js';
        importDir = meta.importDir;
      }
      break;
    case 'relative-import':
      resolvedPath = src.replace(/\/?$/, '/index.js');
      importDir = meta.importDir;
      break;
    // All these scenarios should NOT rewrite:
    case 'already-explicit':
    case 'bare-import-main':
    case 'bare-import-not-a-dir':
    case 'relative-import-not-a-dir':
    case 'invalid':
    case 'unknown':
    case 'bare-import-exports-no-rewrite': // New scenario for explicit subpath exports that should not be rewritten
    default:
      return;
  }
  if (!resolvedPath || typeof importDir !== 'string') return;
  if (hasMarkerFile(importDir, state, isFile)) {
    verboseLog(`[DEBUG] Marker file found in: '${importDir}', skipping rewrite`, state);
    return;
  }
  writeMarkerFile(importDir, state);
  verboseLog(`Rewriting import '${src}' → '${resolvedPath}'`, state);
  node.source.value = resolvedPath;
}

// Expose detectImportScenario for testing
module.exports = rewriteImport;
module.exports.detectImportScenario = detectImportScenario;
