import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { transformSync } from '@babel/core';
import plugin from '../src/index.js';

// use to restrict to specific tests for debugging, otherwise use /.*/


describe('babel-plugin-import-directory-plus-single-example-debug-test', () => {

    const folder = './node_modules/underTest';
    const dir = path.join(__dirname, folder);
    const modulesDir = path.join(__dirname, 'node_modules')
    const inputPath = path.join(dir, 'input.js');
      
    const input = fs.readFileSync(inputPath, 'utf8').replace(/\r\n/g, '\n');
    
    it(`${folder} scenario`, () => {
      const result = transformSync(input, {
        babelrc: false,
        configFile: false,
        // Pass the scenario's node_modules as modulesDir
        plugins: ['@babel/plugin-proposal-optional-chaining',
          '@babel/plugin-proposal-nullish-coalescing-operator',
           [plugin, { verbose: true, modulesDir: modulesDir, noMarks: true, force: true}]],
        filename: inputPath,
      }).code.replace(/\r\n/g, '\n');
      // Normalize quotes for comparison
      console.log(result);
    });
  }
);
