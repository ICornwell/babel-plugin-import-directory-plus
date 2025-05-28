const path = require('path');
const fs = require('fs');
const { isFile, isDirectory, getPackageJsonFilePath, getDependsPackageJson, getNodeModulesDir } = require('../fileUtil.js');

/**
 * Detects the scenario for a given import, matching test scenario names.
 * Returns { scenario, meta } where scenario is a string and meta contains scenario-specific info.
 */
function detectImportScenario({ src, state, packageUtils, safeJoin, getCachedPkg, getCachedDir, verboseLog }) {
  // Problem: No import source provided
  if (!src) return { scenario: 'invalid', meta: {} };

  // Problem: Import is already explicit (ends with /index or /index.js)
  if (src.endsWith('/index.js') || src.endsWith('/index')) return { scenario: 'already-explicit', meta: {} };

  // --- NEW: Detect if import is already using /esm ---
  if (/\/esm(\/|$)/.test(src)) return { scenario: 'already-explicit-esm', meta: {} };

  const isBare = packageUtils.isBareImport(src);
  const isRelative = packageUtils.isRelativeImport(src);

  const sourcePkgJson = getDependsPackageJson(state.file.opts.filename);

  let isPeer = packageUtils.isPeerImport(src, sourcePkgJson);

  if (isBare) {
    // Problem: Need to determine if this is a package root, subpath, or something else
    const parts = src.split('/');
    const subpathStartIdx = parts[0].startsWith('@') ? 2 : 1;
    const pkgName = parts[0].startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
    // if we're a peer is the current package route path as a starting point to walk backwards to
    // the node_modules directory that a peer package would be installed in
    let pkgDir = isPeer ? safeJoin(getNodeModulesDir(sourcePkgJson.pkgDir), pkgName) : safeJoin(sourcePkgJson.pkgDir, 'node_modules', pkgName);
    
    // if it wasn't marked as a peer but we have no local node_modules package, try at peer level
    // it might have been deduped or resolved to a peer package
    if (!isPeer && !isDirectory(pkgDir)) {
      verboseLog(`[DEBUG] No package directory found for '${src}' in file: ${pkgDir} - promoting to peer`, state);
      isPeer = true
      pkgDir = safeJoin(getNodeModulesDir(sourcePkgJson.pkgDir), pkgName)
    } else {
      verboseLog(`[DEBUG] Found package directory for '${src}': ${pkgDir}`, state);
    }
    if (typeof pkgDir !== 'string') {
      // Problem: Could not resolve package directory
      return { scenario: 'invalid', meta: {} };
    }

    

    const pkgJsonPath = safeJoin(pkgDir, 'package.json')
    const pkgJsonFilePath = getPackageJsonFilePath(pkgJsonPath);
    const pkgJson = getCachedPkg(pkgJsonFilePath);
    if (!pkgJson) {
      verboseLog(`[DEBUG] No package.json found for '${src}' in file: ${state.file.opts.filename}`, state);
      // Problem: No package.json found, so we can't check exports or main
      // Check if importDir is a directory for subpath scenario
      const importDir = safeJoin(pkgDir, ...parts.slice(subpathStartIdx));
      if (typeof importDir === 'string' && getCachedDir(importDir)) {
        verboseLog(`[DEBUG] Import directory exists for '${src}': ${importDir}, isPeer:${isPeer}`, state);
        return { scenario: 'bare-import-subpath-no-pkg', meta: { parts, subpathStartIdx, pkgName, pkgDir, pkgJson: null, importDir, isPeer } };
      }
      return { scenario: 'bare-import-noexports', meta: { parts, subpathStartIdx, pkgName, pkgDir, pkgJson: null, isPeer } };
    }
    verboseLog(`[DEBUG] Found package.json for '${src}': ${pkgJsonPath}`, state);
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
      verboseLog(`[detectImportScenario] pkgJson.exports:${JSON.stringify(pkgJson.exports)} subpathForExports:${subpathForExports}`, state);
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
        if (typeof exportTarget === 'object') {
          if (exportTarget.default && typeof exportTarget.default === 'string')
            // --- SCENARIO: Export is an object with a 'default' property ---
            exportTarget = exportTarget.default;
          if (exportTarget.import) {
            if (typeof exportTarget.import === 'string')
              // --- SCENARIO: Export is an object with a 'default' property ---
              exportTarget = exportTarget.import;
            if (exportTarget.import.default && typeof exportTarget.import.default === 'string')
              // --- SCENARIO: Export is an object with a 'default' property ---
              exportTarget = exportTarget.import.default;
          } else if (exportTarget.require) {
            if (typeof exportTarget.require === 'string')
              // --- SCENARIO: Export is an object with a 'default' property ---
              exportTarget = exportTarget.require;
            if (exportTarget.require.default && typeof exportTarget.require.default === 'string')
              // --- SCENARIO: Export is an object with a 'default' property ---
              exportTarget = exportTarget.require.default;
          }
        }
        if (typeof exportTarget === 'string') {
          const exportTargetPath = safeJoin(pkgDir, exportTarget.replace(/^[./\\]/, ''));
          if (typeof exportTargetPath === 'string' && isFile(exportTargetPath)) {
            // --- SCENARIO: Export points to a file, not a directory ---
            // Do NOT rewrite
            // WHY: Node.js will only allow the import as written (e.g., 'date-fns/parse'),
            //      and will throw ERR_PACKAGE_PATH_NOT_EXPORTED if you try to import 'date-fns/parse/index.js'.
            //      This prevents breakage for packages with restrictive exports fields.
            return { scenario: 'bare-import-exports-no-rewrite', meta: { parts, subpathStartIdx, pkgName, pkgDir, pkgJson, importDir, subpathForExports, exportTargetPath, isPeer } };
          }
        }
        // --- SCENARIO: Export exists, but does not point to a file ---
        // WHY: If the export is not a file, it may be a directory (e.g., @mui/material/Button).
        //      In this case, Node.js allows importing the directory, and will resolve to its 'index.js' (or 'index.mjs', etc.).
        //      Rewriting to '/index.js' is safe and matches Node.js behavior, making imports explicit and compatible with bundlers.
        //      However, we must check if the rewritten subpath (e.g., './Button/index.js') is also present in exports.
        //      If it is not, Node.js will not allow the rewritten import, and we must NOT rewrite.
        const rewrittenSubpath = subpathForExports + '/index.js';
        if (!Object.prototype.hasOwnProperty.call(pkgJson.exports, rewrittenSubpath)) {
          // --- SCENARIO: The rewritten subpath is NOT present in exports ---
          // WHY: Node.js will throw ERR_PACKAGE_PATH_NOT_EXPORTED for 'foo/bar/index.js' if only './bar' is exported.
          //      This prevents the plugin from breaking packages like date-fns, which only export './parse', not './parse/index.js'.
          //      We must NOT rewrite in this case.
          return { scenario: 'bare-import-exports-no-rewrite', meta: { parts, subpathStartIdx, pkgName, pkgDir, pkgJson, importDir, subpathForExports, rewrittenSubpath, isPeer } };
        }
        // --- SCENARIO: Export exists and rewritten subpath is present ---
        // WHY: Both the original subpath and the rewritten subpath are exported, so rewriting is safe and allowed.
        //      This is the canonical case for directory-style subpath exports (e.g., @mui/material/Button).
        const importDirExists = typeof importDir === 'string' && getCachedDir(importDir);
        if (!importDirExists) {
          // --- SCENARIO: Export exists, but importDir is not a directory ---
          // WHY: If the export does not resolve to a directory, rewriting would break the import (no 'index.js' to resolve).
          //      This prevents accidental rewrites that would cause runtime errors for consumers.
          return { scenario: 'bare-import-exports-no-rewrite', meta: { parts, subpathStartIdx, pkgName, pkgDir, pkgJson, importDir, subpathForExports, isPeer } };
        }
        // --- SCENARIO: Export exists and importDir is a directory ---
        // Real-world use-case: @mui/material/Button, where './Button' is exported and is a directory with index.js
        // WHY: Node.js will resolve the import to './Button/index.js' automatically.
        //      Rewriting to '/index.js' is safe, explicit, and helps bundlers and static analysis tools.
        //      This is the canonical case for directory-style subpath exports.
        if (importDirExists) {
          return { scenario: 'bare-import-exports', meta: { parts, subpathStartIdx, pkgName, pkgDir, pkgJson, importDir, subpathForExports, isPeer } };
        }
      } else if (Object.prototype.hasOwnProperty.call(pkgJson.exports, subpathForExports + '/index.js')) {
        // --- SCENARIO: Only the rewritten subpath is present in exports ---
        // WHY: Some packages may only export the explicit index.js subpath (e.g., './utils/index.js'), not the directory itself.
        //      In this case, we can only rewrite if the directory exists, to avoid runtime errors.
        const importDirExists = typeof importDir === 'string' && getCachedDir(importDir);
        if (importDirExists) {
          return { scenario: 'bare-import-exports', meta: { parts, subpathStartIdx, pkgName, pkgDir, pkgJson, importDir, subpathForExports, isPeer } };
        } else {
          // --- SCENARIO: Export exists for index.js, but directory does not exist ---
          // WHY: If the directory does not exist, rewriting would break the import.
          return { scenario: 'bare-import-exports-no-rewrite', meta: { parts, subpathStartIdx, pkgName, pkgDir, pkgJson, importDir, subpathForExports, isPeer } };
        }
      } else {
        // --- SCENARIO: Neither the original nor the rewritten subpath is present in exports ---
        // WHY: Node.js will throw ERR_PACKAGE_PATH_NOT_EXPORTED for such imports.
        //      We must not rewrite, as the import is not valid per the package's public API.
        //      This prevents breakage for packages like MUI that only export specific subpaths.
        // Debug: log importDir and directory existence for not-a-dir
        // eslint-disable-next-line no-console
        verboseLog(`[detectImportScenario] (not exported) importDir:${importDir}, getCachedDir(importDir):, ${getCachedDir(importDir)}`, state);
        return { scenario: 'bare-import-not-a-dir', meta: { parts, subpathStartIdx, pkgName, pkgDir, pkgJson, importDir, subpathForExports, isPeer } };
      }
    } else {
      // SCENARIO: The package.json does NOT have an 'exports' field (classic CommonJS/ESM package).
      // We fall back to checking if the import resolves to a directory (e.g., lodash/utils/).
      // If so, allow rewrite to '/index.js'. If not, do not rewrite.
      verboseLog(`[detectImportScenario] (no exports) importDir:${importDir}, getCachedDir(importDir):${getCachedDir(importDir)}`, state);
      if (typeof importDir === 'string' && getCachedDir(importDir)) {
        return { scenario: 'bare-import-subpath', meta: { parts, subpathStartIdx, pkgName, pkgDir, pkgJson, importDir, isPeer } };
      } else {
        return { scenario: 'bare-import-noexports', meta: { parts, subpathStartIdx, pkgName, pkgDir, pkgJson, importDir, subpathForExports, isPeer } };
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

function findNearestPackageJson(startPath) {
  let dir = path.dirname(startPath);
  while (dir !== '/' && dir !== '.' && dir !== '') {
    const candidate = path.join(dir, 'package.json');
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function getPeerDependencies(pkgJsonPath) {
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
    return pkg.peerDependencies ? Object.keys(pkg.peerDependencies) : [];
  } catch {
    return [];
  }
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
  verboseLog,
  hasMarkerFileForFile,
  writeMarkerFileForFile
}) {
  const src = node.source.value;
  const filename = state.file && state.file.opts && state.file.opts.filename;
  // --- peerOnly logic ---
  const peerOnly = state.opts && state.opts.peerOnly;
  if (peerOnly && packageUtils.isBareImport(src)) {
    const pkgJsonPath = findNearestPackageJson(filename);
    const peerDeps = pkgJsonPath ? getPeerDependencies(pkgJsonPath) : [];
    const pkgName = src.startsWith('@') ? src.split('/').slice(0, 2).join('/') : src.split('/')[0];

    // scenarios that should rewrite even if not a peer import

    if (!peerDeps.includes(pkgName)) {
      verboseLog(`[PEER-ONLY] Skipping rewrite for '${src}' in file: ${filename} (not a peerDependency)`, state);
      return { targetPackage: { pkgName: pkgName, pkgJson: null, pkgDir:null, isPeer: false}};
    }
  }

  if (src.endsWith('/index.js') || src.endsWith('/index')) {
    verboseLog(`[DEBUG] Skipping already-explicit import: '${src}' in file: ${filename}`, state);
    return { targetPackage: { pkgName: null, pkgJson: null, pkgDir:null, isPeer: false}};
  }
  const { scenario, meta } = detectImportScenario({
    src,
    state,
    packageUtils,
    safeJoin,
    getCachedPkg,
    getCachedDir,
    verboseLog
  });
  // DEBUG: Log scenario and meta for every import
  if (process.env.BABEL_PLUGIN_IMPORT_DIRECTORY_DEBUG || state.opts.debug) {
    // eslint-disable-next-line no-console
    console.log(`[DEBUG] Detected scenario for '${src}':`, scenario, meta);
  }
  switch (scenario) {
    case 'bare-import-should-add-esm':
      // Insert /esm/ after the package name
      // e.g., @mui/x-date-pickers/AdapterDateFns => @mui/x-date-pickers/esm/AdapterDateFns
      {
        const { pkgName, subpath } = meta;
        resolvedPath = pkgName + '/esm/' + subpath;
        verboseLog(`[REWRITE] Rewriting import to use /esm: '${src}' → '${resolvedPath}'`, state);
      }
      break;
    case 'bare-import-subpath':
    case 'bare-import-subpath-no-pkg':
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
    case 'already-explicit-esm':
    case 'bare-import-main':
    case 'bare-import-not-a-dir':
    case 'relative-import-not-a-dir':
    case 'invalid':
    case 'unknown':
    case 'bare-import-exports-no-rewrite': // New scenario for explicit subpath exports that should not be rewritten
    default:
      return { targetPackage: { pkgName: meta.pkgName, pkgJson: meta.pkgJson, pkgDir:meta.pkgDir, isPeer: meta.isPeer } };
  }
  if (!resolvedPath) return;
  if (hasMarkerFileForFile && hasMarkerFileForFile(state, src)) {
    verboseLog(`[DEBUG] Marker file found for file: '${filename}', skipping rewrite`, state);
    return { targetPackage: { pkgName: meta.pkgName, pkgJson: meta.pkgJson, pkgDir:meta.pkgDir, isPeer: meta.isPeer } };
  }
  verboseLog(`[REWRITE] Rewriting import in file: ${filename} from '${src}' → '${resolvedPath}'`, state);
  if (writeMarkerFileForFile) writeMarkerFileForFile(state, src);
  node.source.value = resolvedPath;
  return { targetPackage: { pkgName: meta.pkgName, pkgJson: meta.pkgJson, pkgDir:meta.pkgDir, isPeer: meta.isPeer } }
}

// Expose detectImportScenario for testing
module.exports = rewriteImport;
module.exports.detectImportScenario = detectImportScenario;
