import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { transformSync } from '@babel/core';
import plugin from '../src/index.js';

// use to restrict to specific tests for debugging, otherwise use /.*/
const testMatch = /.*/

const scenariosDir = path.resolve(__dirname);
// Find all scenario folders in test/ that contain both input.js and expected.js
const scenarioFolders = fs.readdirSync(scenariosDir).filter(f => {
  const full = path.join(scenariosDir, f);
  if (!fs.statSync(full).isDirectory()) return false;
  const inputPath = path.join(full, 'input.js');
  const expectedPath = path.join(full, 'expected.js');
  return fs.existsSync(inputPath) && fs.existsSync(expectedPath);
}).filter(f => f.match(testMatch));

describe('babel-plugin-import-directory-plus scenarios', () => {
  if (scenarioFolders.length === 0) {
    it('should find at least one scenario folder', () => {
      expect(scenarioFolders.length).toBeGreaterThan(0);
    });
  }
  for (const folder of scenarioFolders) {
    const dir = path.join(scenariosDir, folder);
    const modulesDir = path.join(dir, 'node_modules')
    const inputPath = path.join(dir, 'input.js');
    const expectedPath = path.join(dir, 'expected.js');
    if (!fs.existsSync(inputPath) || !fs.existsSync(expectedPath)) continue;
    const input = fs.readFileSync(inputPath, 'utf8').replace(/\r\n/g, '\n');
    const expected = fs.readFileSync(expectedPath, 'utf8').replace(/\r\n/g, '\n');
    it(`${folder} scenario`, () => {
      const result = transformSync(input, {
        babelrc: false,
        configFile: false,
        // Pass the scenario's node_modules as modulesDir
        plugins: [[plugin, { verbose: false, modulesDir: modulesDir, noMarks: true, force: true}]],
        filename: inputPath,
      }).code.replace(/\r\n/g, '\n');
      // Normalize quotes for comparison
      const normalizeQuotes = str => str.replace(/"/g, "'");
      expect(normalizeQuotes(result.trim())).toBe(normalizeQuotes(expected.trim()));
    });
  }
});
