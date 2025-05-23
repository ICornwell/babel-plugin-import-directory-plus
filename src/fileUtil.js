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

function getPackageJson(dir) {
  let cur = dir;
  while (cur !== path.dirname(cur)) {
    const pkg = path.join(cur, 'package.json');
    if (typeof pkg !== 'string') return null;
    if (isFile(pkg)) return pkg;
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
  isFile,
  readJSON,
  getPackageJson,
  safeJoin,
};

module.exports = fileUtil;
