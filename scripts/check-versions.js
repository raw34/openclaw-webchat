#!/usr/bin/env node

/**
 * Check that all package versions are consistent
 */

const fs = require('fs');
const path = require('path');

const packages = ['packages/core', 'packages/react', 'packages/vue'];

const versions = packages.map((pkg) => {
  const pkgPath = path.join(__dirname, '..', pkg, 'package.json');
  const { name, version } = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  return { name, version, path: pkg };
});

const uniqueVersions = [...new Set(versions.map((v) => v.version))];

if (uniqueVersions.length > 1) {
  console.error('❌ Version mismatch detected:\n');
  versions.forEach(({ name, version, path }) => {
    console.error(`  ${path}: ${name}@${version}`);
  });
  console.error('\nAll packages must have the same version.');
  process.exit(1);
}

console.log(`✓ All packages are at version ${uniqueVersions[0]}`);
