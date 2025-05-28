import { describe, it, expect } from 'vitest';
const path = require('path');

const rewriteImport = require('../../src/rewriters/rewriteImport');
const { getConfiguredPackageUtils } = require('../../src/packageUtils');
const fileUtil = require('../../src/fileUtil');
const markersAndCacheUtils = require('../../src/markersAndCacheUtils');

function makeState(filename, opts = {}) {
  return {
    file: { opts: { filename } },
    opts,
  };
}

function makeContext(modulesDir) {
  const { getCachedDir } = markersAndCacheUtils.createDirCache(fileUtil.isDirectory);
  const { getCachedPkg } = markersAndCacheUtils.createPkgCache(fileUtil.readJSON);
  const packageUtils = getConfiguredPackageUtils({}, () => {});
  // Patch safeJoin to respect modulesDir/node_modules for test scenarios
  const origSafeJoin = fileUtil.safeJoin;
  const safeJoin = (...args) => {
    if (args[0] === 'node_modules') {
      args[0] = path.join(modulesDir, 'node_modules');
    }
    return origSafeJoin(...args);
  };
  return {
    getCachedDir,
    getCachedPkg,
    packageUtils,
    safeJoin,
    hasMarkerFile: () => false,
    writeMarkerFile: () => {},
    verboseLog: () => {},
    isFile: fileUtil.isFile,
  };
}

// Table-driven scenarios: [scenarioFolder, importSource, expectedScenario]
const scenarios = [
  ['bare-import-exports', '@mui/material/Button', 'bare-import-exports-no-rewrite'],
  ['bare-import-main', 'lodash/utils', 'bare-import-subpath'],
  ['bare-import-noexports', 'npm-cli/utils', 'bare-import-subpath'],
  ['bare-import-subpath', '@mui/material/Button', 'bare-import-exports-no-rewrite'],
  ['bare-import-cjs', 'lodash/utils', 'bare-import-subpath'],
  ['bare-import-esm', '@mui/x-date-pickers/utils', 'bare-import-exports-no-rewrite'],
  ['relative-import', './src/components', 'relative-import-not-a-dir'],
  ['relative-import-noexports', './src/components', 'relative-import-not-a-dir'],
  ['should-not-rewrite', '@emotion/react/jsx-runtime', 'bare-import-exports-no-rewrite'],
];

describe('rewriteImport-scenario-detection-real-fs', () => {
  scenarios.forEach(([scenarioFolder, importSource, expectedScenario]) => {
    it(`should detect scenario '${expectedScenario}' for import '${importSource}' in '${scenarioFolder}'`, () => {
      const modulesDir = path.resolve(__dirname, '..', scenarioFolder);
      // Use input.js as the test file for scenario detection
      const filename = path.join(modulesDir, 'input.js');
      const state = makeState(filename, { modulesDir });
      const context = makeContext(modulesDir);
      const { scenario } = rewriteImport.detectImportScenario({
        src: importSource,
        state,
        ...context,
      });
      expect(scenario).toBe(expectedScenario);
    });
  });
});
