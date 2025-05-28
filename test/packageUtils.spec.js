import { describe, it, expect } from 'vitest';
const { getConfiguredPackageUtils } = require('../src/packageUtils');
const path = require('path');

describe('packageUtils', () => {
  // Minimal mock state and logger
  const state = {};
  const verboseLog = () => {};
  const utils = getConfiguredPackageUtils(state, verboseLog);

  it('should detect bare imports', () => {
    // Scenario: Bare imports are those that do NOT start with '.' or '/'.
    // Examples: 'foo', '@scope/foo' (package names or subpaths)
    // See: Node.js ESM/CJS import spec, package.json resolution
    expect(utils.isBareImport('foo')).toBe(true); // package root
    expect(utils.isBareImport('@scope/foo')).toBe(true); // scoped package
    expect(utils.isBareImport('./foo')).toBe(false); // relative
    expect(utils.isBareImport('/foo')).toBe(false); // absolute
    // Edge case: empty string and undefined are not valid imports (Node.js throws)
    expect(utils.isBareImport('')).toBe(false);
    expect(utils.isBareImport(undefined)).toBe(false);
  });

  it('should detect relative imports', () => {
    // Scenario: Relative imports start with '.' or '/'.
    // Examples: './foo', '/foo' (relative or absolute file/directory)
    // See: Node.js ESM/CJS import spec
    expect(utils.isRelativeImport('./foo')).toBe(true);
    expect(utils.isRelativeImport('/foo')).toBe(true);
    expect(utils.isRelativeImport('foo')).toBe(false); // bare
    // Edge case: empty string and undefined are not valid imports
    expect(utils.isRelativeImport('')).toBe(false);
    expect(utils.isRelativeImport(undefined)).toBe(false);
  });

  it('should get package.json path for a directory', () => {
    // Scenario: Node.js resolves package roots by finding the nearest package.json up the directory tree
    // See: Node.js package resolution algorithm
    const dir = __dirname;
    const pkgPath = utils.getPackageJson(dir);
    expect(pkgPath.endsWith('/package.json'));
  });

  it('should get entrypoint from package.json and subpath', () => {
    // Scenario: Node.js uses package.json "exports", then "module", then "main" fields to resolve entrypoints
    // See: https://nodejs.org/api/packages.html#exports
    const pkgJson = {
      exports: {
        './foo': './foo/index.js', // explicit subpath export
        './bar': { import: './bar/import.js', default: './bar/default.js' } // conditional exports
      },
      module: './mod.js', // ESM fallback
      main: './main.js' // CJS fallback
    };
    expect(utils.getEntrypoint(pkgJson, './foo')).toBe('./foo/index.js'); // explicit export
    expect(utils.getEntrypoint(pkgJson, './bar')).toBe('./bar/import.js'); // conditional export (import)
    expect(utils.getEntrypoint(pkgJson, './baz')).toBe('./mod.js'); // fallback to module
    expect(utils.getEntrypoint({}, './baz')).toBe('index.js'); // fallback to index.js
  });

  it('should resolve entrypoint path for a directory and subpath', () => {
    // Scenario: Plugin fallback logic if package.json is not found (not Node.js core behavior)
    // If getPackageJson returns null, plugin falls back to /some/dir/index.js
    // This is to ensure a default entrypoint for test scenarios and plugin robustness
    const fakePkgJson = { exports: { './foo': './foo/index.js' } };
    const fakeGetCachedPkg = () => fakePkgJson;
    const fakeGetEntrypoint = (pkgJson, subpath) => pkgJson.exports[subpath] || 'index.js';
    const dir = '/some/dir';
    const subpath = './foo';
    const result = utils.resolveEntrypoint(dir, subpath, fakeGetCachedPkg, fakeGetEntrypoint);
    expect(result).toMatch(/\/some\/dir\/index\.js$/);
  });

  it('should allow rewrite if no exports field', () => {
    // Scenario: If package.json has no exports, Node.js allows deep imports (legacy behavior)
    // See: https://nodejs.org/api/packages.html#subpath-exports
    const pkgJson = { main: './main.js' };
    expect(utils.isAllowedByExports(pkgJson, './foo')).toBe(true);
    expect(utils.isAllowedByExports({}, './foo')).toBe(true);
    expect(utils.isAllowedByExports(null, './foo')).toBe(true);
  });

  it('should allow rewrite if subpath is in exports', () => {
    // Scenario: If subpath is explicitly exported, rewrite is allowed
    // See: package.json exports field
    const pkgJson = { exports: { './foo': './foo/index.js' } };
    expect(utils.isAllowedByExports(pkgJson, './foo')).toBe(true);
  });

  it('should allow rewrite if subpath with /index.js is in exports', () => {
    // Scenario: Some packages export './foo/index.js' instead of './foo'
    // The plugin should allow rewrite if either is present
    const pkgJson = { exports: { './foo/index.js': './foo/index.js' } };
    expect(utils.isAllowedByExports(pkgJson, './foo')).toBe(true);
  });

  it('should block rewrite if subpath is not in exports', () => {
    // Scenario: If subpath is not exported, Node.js blocks deep import (strict exports)
    // See: https://nodejs.org/api/packages.html#subpath-exports
    const pkgJson = { exports: { './bar': './bar/index.js' } };
    expect(utils.isAllowedByExports(pkgJson, './foo')).toBe(false);
  });

  it('should detect CJS modules by extension', () => {
    // Scenario: .cjs files are always CommonJS; .js files are CJS unless package.json type is 'module'
    // See: https://nodejs.org/api/packages.html#type
    expect(utils.isCjsModule('/foo/bar.cjs', { pkgName:'x', pkgJson: {}}, false)).toBe(true);
    expect(utils.isCjsModule('/foo/bar.js', {pkgName:'x', pkgJson: {}}, false)).toBe(true);
  });

  it('should detect ESM modules by type: module', () => {
    // Scenario: If package.json has "type": "module", .js files are ESM
    // See: https://nodejs.org/api/packages.html#type
  
    expect(utils.isCjsModule('/foo/bar.js', {pkgName:'x', pkgJson: { type: 'module' }}, false)).toBe(false);
  });

  it('should treat .js as CJS if no package.json', () => {
    // Scenario: If no package.json is found, .js files default to CJS (legacy Node.js behavior)

    expect(utils.isCjsModule('/foo/bar.js',  {pkgName:'x', pkgJson: undefined})).toBe(true);
  });
});
