import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { transformSync } from '@babel/core';
import plugin from '../src/index.js';
import fsExtra from 'fs-extra';

// use to restrict to specific tests for debugging, otherwise use /.*/
const testMatch = /.*/

const scenariosDir = path.resolve(__dirname);
const workingDir = path.join(scenariosDir, 'workingTests');

describe('babel-plugin-import-directory-plus scenarios', () => {
  let scenarioFolders = [];

  beforeAll(() => {
    console.log('[beforeAll] Removing and recreating workingTests:', workingDir);
    fsExtra.removeSync(workingDir);
    fsExtra.mkdirSync(workingDir);
    for (const folder of fs.readdirSync(scenariosDir)) {
      const full = path.join(scenariosDir, folder);
      if (fs.statSync(full).isDirectory() && folder !== 'workingTests') {
        console.log('[beforeAll] Copying scenario folder:', folder);
        fsExtra.copySync(full, path.join(workingDir, folder));
      }
    }
    console.log('[beforeAll] workingTests contents:', fs.readdirSync(workingDir));
    // Discover scenario folders after setup
    scenarioFolders = fs.readdirSync(workingDir).filter(f => {
      const full = path.join(workingDir, f);
      if (!fs.statSync(full).isDirectory()) return false;
      const underTestInput = path.join(full, 'node_modules', 'underTest', 'input.js');
      const underTestInputAlt = path.join(full, 'node_modules', 'undertest', 'input.js');
      const expectedPath = path.join(full, 'expected.js');
      return (fs.existsSync(underTestInput) || fs.existsSync(underTestInputAlt)) && fs.existsSync(expectedPath);
    }).filter(f => f.match(testMatch));
    console.log('[main] scenarioFolders found:', scenarioFolders);
  });

  afterAll(() => {
    console.log('[afterAll] Removing workingTests:', workingDir);
    fsExtra.removeSync(workingDir);
  });

  it('should transform all scenarios and report all failures', () => {
    const failures = [];
    for (const folder of scenarioFolders) {
      try {
        const dir = path.join(workingDir, folder);
        const modulesDir = path.join(dir, 'node_modules');
        const underTestInput = path.join(dir, 'node_modules', 'underTest', 'input.js');
        const underTestInputAlt = path.join(dir, 'node_modules', 'undertest', 'input.js');
        const inputPath = fs.existsSync(underTestInput) ? underTestInput : underTestInputAlt;
        const expectedPath = path.join(dir, 'expected.js');
        if (!fs.existsSync(inputPath) || !fs.existsSync(expectedPath)) continue;
        const input = fs.readFileSync(inputPath, 'utf8').replace(/\r\n/g, '\n');
        const expected = fs.readFileSync(expectedPath, 'utf8').replace(/\r\n/g, '\n');
        console.log(`[scenario] running transform for scenario folder: ${folder}`);
        const result = transformSync(input, {
          babelrc: false,
          configFile: false,
          plugins: [[plugin, { verbose: false, modulesDir: modulesDir, noMarks: true, force: true }]],
          filename: inputPath,
        }).code.replace(/\r\n/g, '\n');
        const normalizeQuotes = str => str.replace(/"/g, "'");
        if (normalizeQuotes(result.trim()) !== normalizeQuotes(expected.trim())) {
          failures.push(`Scenario '${folder}' failed.\nExpected:\n${expected}\nGot:\n${result}`);
        }
      } catch (err) {
        failures.push(`Scenario '${folder}' threw error: ${err.stack || err}`);
      }
    }
    if (failures.length > 0) {
      throw new Error(failures.join('\n\n'));
    }
  });
});
