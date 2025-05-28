// fileUtil.js - file-related utility functions for babel-plugin-import-directory-plus
const fs = require('fs');
const path = require('path');

function isDirectory(p) {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function isFile(p) {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

function readJSON(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function getPackageJsonFilePath(dir) {
  let cur = dir;
  while (cur !== path.dirname(cur)) {
    const pkg = path.join(cur, 'package.json');
    if (typeof pkg !== 'string') return null;
    if (isFile(pkg)) return pkg;
    cur = path.dirname(cur);
  }
  return null;
}

function getDependsPackageJson(dir, stopDir) {
  let cur = dir;
  while (cur !== path.dirname(cur) && cur !== stopDir) {
    if (cur === '/') return null; // Reached root directory
    const pkg = path.join(cur, 'package.json');
    if (typeof pkg !== 'string') return null;
    if (isFile(pkg)) {
      const json = readJSON(pkg);
      if (json && (json.dependencies || json.peerDependencies)) {
        return {json, pkgPath: pkg, pkgDir: cur};
      }
    }
    cur = path.dirname(cur);
  }
  return null;
}

function getNodeModulesDir(dir, stopDir) {
  let cur = dir;
  while (cur !== path.dirname(cur) && cur !== stopDir) {
    if (cur === '/') return null; // Reached root directory
   
  
    if (isDirectory(cur) && cur.endsWith('/node_modules')) {
      return cur;
    }
    cur = path.dirname(cur);
  }
  return null;
}

function safeJoin(...args) {
  if (typeof path.join !== 'function') return null;
  if (!args.length) return null;
  if (!args.every(a => typeof a === 'string' && a)) return null;
  return path.join(...args);
}

const fileUtil = {
  isDirectory,
  getNodeModulesDir,
  isFile,
  readJSON,
  getPackageJsonFilePath,
  getDependsPackageJson,
  safeJoin,
};

module.exports = fileUtil;
