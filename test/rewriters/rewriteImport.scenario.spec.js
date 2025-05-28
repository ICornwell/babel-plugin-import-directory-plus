import { describe, it, expect } from 'vitest';
const path = require('path');
const fs = require('fs');

const rewriteImport = require('../../src/rewriters/rewriteImport');
const { getConfiguredPackageUtils } = require('../../src/packageUtils');
const fileUtil = require('../../src/fileUtil');
const markersAndCacheUtils = require('../../src/markersAndCacheUtils');
const scenarioExpectations = require('../scenario-expectations.json');

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

describe('rewriteImport-scenario-detection-real-fs', () => {
  Object.entries(scenarioExpectations).forEach(([scenarioFolder, imports]) => {
    imports.forEach(({ importSource, expectedScenario }) => {
      it(`should detect scenario '${expectedScenario}' for import '${importSource}' in '${scenarioFolder}'`, () => {
        // Try both possible underTest/undertest casing
        let modulesDir = path.resolve(__dirname, '..', scenarioFolder, 'node_modules', 'underTest');
        let filename = path.join(modulesDir, 'input.js');
        if (!fs.existsSync(filename)) {
          modulesDir = path.resolve(__dirname, '..', scenarioFolder, 'node_modules', 'undertest');
          filename = path.join(modulesDir, 'input.js');
        }
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
});
