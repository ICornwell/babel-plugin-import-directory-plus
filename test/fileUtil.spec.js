import { describe, it, expect } from 'vitest';
const fileUtil = require('../src/fileUtil');

describe('fileUtil', () => {
  it('should join paths correctly', () => {
    expect(fileUtil.safeJoin('a', 'b')).toMatch(/a.*b/);
  });

  it('should return null if any segment is falsy', () => {
    expect(fileUtil.safeJoin('a', null, 'b')).toBe(null);
    // The following should return null, not '.'
    expect(fileUtil.safeJoin('')).toBe(null);
    // Also test that safeJoin() (no args) returns null
    expect(fileUtil.safeJoin()).toBe(null);
  });

  it('should normalize slashes', () => {
    const joined = fileUtil.safeJoin('foo/', '/bar', 'baz');
    expect(joined).toMatch(/foo.*bar.*baz/);
  });

  it('should detect if a path is a directory (isDirectory)', () => {
    // This test assumes isDirectory returns false for non-existent paths
    expect(fileUtil.isDirectory('/unlikely/to/exist/xyz')).toBe(false);
    // For a real directory, use __dirname or process.cwd()
    expect(fileUtil.isDirectory(__dirname)).toBe(true);
  });

  it('should detect if a path is a file (isFile)', () => {
    // This test assumes isFile returns false for non-existent files
    expect(fileUtil.isFile('/unlikely/to/exist/xyz.txt')).toBe(false);
    // For a real file, use this test file itself
    expect(fileUtil.isFile(__filename)).toBe(true);
  });

  // Add more tests for file-related utilities here as needed
});
