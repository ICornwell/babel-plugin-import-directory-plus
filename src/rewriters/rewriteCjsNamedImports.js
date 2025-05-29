// rewriteCjsNamedImports.js - CJS named import rewriter utility for babel-plugin-import-directory-plus
const path = require('path');

/**
 * Rewrites named imports from CommonJS modules to a default import plus destructured variables.
 *
 * Intent: Ensure compatibility with CJS modules in ESM-aware environments by transforming named imports (which are not natively supported in CJS) into a pattern that works for both CJS and ESM consumers.
 *
 * - Resolves the entry path for the import (bare or relative).
 * - Checks if the target is a CJS module.
 * - Rewrites named imports to a default import and destructures the required names.
 * - Skips rewriting if the import is not CJS or if no named imports are present.
 * - Designed for use in Babel plugins and automated code migration tools.
 *
 * @param {object} pathObj - The Babel path object for the import declaration.
 * @param {object} t - Babel types utility.
 * @param {object} state - Babel plugin state, used for options and file context.
 * @param {object} context - Context object containing cache, utility, and logging functions.
 */
function rewriteCjsNamedImports(pathObj, t, state, {
  targetPackage,
  packageUtils,
  safeJoin,
  verboseLog
}) {
   const { pkgName, pkgJson, pkgDir, isPeer } = targetPackage;
  // Defensive: check for .node property
  if (!pathObj || !pathObj.node || !pathObj.node.source) return;
  const src = pathObj.node.source.value;
  if (!src) return;
  const node = pathObj.node;
  const namedSpecifiers = node.specifiers.filter(s => t.isImportSpecifier(s));
  if (namedSpecifiers.length === 0) return;
  let entryPath = '';
  let relative = false;
  if (packageUtils.isRelativeImport(src)) {
    entryPath = getEntryPathForRelativeImport(src, targetPackage, state, safeJoin);
    relative = true;
  } else {
    entryPath = getEntryPathForBareImport(src, targetPackage, safeJoin);
  }
  if (!entryPath || typeof entryPath !== 'string') return;
  if (!packageUtils.isCjsModule(entryPath, targetPackage, relative)) return;
  const defaultId = pathObj.scope && pathObj.scope.generateUidIdentifier ? pathObj.scope.generateUidIdentifier('cjsDefault') : { name: 'cjsDefault' };
  if (typeof pathObj.insertBefore !== 'function') return;

  verboseLog(`Rewriting CJS named imports for ${src} in ${state.file.opts.filename}`, state)

  pathObj.insertBefore(
    t.importDeclaration([
      t.importDefaultSpecifier(defaultId)
    ], t.stringLiteral(src))
  );
  namedSpecifiers.forEach(s => {
    pathObj.insertBefore(
      t.variableDeclaration('const', [
        t.variableDeclarator(
          t.identifier(s.local.name),
          t.memberExpression(defaultId, t.identifier(s.imported.name))
        )
      ])
    );
  });
  node.specifiers = node.specifiers.filter(s => !t.isImportSpecifier(s));
  if (node.specifiers.length === 0 && typeof pathObj.remove === 'function') {
    pathObj.remove();
  }
}

/**
 * Resolves the entry path for a relative import, ensuring it points to an index file if needed.
 *
 * Purpose: Abstracts the logic for resolving relative import entrypoints, supporting both .js/.cjs and directory targets.
 *
 * @param {string} src - The import source string.
 * @param {object} state - Babel plugin state, used for options and file context.
 * @param {function} safeJoin - A utility function for safe path joining.
 * @returns {string|null} - The resolved entry path or null if it cannot be determined.
 */
function getEntryPathForRelativeImport(src, targetPackage, state, safeJoin) {
  const { pkgName, pkgJson, pkgDir, isPeer } = targetPackage;
  const fileName = state.file.opts.filename || state.file.opts.sourceFileName || '';
  if (typeof path.dirname !== 'function' || typeof fileName !== 'string') return null;
  const fileDir = path.dirname(fileName);
  let entryPath = safeJoin(fileDir, src);
  if (typeof entryPath !== 'string') return null;
  if (!entryPath.endsWith('.js') && !entryPath.endsWith('.cjs')) {
    entryPath = safeJoin(entryPath, 'index.js');
  }
  return entryPath;
}

/**
 * Resolves the entry path for a bare import, ensuring it points to an index file if needed.
 *
 * Purpose: Abstracts the logic for resolving bare import entrypoints, supporting both .js/.cjs and directory targets.
 *
 * @param {string} src - The import source string.
 * @param {function} safeJoin - A utility function for safe path joining.
 * @returns {string|null} - The resolved entry path or null if it cannot be determined.
 */
function getEntryPathForBareImport(src, targetPackage, safeJoin) {
  const {  pkgDir } = targetPackage;
  let { pkgName } = targetPackage;
  const parts = src.split('/');
  
  if (pkgName.startsWith('@')) pkgName += '/' + parts[1];
  
  if (typeof pkgDir !== 'string') return null;
  const rest = parts.slice(pkgName.startsWith('@') ? 2 : 1);
  if (!Array.isArray(rest) || !rest.every(p => typeof p === 'string')) return null;
  let entryPath = safeJoin(pkgDir, ...rest);
  if (typeof entryPath !== 'string') return null;
  if (!entryPath.endsWith('.js') && !entryPath.endsWith('.cjs')) {
    entryPath = safeJoin(entryPath, 'index.js');
  }
  return entryPath;
}

module.exports = rewriteCjsNamedImports;
